import { Prisma } from "../generated/prisma/client.js"
import {
  OrigemLancamentoFinanceiro,
  StatusLancamentoFinanceiro,
  StatusMovimentacaoFinanceira,
  TipoCategoriaFinanceira,
  TipoLancamentoFinanceiro,
  TipoMovimentacaoFinanceira
} from "../generated/prisma/enums.js"
import { AMBIENTE_FINANCEIRO_PREVIEW } from "../financeiro/financeiro-preview.js"
import { prisma } from "../lib/prisma.js"
import {
  bloquearFinanceiroPreviewDaEmpresaTx,
  executarTransacaoComRollback
} from "../lib/transacao.js"
import type {
  AtualizarLancamentoFinanceiroInput,
  CancelarLancamentoFinanceiroInput,
  CriarLancamentoFinanceiroInput,
  EstornarBaixaFinanceiraInput,
  ListarLancamentosFinanceirosQuery,
  RegistrarBaixaFinanceiraInput
} from "../validators/financeiro.validators.js"
import { registrarAuditoriaFinanceiraTx } from "./financeiro-auditoria.service.js"

const lancamentoInclude = {
  categoria: {
    select: { id: true, nome: true, tipo: true, cor: true }
  },
  centroCusto: {
    select: { id: true, nome: true, codigo: true }
  },
  contaPreferida: {
    select: { id: true, nome: true, tipo: true, cor: true }
  },
  cliente: {
    select: { id: true, nome: true }
  },
  movimentacoes: {
    orderBy: [{ movimentadoEm: "desc" as const }, { id: "desc" as const }],
    select: {
      id: true,
      contaId: true,
      tipo: true,
      status: true,
      valor: true,
      formaPagamento: true,
      descricao: true,
      observacao: true,
      movimentadoEm: true,
      estornadoEm: true,
      motivoEstorno: true,
      criadoEm: true,
      conta: { select: { id: true, nome: true } }
    }
  }
} satisfies Prisma.LancamentoFinanceiroInclude

type LancamentoCompleto = Prisma.LancamentoFinanceiroGetPayload<{
  include: typeof lancamentoInclude
}>

function inicioHojeUtc(): Date {
  const agora = new Date()
  return new Date(Date.UTC(
    agora.getUTCFullYear(),
    agora.getUTCMonth(),
    agora.getUTCDate()
  ))
}

function inicioDiaUtc(data: Date): Date {
  return new Date(Date.UTC(
    data.getUTCFullYear(),
    data.getUTCMonth(),
    data.getUTCDate()
  ))
}

function proximoDiaUtc(data: Date): Date {
  const resultado = inicioDiaUtc(data)
  resultado.setUTCDate(resultado.getUTCDate() + 1)
  return resultado
}

function statusAbertoPelaData(
  dataVencimento: Date
): typeof StatusLancamentoFinanceiro.PENDENTE | typeof StatusLancamentoFinanceiro.VENCIDO {
  return dataVencimento < inicioHojeUtc()
    ? StatusLancamentoFinanceiro.VENCIDO
    : StatusLancamentoFinanceiro.PENDENTE
}

function enriquecerLancamento(lancamento: LancamentoCompleto) {
  const valorPago = lancamento.movimentacoes
    .filter(item => item.status === StatusMovimentacaoFinanceira.CONFIRMADA)
    .reduce(
      (total, item) => total.plus(item.valor),
      new Prisma.Decimal(0)
    )
  const saldoCalculado = lancamento.valorTotal.minus(valorPago)
  const saldoAberto = saldoCalculado.lessThan(0)
    ? new Prisma.Decimal(0)
    : saldoCalculado
  const vencido =
    saldoAberto.greaterThan(0) &&
    lancamento.dataVencimento < inicioHojeUtc() &&
    lancamento.status !== StatusLancamentoFinanceiro.RASCUNHO &&
    lancamento.status !== StatusLancamentoFinanceiro.CANCELADO

  let statusCalculado = lancamento.status
  if (
    lancamento.status !== StatusLancamentoFinanceiro.CANCELADO &&
    lancamento.status !== StatusLancamentoFinanceiro.RASCUNHO
  ) {
    if (saldoAberto.equals(0)) {
      statusCalculado = StatusLancamentoFinanceiro.QUITADO
    } else if (vencido) {
      statusCalculado = StatusLancamentoFinanceiro.VENCIDO
    } else if (valorPago.greaterThan(0)) {
      statusCalculado = StatusLancamentoFinanceiro.PARCIAL
    } else {
      statusCalculado = StatusLancamentoFinanceiro.PENDENTE
    }
  }

  return {
    ...lancamento,
    statusCalculado,
    valorPago,
    saldoAberto,
    vencido
  }
}

