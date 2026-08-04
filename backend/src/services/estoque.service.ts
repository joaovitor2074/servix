import { Prisma } from "../generated/prisma/client.js"
import { TipoMovimentacaoEstoque } from "../generated/prisma/enums.js"
import { AppError } from "../errors/app-error.js"
import { prisma } from "../lib/prisma.js"
import { erroPrismaPossuiCodigo } from "../lib/prisma-errors.js"
import type {
  AtualizarProdutoEstoqueInput,
  CriarProdutoEstoqueInput,
  MovimentarEstoqueInput
} from "../validators/estoque.validators.js"

const produtoSelect = {
  id: true,
  empresaId: true,
  nome: true,
  sku: true,
  unidade: true,
  quantidade: true,
  estoqueMinimo: true,
  custoUnitario: true,
  precoVenda: true,
  ativo: true,
  criadoEm: true,
  atualizadoEm: true
} as const

function apresentarProduto<T extends { quantidade: number; estoqueMinimo: number }>(produto: T) {
  return {
    ...produto,
    estoqueBaixo: produto.quantidade <= produto.estoqueMinimo
  }
}

export async function listarProdutosEstoqueService(
  empresaId: number,
  filtros: { busca?: string | undefined; somenteAtivos: boolean }
) {
  const produtos = await prisma.produtoEstoque.findMany({
    where: {
      empresaId,
      ...(filtros.somenteAtivos ? { ativo: true } : {}),
      ...(filtros.busca ? {
        OR: [
          { nome: { contains: filtros.busca, mode: "insensitive" } },
          { sku: { contains: filtros.busca, mode: "insensitive" } }
        ]
      } : {})
    },
    select: produtoSelect,
    orderBy: [{ ativo: "desc" }, { nome: "asc" }]
  })

  return produtos.map(apresentarProduto)
}

export async function criarProdutoEstoqueService(
  empresaId: number,
  usuarioId: number,
  dados: CriarProdutoEstoqueInput
) {
  try {
    return await prisma.$transaction(async tx => {
      const produto = await tx.produtoEstoque.create({
        data: {
          empresaId,
          nome: dados.nome,
          sku: dados.sku ?? null,
          unidade: dados.unidade,
          quantidade: dados.quantidade,
          estoqueMinimo: dados.estoqueMinimo,
          custoUnitario: new Prisma.Decimal(dados.custoUnitario),
          precoVenda: new Prisma.Decimal(dados.precoVenda)
        },
        select: produtoSelect
      })

      if (produto.quantidade > 0) {
        await tx.movimentacaoEstoque.create({
          data: {
            empresaId,
            produtoId: produto.id,
            tipo: TipoMovimentacaoEstoque.ENTRADA,
            quantidade: produto.quantidade,
            saldoAnterior: 0,
            saldoPosterior: produto.quantidade,
            custoUnitario: produto.custoUnitario,
            observacao: "Saldo inicial",
            criadoPorId: usuarioId
          }
        })
      }

      return apresentarProduto(produto)
    })
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      throw new AppError("Já existe uma peça com este SKU.", 409, "SKU_ESTOQUE_DUPLICADO")
    }
    throw error
  }
}

export async function atualizarProdutoEstoqueService(
  id: number,
  empresaId: number,
  dados: AtualizarProdutoEstoqueInput
) {
  try {
    const atualizado = await prisma.produtoEstoque.updateMany({
      where: { id, empresaId },
      data: {
        ...(dados.nome !== undefined && { nome: dados.nome }),
        ...(dados.sku !== undefined && { sku: dados.sku }),
        ...(dados.unidade !== undefined && { unidade: dados.unidade }),
        ...(dados.estoqueMinimo !== undefined && { estoqueMinimo: dados.estoqueMinimo }),
        ...(dados.custoUnitario !== undefined && { custoUnitario: new Prisma.Decimal(dados.custoUnitario) }),
        ...(dados.precoVenda !== undefined && { precoVenda: new Prisma.Decimal(dados.precoVenda) }),
        ...(dados.ativo !== undefined && { ativo: dados.ativo })
      }
    })

    if (atualizado.count === 0) {
      throw new AppError("Peça não encontrada.", 404, "PRODUTO_ESTOQUE_NAO_ENCONTRADO")
    }

    const produto = await prisma.produtoEstoque.findUnique({
      where: { id_empresaId: { id, empresaId } },
      select: produtoSelect
    })
    return apresentarProduto(produto!)
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      throw new AppError("Já existe uma peça com este SKU.", 409, "SKU_ESTOQUE_DUPLICADO")
    }
    throw error
  }
}

