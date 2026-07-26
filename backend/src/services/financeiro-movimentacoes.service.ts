import { randomUUID } from "node:crypto"

import { Prisma } from "../generated/prisma/client.js"
import {
  FormaPagamento,
  StatusMovimentacaoFinanceira,
  TipoMovimentacaoFinanceira
} from "../generated/prisma/enums.js"
import { AMBIENTE_FINANCEIRO_PREVIEW } from "../financeiro/financeiro-preview.js"
import { prisma } from "../lib/prisma.js"
import {
  bloquearFinanceiroPreviewDaEmpresaTx,
  executarTransacaoComRollback
} from "../lib/transacao.js"
import type {
  CriarAjusteFinanceiroInput,
  CriarTransferenciaFinanceiraInput,
  EstornarMovimentacaoFinanceiraInput,
  ListarMovimentacoesFinanceirasQuery
} from "../validators/financeiro.validators.js"
import { registrarAuditoriaFinanceiraTx } from "./financeiro-auditoria.service.js"

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

export async function listarMovimentacoesFinanceirasService(
  empresaId: number,
  filtros: ListarMovimentacoesFinanceirasQuery
) {
  const where: Prisma.MovimentacaoFinanceiraWhereInput = {
    empresaId,
    ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
    ...(filtros.contaId !== undefined && { contaId: filtros.contaId }),
    ...(!filtros.incluirEstornadas && {
      status: StatusMovimentacaoFinanceira.CONFIRMADA
    }),
    ...((filtros.inicio !== undefined || filtros.fim !== undefined) && {
      movimentadoEm: {
        ...(filtros.inicio !== undefined && {
          gte: inicioDiaUtc(filtros.inicio)
        }),
        ...(filtros.fim !== undefined && {
          lt: proximoDiaUtc(filtros.fim)
        })
      }
    })
  }
  const skip = (filtros.pagina - 1) * filtros.limite
  const [dados, total] = await prisma.$transaction([
    prisma.movimentacaoFinanceira.findMany({
      where,
      orderBy: [{ movimentadoEm: "desc" }, { id: "desc" }],
      skip,
      take: filtros.limite,
      include: {
        conta: { select: { id: true, nome: true, tipo: true, cor: true } },
        lancamento: {
          select: { id: true, tipo: true, descricao: true, status: true }
        }
      }
    }),
    prisma.movimentacaoFinanceira.count({ where })
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

export function criarAjusteFinanceiroService(
  empresaId: number,
  usuarioId: number,
  dados: CriarAjusteFinanceiroInput
) {
  return executarTransacaoComRollback(async tx => {
    await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
    const conta = await tx.contaFinanceira.findUnique({
      where: {
        id_empresaId_ambiente: {
          id: dados.contaId,
          empresaId,
          ambiente: AMBIENTE_FINANCEIRO_PREVIEW
        }
      }
    })
    if (!conta?.ativa) {
      return { sucesso: false as const, motivo: "conta_invalida" as const }
    }
    if (dados.movimentadoEm < conta.dataSaldoInicial) {
      return {
        sucesso: false as const,
        motivo: "data_anterior_saldo_inicial" as const,
        dataSaldoInicial: conta.dataSaldoInicial
      }
    }

    const movimentacao = await tx.movimentacaoFinanceira.create({
      data: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        contaId: dados.contaId,
        tipo: dados.direcao === "ENTRADA"
          ? TipoMovimentacaoFinanceira.AJUSTE_ENTRADA
          : TipoMovimentacaoFinanceira.AJUSTE_SAIDA,
        valor: new Prisma.Decimal(dados.valor),
        formaPagamento: FormaPagamento.NAO_INFORMADA,
        descricao: dados.descricao,
        movimentadoEm: dados.movimentadoEm,
        registradoPorId: usuarioId,
        ...(dados.documento !== undefined && { documento: dados.documento })
      },
      include: { conta: { select: { id: true, nome: true } } }
    })
    await registrarAuditoriaFinanceiraTx(tx, {
      empresaId,
      usuarioId,
      acao: "AJUSTE_REGISTRADO",
      entidade: "MovimentacaoFinanceira",
      entidadeId: movimentacao.id,
      dadosDepois: movimentacao
    })
    return { sucesso: true as const, movimentacao }
  })
}

export function criarTransferenciaFinanceiraService(
  empresaId: number,
  usuarioId: number,
  dados: CriarTransferenciaFinanceiraInput
) {
  return executarTransacaoComRollback(async tx => {
    await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
    const contas = await tx.contaFinanceira.findMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        id: { in: [dados.contaOrigemId, dados.contaDestinoId] },
        ativa: true
      },
      select: { id: true, nome: true, dataSaldoInicial: true }
    })
    if (contas.length !== 2) {
      return { sucesso: false as const, motivo: "conta_invalida" as const }
    }
    const contaComDataInvalida = contas.find(
      conta => dados.movimentadoEm < conta.dataSaldoInicial
    )
    if (contaComDataInvalida) {
      return {
        sucesso: false as const,
        motivo: "data_anterior_saldo_inicial" as const,
        contaId: contaComDataInvalida.id,
        dataSaldoInicial: contaComDataInvalida.dataSaldoInicial
      }
    }

    const grupoTransferencia = randomUUID()
    const [saida, entrada] = await Promise.all([
      tx.movimentacaoFinanceira.create({
        data: {
          empresaId,
          ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
          contaId: dados.contaOrigemId,
          tipo: TipoMovimentacaoFinanceira.TRANSFERENCIA_SAIDA,
          valor: new Prisma.Decimal(dados.valor),
          descricao: dados.descricao,
          grupoTransferencia,
          movimentadoEm: dados.movimentadoEm,
          registradoPorId: usuarioId
        }
      }),
      tx.movimentacaoFinanceira.create({
        data: {
          empresaId,
          ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
          contaId: dados.contaDestinoId,
          tipo: TipoMovimentacaoFinanceira.TRANSFERENCIA_ENTRADA,
          valor: new Prisma.Decimal(dados.valor),
          descricao: dados.descricao,
          grupoTransferencia,
          movimentadoEm: dados.movimentadoEm,
          registradoPorId: usuarioId
        }
      })
    ])
    await Promise.all([
      registrarAuditoriaFinanceiraTx(tx, {
        empresaId,
        usuarioId,
        acao: "TRANSFERENCIA_SAIDA_REGISTRADA",
        entidade: "MovimentacaoFinanceira",
        entidadeId: saida.id,
        dadosDepois: saida
      }),
      registrarAuditoriaFinanceiraTx(tx, {
        empresaId,
        usuarioId,
        acao: "TRANSFERENCIA_ENTRADA_REGISTRADA",
        entidade: "MovimentacaoFinanceira",
        entidadeId: entrada.id,
        dadosDepois: entrada
      })
    ])
    return {
      sucesso: true as const,
      transferencia: { grupoTransferencia, saida, entrada }
    }
  })
}