async function validarReferenciasTx(
  tx: Prisma.TransactionClient,
  empresaId: number,
  tipo: TipoLancamentoFinanceiro,
  referencias: {
    categoriaId: number
    centroCustoId?: number | null
    contaPreferidaId?: number | null
    clienteId?: number | null
  }
) {
  const categoria = await tx.categoriaFinanceira.findUnique({
    where: {
      id_empresaId_ambiente: {
        id: referencias.categoriaId,
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW
      }
    }
  })
  const tipoCategoriaEsperado = tipo === TipoLancamentoFinanceiro.RECEBER
    ? TipoCategoriaFinanceira.RECEITA
    : TipoCategoriaFinanceira.DESPESA

  if (!categoria || !categoria.ativa || categoria.tipo !== tipoCategoriaEsperado) {
    return { valido: false as const, campo: "categoriaId" as const }
  }

  if (referencias.centroCustoId != null) {
    const centro = await tx.centroCustoFinanceiro.findUnique({
      where: {
        id_empresaId_ambiente: {
          id: referencias.centroCustoId,
          empresaId,
          ambiente: AMBIENTE_FINANCEIRO_PREVIEW
        }
      }
    })
    if (!centro?.ativo) {
      return { valido: false as const, campo: "centroCustoId" as const }
    }
  }

  if (referencias.contaPreferidaId != null) {
    const conta = await tx.contaFinanceira.findUnique({
      where: {
        id_empresaId_ambiente: {
          id: referencias.contaPreferidaId,
          empresaId,
          ambiente: AMBIENTE_FINANCEIRO_PREVIEW
        }
      }
    })
    if (!conta?.ativa) {
      return { valido: false as const, campo: "contaPreferidaId" as const }
    }
  }

  if (referencias.clienteId != null) {
    const cliente = await tx.cliente.findUnique({
      where: { id_empresaId: { id: referencias.clienteId, empresaId } },
      select: { id: true }
    })
    if (!cliente) {
      return { valido: false as const, campo: "clienteId" as const }
    }
  }

  return { valido: true as const }
}

export async function listarLancamentosFinanceirosService(
  empresaId: number,
  filtros: ListarLancamentosFinanceirosQuery
) {
  const hoje = inicioHojeUtc()
  const condicoes: Prisma.LancamentoFinanceiroWhereInput[] = []

  if (filtros.status === StatusLancamentoFinanceiro.VENCIDO) {
    condicoes.push({
      OR: [
        { status: StatusLancamentoFinanceiro.VENCIDO },
        {
          status: {
            in: [
              StatusLancamentoFinanceiro.PENDENTE,
              StatusLancamentoFinanceiro.PARCIAL
            ]
          },
          dataVencimento: { lt: hoje }
        }
      ]
    })
  } else if (
    filtros.status === StatusLancamentoFinanceiro.PENDENTE ||
    filtros.status === StatusLancamentoFinanceiro.PARCIAL
  ) {
    condicoes.push({
      status: filtros.status,
      dataVencimento: { gte: hoje }
    })
  } else if (filtros.status !== undefined) {
    condicoes.push({ status: filtros.status })
  }

  if (filtros.busca !== undefined) {
    condicoes.push({
      OR: [
        { descricao: { contains: filtros.busca, mode: "insensitive" } },
        { documento: { contains: filtros.busca, mode: "insensitive" } },
        { contraparte: { contains: filtros.busca, mode: "insensitive" } },
        { cliente: { nome: { contains: filtros.busca, mode: "insensitive" } } }
      ]
    })
  }

  const where: Prisma.LancamentoFinanceiroWhereInput = {
    empresaId,
    ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
    ...(filtros.tipo !== undefined && { tipo: filtros.tipo }),
    ...(condicoes.length > 0 && { AND: condicoes }),
    ...(filtros.categoriaId !== undefined && { categoriaId: filtros.categoriaId }),
    ...(filtros.centroCustoId !== undefined && { centroCustoId: filtros.centroCustoId }),
    ...(filtros.contaPreferidaId !== undefined && { contaPreferidaId: filtros.contaPreferidaId }),
    ...(filtros.clienteId !== undefined && { clienteId: filtros.clienteId }),
    ...((filtros.vencimentoInicio !== undefined || filtros.vencimentoFim !== undefined) && {
      dataVencimento: {
        ...(filtros.vencimentoInicio !== undefined && {
          gte: inicioDiaUtc(filtros.vencimentoInicio)
        }),
        ...(filtros.vencimentoFim !== undefined && {
          lt: proximoDiaUtc(filtros.vencimentoFim)
        })
      }
    })
  }
  const skip = (filtros.pagina - 1) * filtros.limite
  const [dados, total] = await prisma.$transaction([
    prisma.lancamentoFinanceiro.findMany({
      where,
      include: lancamentoInclude,
      orderBy: [{ dataVencimento: "asc" }, { id: "desc" }],
      skip,
      take: filtros.limite
    }),
    prisma.lancamentoFinanceiro.count({ where })
  ])

  return {
    dados: dados.map(enriquecerLancamento),
    paginacao: {
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,
      totalPaginas: Math.ceil(total / filtros.limite)
    }
  }
}

