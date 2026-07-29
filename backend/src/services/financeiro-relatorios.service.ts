import { Prisma } from "../generated/prisma/client.js"
import {
  StatusOrdem,
  StatusRegistroPagamento,
  StatusLancamentoFinanceiro,
  StatusMovimentacaoFinanceira,
  TipoLancamentoFinanceiro,
  TipoMovimentacaoFinanceira
} from "../generated/prisma/enums.js"
import { AMBIENTE_FINANCEIRO_PREVIEW } from "../financeiro/financeiro-preview.js"
import { prisma } from "../lib/prisma.js"
import type {
  ListarAuditoriaFinanceiraQuery,
  PeriodoFinanceiroQuery
} from "../validators/financeiro.validators.js"
import { listarContasFinanceirasService } from "./financeiro-cadastros.service.js"

const TIPOS_ENTRADA = new Set<TipoMovimentacaoFinanceira>([
  TipoMovimentacaoFinanceira.ENTRADA,
  TipoMovimentacaoFinanceira.TRANSFERENCIA_ENTRADA,
  TipoMovimentacaoFinanceira.AJUSTE_ENTRADA
])

const TIPOS_TRANSFERENCIA = [
  TipoMovimentacaoFinanceira.TRANSFERENCIA_ENTRADA,
  TipoMovimentacaoFinanceira.TRANSFERENCIA_SAIDA
]

const FUSO_HORARIO_FINANCEIRO = "America/Sao_Paulo"
const STATUS_SERVICOS_EM_ABERTO = [
  StatusOrdem.RECEBIDO,
  StatusOrdem.EM_ANALISE,
  StatusOrdem.EM_EXECUCAO,
  StatusOrdem.AGUARDANDO_PECA,
  StatusOrdem.PRONTO
]

type PartesData = {
  ano: number
  mes: number
  dia: number
  hora: number
  minuto: number
  segundo: number
}

function partesDataNoFuso(data: Date): PartesData {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_HORARIO_FINANCEIRO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(data)
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find(parte => parte.type === tipo)?.value ?? 0)

  return {
    ano: valor("year"),
    mes: valor("month"),
    dia: valor("day"),
    hora: valor("hour"),
    minuto: valor("minute"),
    segundo: valor("second")
  }
}

function horarioLocalParaUtc(
  ano: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0,
  segundo = 0
) {
  const alvoComoUtc = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo)
  let resultado = new Date(alvoComoUtc)

  // Duas passagens tambem cobrem uma eventual mudanca de offset no proprio dia.
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    const atual = partesDataNoFuso(resultado)
    const atualComoUtc = Date.UTC(
      atual.ano,
      atual.mes - 1,
      atual.dia,
      atual.hora,
      atual.minuto,
      atual.segundo
    )
    resultado = new Date(resultado.getTime() + alvoComoUtc - atualComoUtc)
  }

  return resultado
}

function limitesFinanceiros(agora: Date) {
  const hoje = partesDataNoFuso(agora)
  const calendarioHoje = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia))
  const calendarioAmanha = new Date(calendarioHoje)
  calendarioAmanha.setUTCDate(calendarioAmanha.getUTCDate() + 1)
  const calendarioProximoMes = new Date(Date.UTC(hoje.ano, hoje.mes, 1))

  return {
    inicioHoje: horarioLocalParaUtc(hoje.ano, hoje.mes, hoje.dia),
    inicioAmanha: horarioLocalParaUtc(
      calendarioAmanha.getUTCFullYear(),
      calendarioAmanha.getUTCMonth() + 1,
      calendarioAmanha.getUTCDate()
    ),
    inicioMes: horarioLocalParaUtc(hoje.ano, hoje.mes, 1),
    inicioProximoMes: horarioLocalParaUtc(
      calendarioProximoMes.getUTCFullYear(),
      calendarioProximoMes.getUTCMonth() + 1,
      calendarioProximoMes.getUTCDate()
    )
  }
}

function inicioDiaUtc(data: Date): Date {
  return new Date(Date.UTC(
    data.getUTCFullYear(),
    data.getUTCMonth(),
    data.getUTCDate()
  ))
}

function proximoDia(data: Date): Date {
  const resultado = new Date(data)
  resultado.setUTCDate(resultado.getUTCDate() + 1)
  return resultado
}

