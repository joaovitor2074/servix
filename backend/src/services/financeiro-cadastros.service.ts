import { Prisma } from "../generated/prisma/client.js"
import {
  StatusMovimentacaoFinanceira,
  TipoMovimentacaoFinanceira
} from "../generated/prisma/enums.js"
import { AMBIENTE_FINANCEIRO_PREVIEW } from "../financeiro/financeiro-preview.js"
import { prisma } from "../lib/prisma.js"
import { erroPrismaPossuiCodigo } from "../lib/prisma-errors.js"
import {
  bloquearFinanceiroPreviewDaEmpresaTx,
  executarTransacaoComRollback
} from "../lib/transacao.js"
import type {
  AtualizarCategoriaFinanceiraInput,
  AtualizarCentroCustoFinanceiroInput,
  AtualizarContaFinanceiraInput,
  CriarCategoriaFinanceiraInput,
  CriarCentroCustoFinanceiroInput,
  CriarContaFinanceiraInput,
  ListarCategoriasFinanceirasQuery,
  ListarCentrosCustoFinanceirosQuery,
  ListarContasFinanceirasQuery
} from "../validators/financeiro.validators.js"
import { registrarAuditoriaFinanceiraTx } from "./financeiro-auditoria.service.js"

const TIPOS_ENTRADA = new Set<TipoMovimentacaoFinanceira>([
  TipoMovimentacaoFinanceira.ENTRADA,
  TipoMovimentacaoFinanceira.TRANSFERENCIA_ENTRADA,
  TipoMovimentacaoFinanceira.AJUSTE_ENTRADA
])

export function listarCategoriasFinanceirasService(
  empresaId: number,
  filtros: ListarCategoriasFinanceirasQuery
) {
  return prisma.categoriaFinanceira.findMany({
    where: {
      empresaId,
      ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
      ...(filtros.tipo !== undefined && { tipo: filtros.tipo }),
      ...(filtros.ativa !== undefined && { ativa: filtros.ativa })
    },
    orderBy: [{ tipo: "asc" }, { nome: "asc" }]
  })
}

export async function criarCategoriaFinanceiraService(
  empresaId: number,
  usuarioId: number,
  dados: CriarCategoriaFinanceiraInput
) {
  try {
    const categoria = await executarTransacaoComRollback(async tx => {
      await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
      const criada = await tx.categoriaFinanceira.create({
        data: {
          empresaId,
          ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
          nome: dados.nome,
          tipo: dados.tipo,
          ...(dados.cor !== undefined && { cor: dados.cor }),
          ...(dados.descricao !== undefined && {
            descricao: dados.descricao
          })
        }
      })

      await registrarAuditoriaFinanceiraTx(tx, {
        empresaId,
        usuarioId,
        acao: "CATEGORIA_CRIADA",
        entidade: "CategoriaFinanceira",
        entidadeId: criada.id,
        dadosDepois: criada
      })

      return criada
    })

    return { sucesso: true as const, categoria }
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      return { sucesso: false as const, motivo: "categoria_duplicada" as const }
    }
    throw error
  }
}

export async function atualizarCategoriaFinanceiraService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: AtualizarCategoriaFinanceiraInput
) {
  try {
    return await executarTransacaoComRollback(async tx => {
      await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
      const anterior = await tx.categoriaFinanceira.findUnique({
        where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } }
      })
      if (!anterior) return { sucesso: false as const, motivo: "categoria_nao_encontrada" as const }

      const categoria = await tx.categoriaFinanceira.update({
        where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
        data: {
          ...(dados.nome !== undefined && { nome: dados.nome }),
          ...(dados.cor !== undefined && { cor: dados.cor }),
          ...(dados.descricao !== undefined && { descricao: dados.descricao }),
          ...(dados.ativa !== undefined && { ativa: dados.ativa })
        }
      })

      await registrarAuditoriaFinanceiraTx(tx, {
        empresaId,
        usuarioId,
        acao: categoria.ativa ? "CATEGORIA_ATUALIZADA" : "CATEGORIA_DESATIVADA",
        entidade: "CategoriaFinanceira",
        entidadeId: id,
        dadosAntes: anterior,
        dadosDepois: categoria
      })
      return { sucesso: true as const, categoria }
    })
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      return { sucesso: false as const, motivo: "categoria_duplicada" as const }
    }
    throw error
  }
}

export function listarCentrosCustoFinanceirosService(
  empresaId: number,
  filtros: ListarCentrosCustoFinanceirosQuery
) {
  return prisma.centroCustoFinanceiro.findMany({
    where: {
      empresaId,
      ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
      ...(filtros.ativo !== undefined && { ativo: filtros.ativo })
    },
    orderBy: { nome: "asc" }
  })
}

export async function criarCentroCustoFinanceiroService(
  empresaId: number,
  usuarioId: number,
  dados: CriarCentroCustoFinanceiroInput
) {
  try {
    const centroCusto = await executarTransacaoComRollback(async tx => {
      await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
      const criado = await tx.centroCustoFinanceiro.create({
        data: {
          empresaId,
          ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
          nome: dados.nome,
          ...(dados.codigo !== undefined && { codigo: dados.codigo }),
          ...(dados.descricao !== undefined && { descricao: dados.descricao })
        }
      })
      await registrarAuditoriaFinanceiraTx(tx, {
        empresaId,
        usuarioId,
        acao: "CENTRO_CUSTO_CRIADO",
        entidade: "CentroCustoFinanceiro",
        entidadeId: criado.id,
        dadosDepois: criado
      })
      return criado
    })
    return { sucesso: true as const, centroCusto }
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      return { sucesso: false as const, motivo: "centro_custo_duplicado" as const }
    }
    throw error
  }
}