export async function buscarLancamentoFinanceiroService(
  id: number,
  empresaId: number
) {
  const lancamento = await prisma.lancamentoFinanceiro.findUnique({
    where: {
      id_empresaId_ambiente: {
        id,
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW
      }
    },
    include: lancamentoInclude
  })
  return lancamento ? enriquecerLancamento(lancamento) : null
}

export function criarLancamentoFinanceiroService(
  empresaId: number,
  usuarioId: number,
  dados: CriarLancamentoFinanceiroInput
) {
  return executarTransacaoComRollback(async tx => {
    await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
    const referencias = await validarReferenciasTx(tx, empresaId, dados.tipo, {
      categoriaId: dados.categoriaId,
      ...(dados.centroCustoId !== undefined && {
        centroCustoId: dados.centroCustoId
      }),
      ...(dados.contaPreferidaId !== undefined && {
        contaPreferidaId: dados.contaPreferidaId
      }),
      ...(dados.clienteId !== undefined && { clienteId: dados.clienteId })
    })
    if (!referencias.valido) {
      return {
        sucesso: false as const,
        motivo: "referencia_invalida" as const,
        campo: referencias.campo
      }
    }

    const valorOriginal = new Prisma.Decimal(dados.valorOriginal)
    const desconto = new Prisma.Decimal(dados.desconto)
    const juros = new Prisma.Decimal(dados.juros)
    const multa = new Prisma.Decimal(dados.multa)
    const valorTotal = valorOriginal.minus(desconto).plus(juros).plus(multa)
    const status = dados.status === StatusLancamentoFinanceiro.PENDENTE
      ? statusAbertoPelaData(dados.dataVencimento)
      : dados.status

    const lancamento = await tx.lancamentoFinanceiro.create({
      data: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        tipo: dados.tipo,
        status,
        origem: OrigemLancamentoFinanceiro.MANUAL,
        descricao: dados.descricao,
        categoriaId: dados.categoriaId,
        valorOriginal,
        desconto,
        juros,
        multa,
        valorTotal,
        dataCompetencia: dados.dataCompetencia,
        dataVencimento: dados.dataVencimento,
        criadoPorId: usuarioId,
        ...(dados.documento !== undefined && { documento: dados.documento }),
        ...(dados.contraparte !== undefined && { contraparte: dados.contraparte }),
        ...(dados.clienteId !== undefined && { clienteId: dados.clienteId }),
        ...(dados.centroCustoId !== undefined && { centroCustoId: dados.centroCustoId }),
        ...(dados.contaPreferidaId !== undefined && { contaPreferidaId: dados.contaPreferidaId }),
        ...(dados.observacao !== undefined && { observacao: dados.observacao })
      },
      include: lancamentoInclude
    })
    await registrarAuditoriaFinanceiraTx(tx, {
      empresaId,
      usuarioId,
      acao: "LANCAMENTO_CRIADO",
      entidade: "LancamentoFinanceiro",
      entidadeId: lancamento.id,
      dadosDepois: lancamento
    })
    return { sucesso: true as const, lancamento: enriquecerLancamento(lancamento) }
  })
}