function chaveDia(data: Date): string {
  return data.toISOString().slice(0, 10)
}

type LancamentoResumo = {
  id: number
  tipo: TipoLancamentoFinanceiro
  status: StatusLancamentoFinanceiro
  descricao: string
  contraparte: string | null
  dataVencimento: Date
  valorTotal: Prisma.Decimal
  categoria: { id: number; nome: string; cor: string | null }
  movimentacoes: Array<{ valor: Prisma.Decimal }>
}

function saldoLancamento(lancamento: LancamentoResumo) {
  const valorPago = lancamento.movimentacoes.reduce(
    (total, movimento) => total.plus(movimento.valor),
    new Prisma.Decimal(0)
  )
  const calculado = lancamento.valorTotal.minus(valorPago)
  return {
    valorPago,
    saldoAberto: calculado.lessThan(0) ? new Prisma.Decimal(0) : calculado
  }
}

function somarMovimentos(
  movimentos: Array<{ tipo: TipoMovimentacaoFinanceira; valor: Prisma.Decimal }>
) {
  return movimentos.reduce(
    (totais, movimento) => {
      if (TIPOS_ENTRADA.has(movimento.tipo)) {
        totais.entradas = totais.entradas.plus(movimento.valor)
      } else {
        totais.saidas = totais.saidas.plus(movimento.valor)
      }
      return totais
    },
    { entradas: new Prisma.Decimal(0), saidas: new Prisma.Decimal(0) }
  )
}

export async function buscarDashboardFinanceiroService(empresaId: number) {
  const agora = new Date()
  const hoje = inicioDiaUtc(agora)
  const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1))
  const inicioProximoMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1))
  const limiteProximos = new Date(hoje)
  limiteProximos.setUTCDate(limiteProximos.getUTCDate() + 30)

  const [contas, lancamentos, movimentosMes] = await Promise.all([
    listarContasFinanceirasService(empresaId, {}),
    prisma.lancamentoFinanceiro.findMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        status: { notIn: [StatusLancamentoFinanceiro.CANCELADO, StatusLancamentoFinanceiro.RASCUNHO] }
      },
      select: {
        id: true,
        tipo: true,
        status: true,
        descricao: true,
        contraparte: true,
        dataVencimento: true,
        valorTotal: true,
        categoria: { select: { id: true, nome: true, cor: true } },
        movimentacoes: {
          where: { status: StatusMovimentacaoFinanceira.CONFIRMADA },
          select: { valor: true }
        }
      }
    }),
    prisma.movimentacaoFinanceira.findMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        status: StatusMovimentacaoFinanceira.CONFIRMADA,
        movimentadoEm: { gte: inicioMes, lt: inicioProximoMes },
        tipo: { notIn: TIPOS_TRANSFERENCIA }
      },
      select: { tipo: true, valor: true }
    })
  ])

  const zerado = () => ({
    totalAberto: new Prisma.Decimal(0),
    totalVencido: new Prisma.Decimal(0),
    quantidadeAberta: 0,
    quantidadeVencida: 0
  })
  const receber = zerado()
  const pagar = zerado()
  const proximosVencimentos: Array<{
    id: number
    tipo: TipoLancamentoFinanceiro
    descricao: string
    contraparte: string | null
    dataVencimento: Date
    valorTotal: Prisma.Decimal
    valorPago: Prisma.Decimal
    saldoAberto: Prisma.Decimal
    vencido: boolean
    categoria: LancamentoResumo["categoria"]
  }> = []

  for (const lancamento of lancamentos) {
    const { valorPago, saldoAberto } = saldoLancamento(lancamento)
    if (saldoAberto.equals(0)) continue
    const resumo = lancamento.tipo === TipoLancamentoFinanceiro.RECEBER ? receber : pagar
    resumo.totalAberto = resumo.totalAberto.plus(saldoAberto)
    resumo.quantidadeAberta += 1
    const vencido = lancamento.dataVencimento < hoje
    if (vencido) {
      resumo.totalVencido = resumo.totalVencido.plus(saldoAberto)
      resumo.quantidadeVencida += 1
    }
    if (lancamento.dataVencimento < limiteProximos) {
      proximosVencimentos.push({
        id: lancamento.id,
        tipo: lancamento.tipo,
        descricao: lancamento.descricao,
        contraparte: lancamento.contraparte,
        dataVencimento: lancamento.dataVencimento,
        valorTotal: lancamento.valorTotal,
        valorPago,
        saldoAberto,
        vencido,
        categoria: lancamento.categoria
      })
    }
  }

  proximosVencimentos.sort(
    (a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime()
  )
  const realizado = somarMovimentos(movimentosMes)
  const saldoConsolidado = contas.reduce(
    (total, conta) => total.plus(conta.saldoAtual),
    new Prisma.Decimal(0)
  )

  return {
    ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
    geradoEm: agora,
    saldos: {
      consolidado: saldoConsolidado,
      contas
    },
    contasReceber: receber,
    contasPagar: pagar,
    realizadoNoMes: {
      inicio: inicioMes,
      fimExclusivo: inicioProximoMes,
      entradas: realizado.entradas,
      saidas: realizado.saidas,
      resultado: realizado.entradas.minus(realizado.saidas)
    },
    proximosVencimentos: proximosVencimentos.slice(0, 12)
  }
}