export async function atualizarCentroCustoFinanceiroService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: AtualizarCentroCustoFinanceiroInput
) {
  try {
    return await executarTransacaoComRollback(async tx => {
      await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
      const anterior = await tx.centroCustoFinanceiro.findUnique({
        where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } }
      })
      if (!anterior) return { sucesso: false as const, motivo: "centro_custo_nao_encontrado" as const }

      const centroCusto = await tx.centroCustoFinanceiro.update({
        where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
        data: {
          ...(dados.nome !== undefined && { nome: dados.nome }),
          ...(dados.codigo !== undefined && { codigo: dados.codigo }),
          ...(dados.descricao !== undefined && { descricao: dados.descricao }),
          ...(dados.ativo !== undefined && { ativo: dados.ativo })
        }
      })
      await registrarAuditoriaFinanceiraTx(tx, {
        empresaId,
        usuarioId,
        acao: centroCusto.ativo ? "CENTRO_CUSTO_ATUALIZADO" : "CENTRO_CUSTO_DESATIVADO",
        entidade: "CentroCustoFinanceiro",
        entidadeId: id,
        dadosAntes: anterior,
        dadosDepois: centroCusto
      })
      return { sucesso: true as const, centroCusto }
    })
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      return { sucesso: false as const, motivo: "centro_custo_duplicado" as const }
    }
    throw error
  }
}

export async function listarContasFinanceirasService(
  empresaId: number,
  filtros: ListarContasFinanceirasQuery
) {
  const [contas, movimentos] = await prisma.$transaction([
    prisma.contaFinanceira.findMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        ...(filtros.ativa !== undefined && { ativa: filtros.ativa })
      },
      orderBy: [{ ativa: "desc" }, { nome: "asc" }]
    }),
    prisma.movimentacaoFinanceira.findMany({
      where: {
        empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        status: StatusMovimentacaoFinanceira.CONFIRMADA
      },
      select: {
        contaId: true,
        tipo: true,
        valor: true,
        movimentadoEm: true
      }
    })
  ])

  return contas.map(conta => {
    const saldoAtual = movimentos
      .filter(movimento =>
        movimento.contaId === conta.id &&
        movimento.movimentadoEm >= conta.dataSaldoInicial
      )
      .reduce((saldo, movimento) => {
        return TIPOS_ENTRADA.has(movimento.tipo)
          ? saldo.plus(movimento.valor)
          : saldo.minus(movimento.valor)
      }, conta.saldoInicial)

    return { ...conta, saldoAtual }
  })
}

export async function criarContaFinanceiraService(
  empresaId: number,
  usuarioId: number,
  dados: CriarContaFinanceiraInput
) {
  try {
    const conta = await executarTransacaoComRollback(async tx => {
      await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
      const criada = await tx.contaFinanceira.create({
        data: {
          empresaId,
          ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
          nome: dados.nome,
          tipo: dados.tipo,
          saldoInicial: new Prisma.Decimal(dados.saldoInicial),
          dataSaldoInicial: dados.dataSaldoInicial,
          ...(dados.instituicao !== undefined && { instituicao: dados.instituicao }),
          ...(dados.cor !== undefined && { cor: dados.cor }),
          ...(dados.descricao !== undefined && { descricao: dados.descricao })
        }
      })
      await registrarAuditoriaFinanceiraTx(tx, {
        empresaId,
        usuarioId,
        acao: "CONTA_FINANCEIRA_CRIADA",
        entidade: "ContaFinanceira",
        entidadeId: criada.id,
        dadosDepois: criada
      })
      return criada
    })
    return { sucesso: true as const, conta: { ...conta, saldoAtual: conta.saldoInicial } }
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      return { sucesso: false as const, motivo: "conta_duplicada" as const }
    }
    throw error
  }
}

export async function atualizarContaFinanceiraService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: AtualizarContaFinanceiraInput
) {
  try {
    return await executarTransacaoComRollback(async tx => {
      await bloquearFinanceiroPreviewDaEmpresaTx(tx, empresaId)
      const anterior = await tx.contaFinanceira.findUnique({
        where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } }
      })
      if (!anterior) return { sucesso: false as const, motivo: "conta_nao_encontrada" as const }

      const conta = await tx.contaFinanceira.update({
        where: { id_empresaId_ambiente: { id, empresaId, ambiente: AMBIENTE_FINANCEIRO_PREVIEW } },
        data: {
          ...(dados.nome !== undefined && { nome: dados.nome }),
          ...(dados.tipo !== undefined && { tipo: dados.tipo }),
          ...(dados.instituicao !== undefined && { instituicao: dados.instituicao }),
          ...(dados.cor !== undefined && { cor: dados.cor }),
          ...(dados.descricao !== undefined && { descricao: dados.descricao }),
          ...(dados.ativa !== undefined && { ativa: dados.ativa })
        }
      })
      await registrarAuditoriaFinanceiraTx(tx, {
        empresaId,
        usuarioId,
        acao: conta.ativa ? "CONTA_FINANCEIRA_ATUALIZADA" : "CONTA_FINANCEIRA_DESATIVADA",
        entidade: "ContaFinanceira",
        entidadeId: id,
        dadosAntes: anterior,
        dadosDepois: conta
      })
      return { sucesso: true as const, conta }
    })
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      return { sucesso: false as const, motivo: "conta_duplicada" as const }
    }
    throw error
  }
}