export function atualizarLancamentoFinanceiroService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: AtualizarLancamentoFinanceiroInput
) {
  return executarTransacaoComRollback(async tx => {
    await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
    const anterior = await tx.lancamentoFinanceiro.findUnique({
      where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
      include: lancamentoInclude
    })
    if (!anterior) return { sucesso: false as const, motivo: "lancamento_nao_encontrado" as const }
    if (anterior.versao !== dados.versaoEsperada) {
      return { sucesso: false as const, motivo: "conflito_atualizacao" as const, versaoAtual: anterior.versao }
    }
    if (
      anterior.status === StatusLancamentoFinanceiro.CANCELADO ||
      anterior.status === StatusLancamentoFinanceiro.QUITADO
    ) {
      return { sucesso: false as const, motivo: "lancamento_bloqueado" as const, statusAtual: anterior.status }
    }

    const referencias = await validarReferenciasTx(tx, empresaId, anterior.tipo, {
      categoriaId: dados.categoriaId ?? anterior.categoriaId,
      centroCustoId: dados.centroCustoId === undefined ? anterior.centroCustoId : dados.centroCustoId,
      contaPreferidaId: dados.contaPreferidaId === undefined ? anterior.contaPreferidaId : dados.contaPreferidaId,
      clienteId: dados.clienteId === undefined ? anterior.clienteId : dados.clienteId
    })
    if (!referencias.valido) {
      return { sucesso: false as const, motivo: "referencia_invalida" as const, campo: referencias.campo }
    }

    const possuiBaixa = anterior.movimentacoes.some(
      item => item.status === StatusMovimentacaoFinanceira.CONFIRMADA
    )
    const alteraValor = ["valorOriginal", "desconto", "juros", "multa"]
      .some(campo => dados[campo as keyof AtualizarLancamentoFinanceiroInput] !== undefined)
    if (possuiBaixa && (alteraValor || dados.status !== undefined)) {
      return { sucesso: false as const, motivo: "lancamento_possui_baixas" as const }
    }

    const valorOriginal = new Prisma.Decimal(dados.valorOriginal ?? anterior.valorOriginal)
    const desconto = new Prisma.Decimal(dados.desconto ?? anterior.desconto)
    const juros = new Prisma.Decimal(dados.juros ?? anterior.juros)
    const multa = new Prisma.Decimal(dados.multa ?? anterior.multa)
    const valorTotal = valorOriginal.minus(desconto).plus(juros).plus(multa)
    if (desconto.greaterThan(valorOriginal) || !valorTotal.greaterThan(0)) {
      return { sucesso: false as const, motivo: "valores_invalidos" as const }
    }

    const dataVencimento = dados.dataVencimento ?? anterior.dataVencimento
    let status = dados.status ?? anterior.status
    if (status !== StatusLancamentoFinanceiro.RASCUNHO && !possuiBaixa) {
      status = statusAbertoPelaData(dataVencimento)
    }

    const atualizado = await tx.lancamentoFinanceiro.updateMany({
      where: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW, versao: dados.versaoEsperada },
      data: {
        status,
        valorOriginal,
        desconto,
        juros,
        multa,
        valorTotal,
        versao: { increment: 1 },
        ...(dados.descricao !== undefined && { descricao: dados.descricao }),
        ...(dados.documento !== undefined && { documento: dados.documento }),
        ...(dados.contraparte !== undefined && { contraparte: dados.contraparte }),
        ...(dados.clienteId !== undefined && { clienteId: dados.clienteId }),
        ...(dados.categoriaId !== undefined && { categoriaId: dados.categoriaId }),
        ...(dados.centroCustoId !== undefined && { centroCustoId: dados.centroCustoId }),
        ...(dados.contaPreferidaId !== undefined && { contaPreferidaId: dados.contaPreferidaId }),
        ...(dados.dataCompetencia !== undefined && { dataCompetencia: dados.dataCompetencia }),
        ...(dados.dataVencimento !== undefined && { dataVencimento: dados.dataVencimento }),
        ...(dados.observacao !== undefined && { observacao: dados.observacao })
      }
    })
    if (atualizado.count === 0) {
      return { sucesso: false as const, motivo: "conflito_atualizacao" as const, versaoAtual: anterior.versao }
    }

    const lancamento = await tx.lancamentoFinanceiro.findUniqueOrThrow({
      where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
      include: lancamentoInclude
    })
    await registrarAuditoriaFinanceiraTx(tx, {
      empresaId,
      usuarioId,
      acao: "LANCAMENTO_ATUALIZADO",
      entidade: "LancamentoFinanceiro",
      entidadeId: id,
      dadosAntes: anterior,
      dadosDepois: lancamento
    })
    return { sucesso: true as const, lancamento: enriquecerLancamento(lancamento) }
  })
}