function movimentoAdicionaSaldo(tipo: TipoMovimentacaoEstoque) {
  const tiposEntrada: readonly TipoMovimentacaoEstoque[] = [
    TipoMovimentacaoEstoque.ENTRADA,
    TipoMovimentacaoEstoque.AJUSTE_ENTRADA,
    TipoMovimentacaoEstoque.ESTORNO
  ]
  return tiposEntrada.includes(tipo)
}

export async function movimentarEstoqueService(
  empresaId: number,
  usuarioId: number,
  dados: MovimentarEstoqueInput
) {
  return prisma.$transaction(async tx => {
    const produto = await tx.produtoEstoque.findUnique({
      where: { id_empresaId: { id: dados.produtoId, empresaId } },
      select: produtoSelect
    })
    if (!produto || !produto.ativo) {
      throw new AppError("Peça não encontrada ou inativa.", 404, "PRODUTO_ESTOQUE_NAO_ENCONTRADO")
    }

    if (dados.ordemId) {
      const ordem = await tx.ordemServico.findUnique({
        where: { id_empresaId: { id: dados.ordemId, empresaId } },
        select: { id: true, status: true }
      })
      if (!ordem) {
        throw new AppError("Ordem de serviço não encontrada.", 404, "ORDEM_NAO_ENCONTRADA")
      }
      if (["ENTREGUE", "CANCELADO"].includes(ordem.status)) {
        throw new AppError("Não é possível movimentar peças em uma ordem encerrada.", 409, "ORDEM_ENCERRADA")
      }
    }

    const adiciona = movimentoAdicionaSaldo(dados.tipo)
    const saldoPosterior = produto.quantidade + (adiciona ? dados.quantidade : -dados.quantidade)
    if (saldoPosterior < 0) {
      throw new AppError(
        `Estoque insuficiente. Saldo atual: ${produto.quantidade} ${produto.unidade}.`,
        409,
        "ESTOQUE_INSUFICIENTE",
        { saldoAtual: produto.quantidade }
      )
    }

    const alteracao = await tx.produtoEstoque.updateMany({
      where: { id: produto.id, empresaId, quantidade: produto.quantidade },
      data: { quantidade: saldoPosterior }
    })
    if (alteracao.count === 0) {
      throw new AppError("O saldo mudou durante a operação. Tente novamente.", 409, "ESTOQUE_CONCORRENTE")
    }

    const movimentacao = await tx.movimentacaoEstoque.create({
      data: {
        empresaId,
        produtoId: produto.id,
        ordemId: dados.ordemId ?? null,
        tipo: dados.tipo,
        quantidade: dados.quantidade,
        saldoAnterior: produto.quantidade,
        saldoPosterior,
        custoUnitario: produto.custoUnitario,
        observacao: dados.observacao ?? null,
        criadoPorId: usuarioId
      },
      include: {
        produto: { select: { id: true, nome: true, sku: true, unidade: true } },
        ordem: { select: { id: true, numero: true } },
        criadoPor: { select: { id: true, nome: true } }
      }
    })

    return { movimentacao, produto: apresentarProduto({ ...produto, quantidade: saldoPosterior }) }
  })
}

export async function listarMovimentacoesEstoqueService(
  empresaId: number,
  filtros: { limite: number; produtoId?: number | undefined; ordemId?: number | undefined }
) {
  return prisma.movimentacaoEstoque.findMany({
    where: {
      empresaId,
      ...(filtros.produtoId ? { produtoId: filtros.produtoId } : {}),
      ...(filtros.ordemId ? { ordemId: filtros.ordemId } : {})
    },
    include: {
      produto: { select: { id: true, nome: true, sku: true, unidade: true } },
      ordem: { select: { id: true, numero: true } },
      criadoPor: { select: { id: true, nome: true } }
    },
    orderBy: { criadoEm: "desc" },
    take: filtros.limite
  })
}