export async function buscarResumoServicosFinanceiroService(
  empresaId: number,
  agora = new Date()
) {
  const limites = limitesFinanceiros(agora)
  const filtroServicosValidos = {
    empresaId,
    status: { not: StatusOrdem.CANCELADO }
  } as const
  const filtroPagamentosConfirmados = {
    empresaId,
    status: StatusRegistroPagamento.CONFIRMADO,
    ordem: { status: { not: StatusOrdem.CANCELADO } }
  } as const

  const [
    totalServicos,
    servicosEmAberto,
    recebidoTotal,
    recebidoHoje,
    recebidoNoMes,
    servicosRecentes
  ] = await Promise.all([
    prisma.ordemServico.aggregate({
      where: filtroServicosValidos,
      _sum: { valor: true },
      _avg: { valor: true },
      _count: { _all: true }
    }),
    prisma.ordemServico.count({
      where: { empresaId, status: { in: STATUS_SERVICOS_EM_ABERTO } }
    }),
    prisma.pagamento.aggregate({
      where: filtroPagamentosConfirmados,
      _sum: { valor: true }
    }),
    prisma.pagamento.aggregate({
      where: {
        ...filtroPagamentosConfirmados,
        pagoEm: { gte: limites.inicioHoje, lt: limites.inicioAmanha }
      },
      _sum: { valor: true }
    }),
    prisma.pagamento.aggregate({
      where: {
        ...filtroPagamentosConfirmados,
        pagoEm: { gte: limites.inicioMes, lt: limites.inicioProximoMes }
      },
      _sum: { valor: true }
    }),
    prisma.ordemServico.findMany({
      where: filtroServicosValidos,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true,
        numero: true,
        equipamento: true,
        status: true,
        valor: true,
        criadoEm: true,
        cliente: { select: { nome: true } },
        pagamentos: {
          where: { status: StatusRegistroPagamento.CONFIRMADO },
          select: { valor: true }
        }
      }
    })
  ])

  const valorTotalServicos = totalServicos._sum.valor ?? new Prisma.Decimal(0)
  const totalRecebido = recebidoTotal._sum.valor ?? new Prisma.Decimal(0)
  const saldoCalculado = valorTotalServicos.minus(totalRecebido)

  return {
    ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
    fusoHorario: FUSO_HORARIO_FINANCEIRO,
    geradoEm: agora,
    periodo: {
      inicioHoje: limites.inicioHoje,
      fimHojeExclusivo: limites.inicioAmanha,
      inicioMes: limites.inicioMes,
      fimMesExclusivo: limites.inicioProximoMes
    },
    indicadores: {
      valorTotalServicos,
      quantidadeServicos: totalServicos._count._all,
      servicosEmAberto,
      recebidoHoje: recebidoHoje._sum.valor ?? new Prisma.Decimal(0),
      recebidoNoMes: recebidoNoMes._sum.valor ?? new Prisma.Decimal(0),
      totalRecebido,
      aReceber: saldoCalculado.lessThan(0)
        ? new Prisma.Decimal(0)
        : saldoCalculado,
      ticketMedio: totalServicos._avg.valor ?? new Prisma.Decimal(0)
    },
    servicosRecentes: servicosRecentes.map(servico => {
      const totalPago = servico.pagamentos.reduce(
        (total, pagamento) => total.plus(pagamento.valor),
        new Prisma.Decimal(0)
      )
      const saldo = servico.valor.minus(totalPago)

      return {
        id: servico.id,
        numero: servico.numero,
        cliente: servico.cliente.nome,
        equipamento: servico.equipamento,
        status: servico.status,
        criadoEm: servico.criadoEm,
        valor: servico.valor,
        totalPago,
        saldo: saldo.lessThan(0) ? new Prisma.Decimal(0) : saldo
      }
    })
  }
}

