import { z } from "zod"

import { TipoMovimentacaoEstoque } from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

const dinheiro = z.coerce.number().finite().min(0).max(99_999_999)

export const criarProdutoEstoqueSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  sku: z.preprocess(valor => valor === "" ? null : valor, z.string().trim().max(80).nullable().optional()),
  unidade: z.string().trim().min(1).max(20).default("un"),
  quantidade: z.coerce.number().int().min(0).max(1_000_000).default(0),
  estoqueMinimo: z.coerce.number().int().min(0).max(1_000_000).default(0),
  custoUnitario: dinheiro.default(0),
  precoVenda: dinheiro.default(0)
}).strict()

export const atualizarProdutoEstoqueSchema = z.object({
  nome: z.string().trim().min(2).max(160).optional(),
  sku: z.preprocess(valor => valor === "" ? null : valor, z.string().trim().max(80).nullable().optional()),
  unidade: z.string().trim().min(1).max(20).optional(),
  estoqueMinimo: z.coerce.number().int().min(0).max(1_000_000).optional(),
  custoUnitario: dinheiro.optional(),
  precoVenda: dinheiro.optional(),
  ativo: z.boolean().optional()
}).strict().refine(dados => Object.keys(dados).length > 0, {
  message: "Informe ao menos um campo para atualização"
})

export const movimentarEstoqueSchema = z.object({
  produtoId: z.coerce.number().int().positive(),
  tipo: z.enum([
    TipoMovimentacaoEstoque.ENTRADA,
    TipoMovimentacaoEstoque.SAIDA_ORDEM,
    TipoMovimentacaoEstoque.AJUSTE_ENTRADA,
    TipoMovimentacaoEstoque.AJUSTE_SAIDA,
    TipoMovimentacaoEstoque.ESTORNO
  ]),
  quantidade: z.coerce.number().int().positive().max(1_000_000),
  ordemId: z.preprocess(valor => valor === "" ? null : valor, z.coerce.number().int().positive().nullable().optional()),
  observacao: z.preprocess(valor => valor === "" ? null : valor, z.string().trim().max(500).nullable().optional())
}).strict().superRefine((dados, contexto) => {
  if (dados.tipo === TipoMovimentacaoEstoque.SAIDA_ORDEM && !dados.ordemId) {
    contexto.addIssue({
      code: "custom",
      path: ["ordemId"],
      message: "Selecione a ordem que utilizará a peça"
    })
  }
})

export const listarEstoqueQuerySchema = z.object({
  busca: z.string().trim().max(120).optional(),
  somenteAtivos: z.enum(["true", "false"]).transform(valor => valor === "true").default(true)
}).strict()

export const listarMovimentacoesEstoqueQuerySchema = z.object({
  limite: z.coerce.number().int().min(1).max(100).default(30),
  produtoId: z.coerce.number().int().positive().optional(),
  ordemId: z.coerce.number().int().positive().optional()
}).strict()

export type CriarProdutoEstoqueInput = z.infer<typeof criarProdutoEstoqueSchema>
export type AtualizarProdutoEstoqueInput = z.infer<typeof atualizarProdutoEstoqueSchema>
export type MovimentarEstoqueInput = z.infer<typeof movimentarEstoqueSchema>

export const validarCriacaoProdutoEstoque = (dados: unknown) => validarComSchema(criarProdutoEstoqueSchema, dados)
export const validarAtualizacaoProdutoEstoque = (dados: unknown) => validarComSchema(atualizarProdutoEstoqueSchema, dados)
export const validarMovimentacaoEstoque = (dados: unknown) => validarComSchema(movimentarEstoqueSchema, dados)
export const validarQueryEstoque = (dados: unknown) => validarComSchema(listarEstoqueQuerySchema, dados)
export const validarQueryMovimentacoesEstoque = (dados: unknown) => validarComSchema(listarMovimentacoesEstoqueQuerySchema, dados)