export function cancelarLancamentoFinanceiroService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: CancelarLancamentoFinanceiroInput
) {
  return executarTransacaoComRollback(async tx => {
    await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
    const anterior = await tx.lancamentoFinanceiro.findUnique({
      where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
      include: lancamentoInclude
    })
    if (!anterior) return { sucesso: false as const, motivo: "lancamento_nao_encontrado" as const }
    if (anterior.versao !== dados.versaoEsperada) {
      return { sucesso: false as const, motivo: "conflito_atualizacao" as const, versaoAtual: anterior.versao }
    }
    if (anterior.status === StatusLancamentoFinanceiro.CANCELADO) {
      return { sucesso: false as const, motivo: "lancamento_ja_cancelado" as const }
    }
    if (anterior.movimentacoes.some(item => item.status === StatusMovimentacaoFinanceira.CONFIRMADA)) {
      return { sucesso: false as const, motivo: "lancamento_possui_baixas" as const }
    }

    const lancamento = await tx.lancamentoFinanceiro.update({
      where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
      data: {
        status: StatusLancamentoFinanceiro.CANCELADO,
        canceladoEm: new Date(),
        motivoCancelamento: dados.motivo,
        versao: { increment: 1 }
      },
      include: lancamentoInclude
    })
    await registrarAuditoriaFinanceiraTx(tx, {
      empresaId,
      usuarioId,
      acao: "LANCAMENTO_CANCELADO",
      entidade: "LancamentoFinanceiro",
      entidadeId: id,
      dadosAntes: anterior,
      dadosDepois: lancamento
    })
    return { sucesso: true as const, lancamento: enriquecerLancamento(lancamento) }
  })
}

export function registrarBaixaFinanceiraService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: RegistrarBaixaFinanceiraInput
) {
  return executarTransacaoComRollback(async tx => {
    await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
    const lancamentoAtual = await tx.lancamentoFinanceiro.findUnique({
      where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
      include: lancamentoInclude
    })
    if (!lancamentoAtual) return { sucesso: false as const, motivo: "lancamento_nao_encontrado" as const }
    if (lancamentoAtual.versao !== dados.versaoEsperada) {
      return { sucesso: false as const, motivo: "conflito_atualizacao" as const, versaoAtual: lancamentoAtual.versao }
    }
    if (
      lancamentoAtual.status === StatusLancamentoFinanceiro.RASCUNHO ||
      lancamentoAtual.status === StatusLancamentoFinanceiro.CANCELADO ||
      lancamentoAtual.status === StatusLancamentoFinanceiro.QUITADO
    ) {
      return { sucesso: false as const, motivo: "lancamento_bloqueado" as const, statusAtual: lancamentoAtual.status }
    }

    const conta = await tx.contaFinanceira.findUnique({
      where: { id_empresaId_ambiente: { id: dados.contaId, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } }
    })
    if (!conta?.ativa) return { sucesso: false as const, motivo: "conta_invalida" as const }
    if (dados.movimentadoEm < conta.dataSaldoInicial) {
      return {
        sucesso: false as const,
        motivo: "data_anterior_saldo_inicial" as const,
        dataSaldoInicial: conta.dataSaldoInicial
      }
    }

    const detalhado = enriquecerLancamento(lancamentoAtual)
    const valor = new Prisma.Decimal(dados.valor)
    if (valor.greaterThan(detalhado.saldoAberto)) {
      return {
        sucesso: false as const,
        motivo: "valor_excede_saldo" as const,
        saldoAberto: detalhado.saldoAberto,
        valorInformado: valor
      }
    }

    const status = valor.equals(detalhado.saldoAberto)
      ? StatusLancamentoFinanceiro.QUITADO
      : StatusLancamentoFinanceiro.PARCIAL
    const cas = await tx.lancamentoFinanceiro.updateMany({
      where: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW, versao: dados.versaoEsperada },
      data: { status, versao: { increment: 1 } }
    })
    if (cas.count === 0) {
      return { sucesso: false as const, motivo: "conflito_atualizacao" as const, versaoAtual: lancamentoAtual.versao }
    }

    const movimentacao = await tx.movimentacaoFinanceira.create({
      data: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        contaId: dados.contaId,
        lancamentoId: id,
        tipo: lancamentoAtual.tipo === TipoLancamentoFinanceiro.RECEBER
          ? TipoMovimentacaoFinanceira.ENTRADA
          : TipoMovimentacaoFinanceira.SAIDA,
        status: StatusMovimentacaoFinanceira.CONFIRMADA,
        valor,
        formaPagamento: dados.formaPagamento,
        descricao: `Baixa: ${lancamentoAtual.descricao}`,
        movimentadoEm: dados.movimentadoEm,
        registradoPorId: usuarioId,
        ...(dados.observacao !== undefined && { observacao: dados.observacao })
      },
      include: { conta: { select: { id: true, nome: true } } }
    })
    await registrarAuditoriaFinanceiraTx(tx, {
      empresaId,
      usuarioId,
      acao: "BAIXA_REGISTRADA",
      entidade: "MovimentacaoFinanceira",
      entidadeId: movimentacao.id,
      dadosAntes: { lancamentoId: id, saldoAberto: detalhado.saldoAberto },
      dadosDepois: movimentacao
    })

    const lancamento = await tx.lancamentoFinanceiro.findUniqueOrThrow({
      where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
      include: lancamentoInclude
    })
    return {
      sucesso: true as const,
      movimentacao,
      lancamento: enriquecerLancamento(lancamento)
    }
  })
}