export async function buscarFluxoCaixaFinanceiroService(
  empresaId: number,
  periodo: PeriodoFinanceiroQuery
) {
  const inicio = inicioDiaUtc(periodo.inicio)
  const fimInclusivo = inicioDiaUtc(periodo.fim)
  const fimExclusivo = proximoDia(fimInclusivo)
  const quantidadeDias = Math.floor(
    (fimExclusivo.getTime() - inicio.getTime()) / 86_400_000
  )
  if (quantidadeDias > 366) {
    return { sucesso: false as const, motivo: "periodo_muito_longo" as const }
  }

  const [contas, movimentosAnteriores, movimentos, lancamentos] = await Promise.all([
    prisma.contaFinanceira.findMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW
      },
      select: {
        id: true,
        saldoInicial: true,
        dataSaldoInicial: true
      }
    }),
    prisma.movimentacaoFinanceira.findMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        status: StatusMovimentacaoFinanceira.CONFIRMADA,
        movimentadoEm: { lt: inicio }
      },
      select: {
        contaId: true,
        tipo: true,
        valor: true,
        movimentadoEm: true
      }
    }),
    prisma.movimentacaoFinanceira.findMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        status: StatusMovimentacaoFinanceira.CONFIRMADA,
        movimentadoEm: { gte: inicio, lt: fimExclusivo },
        tipo: { notIn: TIPOS_TRANSFERENCIA }
      },
      select: {
        contaId: true,
        tipo: true,
        valor: true,
        movimentadoEm: true
      }
    }),
    prisma.lancamentoFinanceiro.findMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        status: { notIn: [
          StatusLancamentoFinanceiro.RASCUNHO,
          StatusLancamentoFinanceiro.CANCELADO
        ] },
        dataVencimento: { gte: inicio, lt: fimExclusivo }
      },
      select: {
        id: true,
        tipo: true,
        status: true,
        descricao: true,
        contraparte: true,
        dataVencimento: true,
        valorTotal: true,
        categoria: { select: { id: true, nome: true, cor: true } },
        movimentacoes: {
          where: { status: StatusMovimentacaoFinanceira.CONFIRMADA },
          select: { valor: true }
        }
      }
    })
  ])

  const contasPorId = new Map(contas.map(conta => [conta.id, conta]))
  const movimentosAnterioresValidos = movimentosAnteriores.filter(movimento => {
    const conta = contasPorId.get(movimento.contaId)
    return conta !== undefined && movimento.movimentadoEm >= conta.dataSaldoInicial
  })
  const movimentoAnterior = somarMovimentos(movimentosAnterioresValidos)
  const saldoInicialContas = contas
    .filter(conta => conta.dataSaldoInicial < inicio)
    .reduce(
    (total, conta) => total.plus(conta.saldoInicial),
    new Prisma.Decimal(0)
    )
  const saldoInicialPeriodo = saldoInicialContas
    .plus(movimentoAnterior.entradas)
    .minus(movimentoAnterior.saidas)

  const dias = new Map<string, {
    data: string
    realizadoEntradas: Prisma.Decimal
    realizadoSaidas: Prisma.Decimal
    previstoEntradas: Prisma.Decimal
    previstoSaidas: Prisma.Decimal
    saldosIniciais: Prisma.Decimal
    saldoRealizadoAcumulado: Prisma.Decimal
    saldoPrevistoAcumulado: Prisma.Decimal
  }>()
  for (let cursor = new Date(inicio); cursor < fimExclusivo; cursor = proximoDia(cursor)) {
    const data = chaveDia(cursor)
    dias.set(data, {
      data,
      realizadoEntradas: new Prisma.Decimal(0),
      realizadoSaidas: new Prisma.Decimal(0),
      previstoEntradas: new Prisma.Decimal(0),
      previstoSaidas: new Prisma.Decimal(0),
      saldosIniciais: new Prisma.Decimal(0),
      saldoRealizadoAcumulado: new Prisma.Decimal(0),
      saldoPrevistoAcumulado: new Prisma.Decimal(0)
    })
  }

  for (const conta of contas) {
    if (
      conta.dataSaldoInicial >= inicio &&
      conta.dataSaldoInicial < fimExclusivo
    ) {
      const dia = dias.get(chaveDia(conta.dataSaldoInicial))
      if (dia) dia.saldosIniciais = dia.saldosIniciais.plus(conta.saldoInicial)
    }
  }

  for (const movimento of movimentos) {
    const conta = contasPorId.get(movimento.contaId)
    if (!conta || movimento.movimentadoEm < conta.dataSaldoInicial) continue
    const dia = dias.get(chaveDia(movimento.movimentadoEm))
    if (!dia) continue
    if (TIPOS_ENTRADA.has(movimento.tipo)) {
      dia.realizadoEntradas = dia.realizadoEntradas.plus(movimento.valor)
    } else {
      dia.realizadoSaidas = dia.realizadoSaidas.plus(movimento.valor)
    }
  }
  for (const lancamento of lancamentos) {
    const saldo = saldoLancamento(lancamento).saldoAberto
    if (saldo.equals(0)) continue
    const dia = dias.get(chaveDia(lancamento.dataVencimento))
    if (!dia) continue
    if (lancamento.tipo === TipoLancamentoFinanceiro.RECEBER) {
      dia.previstoEntradas = dia.previstoEntradas.plus(saldo)
    } else {
      dia.previstoSaidas = dia.previstoSaidas.plus(saldo)
    }
  }

  let saldoRealizado = saldoInicialPeriodo
  let saldoPrevisto = saldoInicialPeriodo
  for (const dia of dias.values()) {
    saldoRealizado = saldoRealizado
      .plus(dia.saldosIniciais)
      .plus(dia.realizadoEntradas)
      .minus(dia.realizadoSaidas)
    saldoPrevisto = saldoPrevisto
      .plus(dia.saldosIniciais)
      .plus(dia.realizadoEntradas)
      .minus(dia.realizadoSaidas)
      .plus(dia.previstoEntradas)
      .minus(dia.previstoSaidas)
    dia.saldoRealizadoAcumulado = saldoRealizado
    dia.saldoPrevistoAcumulado = saldoPrevisto
  }

  const totais = [...dias.values()].reduce(
    (total, dia) => ({
      realizadoEntradas: total.realizadoEntradas.plus(dia.realizadoEntradas),
      realizadoSaidas: total.realizadoSaidas.plus(dia.realizadoSaidas),
      previstoEntradas: total.previstoEntradas.plus(dia.previstoEntradas),
      previstoSaidas: total.previstoSaidas.plus(dia.previstoSaidas),
      saldosIniciais: total.saldosIniciais.plus(dia.saldosIniciais)
    }),
    {
      realizadoEntradas: new Prisma.Decimal(0),
      realizadoSaidas: new Prisma.Decimal(0),
      previstoEntradas: new Prisma.Decimal(0),
      previstoSaidas: new Prisma.Decimal(0),
      saldosIniciais: new Prisma.Decimal(0)
    }
  )

  return {
    sucesso: true as const,
    fluxo: {
      ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
      periodo: { inicio, fim: fimInclusivo },
      saldoInicialPeriodo,
      totais,
      dias: [...dias.values()]
    }
  }
}

export async function listarAuditoriaFinanceiraService(
  empresaId: number,
  filtros: ListarAuditoriaFinanceiraQuery
) {
  const where: Prisma.AuditoriaFinanceiraWhereInput = {
    empresaId,
    ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
    ...(filtros.entidade !== undefined && { entidade: filtros.entidade }),
    ...(filtros.entidadeId !== undefined && { entidadeId: filtros.entidadeId })
  }
  const skip = (filtros.pagina - 1) * filtros.limite
  const [dados, total] = await prisma.$transaction([
    prisma.auditoriaFinanceira.findMany({
      where,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip,
      take: filtros.limite,
      include: { usuario: { select: { id: true, nome: true } } }
    }),
    prisma.auditoriaFinanceira.count({ where })
  ])
  return {
    dados,
    paginacao: {
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,
      totalPaginas: Math.ceil(total / filtros.limite)
    }
  }
}
