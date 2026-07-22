import { z } from "zod"

import {
  StatusOrcamento,
  TipoItemOrcamento
} from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

const statusSchema = z.enum([
  StatusOrcamento.RASCUNHO,
  StatusOrcamento.ENVIADO,
  StatusOrcamento.APROVADO,
  StatusOrcamento.REJEITADO,
  StatusOrcamento.EXPIRADO,
  StatusOrcamento.CONVERTIDO,
  StatusOrcamento.CANCELADO
])

// Aprovação e rejeição pertencem ao cliente pelo link público. O endpoint
// autenticado limita-se às ações operacionais da empresa; CONVERTIDO continua
// reservado à transformação que cria a ordem na mesma transação.
const proximoStatusInternoSchema = z.enum([
  StatusOrcamento.RASCUNHO,
  StatusOrcamento.ENVIADO,
  StatusOrcamento.CANCELADO
])

const tipoItemSchema = z.enum([
  TipoItemOrcamento.SERVICO,
  TipoItemOrcamento.PECA,
  TipoItemOrcamento.MATERIAL
])

const dinheiroSchema = z
  .number()
  .finite()
  .min(0)
  .max(9999999999.99)
  .multipleOf(0.01)

const textoObrigatorio = (limite: number) =>
  z.string().trim().min(1).max(limite)

const textoOpcional = (limite: number) =>
  z.preprocess(
    valor => valor === "" ? null : valor,
    z.string().trim().max(limite).nullable().optional()
  )

const dataOpcional = z.preprocess(
  valor => valor === "" ? null : valor,
  z
    .string()
    .datetime({ offset: true })
    .transform(valor => new Date(valor))
    .nullable()
    .optional()
)

const itemSchema = z
  .object({
    descricao: textoObrigatorio(500),
    quantidade: z.number().int().positive().max(1_000_000),
    valorUnitario: dinheiroSchema,
    tipo: tipoItemSchema
  })
  .strict()

const itensSchema = z.array(itemSchema).min(1).max(100)

const controleConcorrencia = {
  statusEsperado: statusSchema,
  versaoEsperada: z.number().int().positive()
}

export const criarOrcamentoSchema = z
  .object({
    clienteId: z.number().int().positive(),
    equipamento: textoObrigatorio(500),
    descricaoProblema: textoObrigatorio(2000),
    itens: itensSchema,
    desconto: dinheiroSchema.default(0),
    validade: dataOpcional,
    observacoes: textoOpcional(4000)
  })
  .strict()

export const atualizarOrcamentoSchema = z
  .object({
    ...controleConcorrencia,
    clienteId: z.number().int().positive().optional(),
    equipamento: textoObrigatorio(500).optional(),
    descricaoProblema: textoObrigatorio(2000).optional(),
    itens: itensSchema.optional(),
    desconto: dinheiroSchema.optional(),
    validade: dataOpcional,
    observacoes: textoOpcional(4000)
  })
  .strict()
  .refine(
    ({ statusEsperado: _status, versaoEsperada: _versao, ...campos }) =>
      Object.keys(campos).length > 0,
    { message: "Informe ao menos um campo para atualizacao" }
  )

export const alterarStatusOrcamentoSchema = z
  .object({
    ...controleConcorrencia,
    status: proximoStatusInternoSchema,
    observacao: textoOpcional(1000)
  })
  .strict()

export const transformarOrcamentoSchema = z
  .object({
    statusEsperado: z.literal(StatusOrcamento.APROVADO),
    versaoEsperada: z.number().int().positive()
  })
  .strict()

export const acaoPublicaOrcamentoSchema = z
  .object({
    versaoEsperada: z.number().int().positive()
  })
  .strict()

export const listarOrcamentosQuerySchema = z
  .object({
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    busca: z.string().trim().max(120).optional(),
    status: statusSchema.optional(),
    clienteId: z.coerce.number().int().positive().optional()
  })
  .strict()

export type CriarOrcamentoInput = z.infer<typeof criarOrcamentoSchema>
export type AtualizarOrcamentoInput = z.infer<typeof atualizarOrcamentoSchema>
export type AlterarStatusOrcamentoInput = z.infer<
  typeof alterarStatusOrcamentoSchema
>
export type TransformarOrcamentoInput = z.infer<
  typeof transformarOrcamentoSchema
>
export type AcaoPublicaOrcamentoInput = z.infer<
  typeof acaoPublicaOrcamentoSchema
>
export type ListarOrcamentosQuery = z.infer<
  typeof listarOrcamentosQuerySchema
>

export function validarCriacaoOrcamento(dados: unknown) {
  return validarComSchema(criarOrcamentoSchema, dados)
}

export function validarAtualizacaoOrcamento(dados: unknown) {
  return validarComSchema(atualizarOrcamentoSchema, dados)
}

export function validarAlteracaoStatusOrcamento(dados: unknown) {
  return validarComSchema(alterarStatusOrcamentoSchema, dados)
}

export function validarTransformacaoOrcamento(dados: unknown) {
  return validarComSchema(transformarOrcamentoSchema, dados)
}

export function validarAcaoPublicaOrcamento(dados: unknown) {
  return validarComSchema(acaoPublicaOrcamentoSchema, dados)
}

export function validarQueryOrcamentos(dados: unknown) {
  return validarComSchema(listarOrcamentosQuerySchema, dados)
}

export function idOrcamentoEhInvalido(id: number): boolean {
  return !Number.isInteger(id) || id <= 0
}

export function tokenOrcamentoEhInvalido(token: unknown): boolean {
  return typeof token !== "string" || token.trim().length < 16 || token.length > 100
}