export function estornarBaixaFinanceiraService(
  lancamentoId: number,
  movimentacaoId: number,
  empresaId: number,
  usuarioId: number,
  dados: EstornarBaixaFinanceiraInput
) {
  return executarTransacaoComRollback(async tx => {
    await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
    const lancamentoAtual = await tx.lancamentoFinanceiro.findUnique({
      where: { id_empresaId_ambiente: { id: lancamentoId, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
      include: lancamentoInclude
    })
    if (!lancamentoAtual) return { sucesso: false as const, motivo: "lancamento_nao_encontrado" as const }
    if (lancamentoAtual.versao !== dados.versaoEsperada) {
      return { sucesso: false as const, motivo: "conflito_atualizacao" as const, versaoAtual: lancamentoAtual.versao }
    }
    const movimento = lancamentoAtual.movimentacoes.find(item => item.id === movimentacaoId)
    if (!movimento) return { sucesso: false as const, motivo: "movimentacao_nao_encontrada" as const }
    if (movimento.status === StatusMovimentacaoFinanceira.ESTORNADA) {
      return { sucesso: false as const, motivo: "movimentacao_ja_estornada" as const }
    }

    const movimentacao = await tx.movimentacaoFinanceira.update({
      where: { id_empresaId_ambiente: { id: movimentacaoId, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
      data: {
        status: StatusMovimentacaoFinanceira.ESTORNADA,
        estornadoEm: new Date(Math.max(
          Date.now(),
          movimento.criadoEm.getTime()
        )),
        estornadoPorId: usuarioId,
        motivoEstorno: dados.motivo
      }
    })
    const totalPagoApos = lancamentoAtual.movimentacoes
      .filter(item => item.id !== movimentacaoId && item.status === StatusMovimentacaoFinanceira.CONFIRMADA)
      .reduce((total, item) => total.plus(item.valor), new Prisma.Decimal(0))
    const status = totalPagoApos.equals(0)
      ? statusAbertoPelaData(lancamentoAtual.dataVencimento)
      : totalPagoApos.greaterThanOrEqualTo(lancamentoAtual.valorTotal)
        ? StatusLancamentoFinanceiro.QUITADO
        : StatusLancamentoFinanceiro.PARCIAL
    await tx.lancamentoFinanceiro.update({
      where: { id_empresaId_ambiente: { id: lancamentoId, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
      data: { status, versao: { increment: 1 } }
    })
    await registrarAuditoriaFinanceiraTx(tx, {
      empresaId,
      usuarioId,
      acao: "BAIXA_ESTORNADA",
      entidade: "MovimentacaoFinanceira",
      entidadeId: movimentacaoId,
      dadosAntes: movimento,
      dadosDepois: movimentacao
    })

    const lancamento = await tx.lancamentoFinanceiro.findUniqueOrThrow({
      where: { id_empresaId_ambiente: { id: lancamentoId, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
      include: lancamentoInclude
    })
    return { sucesso: true as const, movimentacao, lancamento: enriquecerLancamento(lancamento) }
  })
}