export function estornarMovimentacaoAvulsaFinanceiraService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: EstornarMovimentacaoFinanceiraInput
) {
  return executarTransacaoComRollback(async tx => {
    await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
    const atual = await tx.movimentacaoFinanceira.findUnique({
      where: {
        id_empresaId_ambiente: {
          id,
          empresaId,
          ambiente: AMBIENTE_FINANCEIRO_PREVIEW
        }
      }
    })
    if (!atual) {
      return { sucesso: false as const, motivo: "movimentacao_nao_encontrada" as const }
    }
    if (atual.lancamentoId !== null) {
      return { sucesso: false as const, motivo: "movimentacao_vinculada" as const }
    }
    if (atual.status === StatusMovimentacaoFinanceira.ESTORNADA) {
      return { sucesso: false as const, motivo: "movimentacao_ja_estornada" as const }
    }

    const filtroGrupo = atual.grupoTransferencia
      ? { grupoTransferencia: atual.grupoTransferencia }
      : { id: atual.id }
    const movimentosAtuais = await tx.movimentacaoFinanceira.findMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        ...filtroGrupo
      },
      select: { criadoEm: true }
    })
    const estornadoEm = new Date(Math.max(
      Date.now(),
      ...movimentosAtuais.map(movimento => movimento.criadoEm.getTime())
    ))
    await tx.movimentacaoFinanceira.updateMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        status: StatusMovimentacaoFinanceira.CONFIRMADA,
        ...filtroGrupo
      },
      data: {
        status: StatusMovimentacaoFinanceira.ESTORNADA,
        estornadoEm,
        estornadoPorId: usuarioId,
        motivoEstorno: dados.motivo
      }
    })
    const movimentacoes = await tx.movimentacaoFinanceira.findMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        ...filtroGrupo
      },
      orderBy: { id: "asc" }
    })
    for (const movimentacao of movimentacoes) {
      await registrarAuditoriaFinanceiraTx(tx, {
        empresaId,
        usuarioId,
        acao: atual.grupoTransferencia
          ? "TRANSFERENCIA_ESTORNADA"
          : "AJUSTE_ESTORNADO",
        entidade: "MovimentacaoFinanceira",
        entidadeId: movimentacao.id,
        dadosAntes: atual.id === movimentacao.id ? atual : undefined,
        dadosDepois: movimentacao
      })
    }
    return { sucesso: true as const, movimentacoes }
  })
}
