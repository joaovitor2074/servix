import { z } from "zod"

import {
  FormaPagamento,
  StatusOrdem
} from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

// Os enums vêm do Prisma para que banco, regra de negócio e validação aceitem
// exatamente o mesmo conjunto de valores.
const statusSchema = z.enum([
  StatusOrdem.ABERTA,
  StatusOrdem.EM_ANALISE,
  StatusOrdem.AGUARDANDO_APROVACAO,
  StatusOrdem.APROVADA,
  StatusOrdem.EM_ANDAMENTO,
  StatusOrdem.AGUARDANDO_PECA,
  StatusOrdem.CONCLUIDA,
  StatusOrdem.ENTREGUE,
  StatusOrdem.CANCELADA
])

const formaPagamentoSchema = z.enum([
  FormaPagamento.PIX,
  FormaPagamento.DINHEIRO,
  FormaPagamento.CARTAO_CREDITO,
  FormaPagamento.CARTAO_DEBITO,
  FormaPagamento.BOLETO,
  FormaPagamento.NAO_INFORMADA,
  FormaPagamento.OUTRO
])

// Schemas menores são reutilizados entre criação e atualização.
const textoObrigatorio = z.string().trim().min(1).max(500)

const textoOpcional = (limite: number) =>
  z.preprocess(
    valor => valor === "" ? null : valor,
    z.string().trim().max(limite).nullable().optional()
  )

// Datas chegam como texto ISO com fuso e são transformadas em Date para o Prisma.
const dataOpcional = z.preprocess(
  valor => valor === "" ? null : valor,
  z
    .string()
    .datetime({ offset: true })
    .transform(valor => new Date(valor))
    .nullable()
    .optional()
)

// Fonte única das regras dos campos editáveis de uma ordem.
const camposEditaveis = {
  equipamento: textoObrigatorio,
  problemaRelatado: z.string().trim().min(1).max(2000),
  diagnostico: textoOpcional(4000),
  servicoRealizado: textoOpcional(4000),
  pecasUtilizadas: textoOpcional(4000),
  tecnicoResponsavel: textoOpcional(120),
  previsaoDeEntrega: dataOpcional,
  valor: z.number().finite().min(0).max(99999999.99),
  formaDePagamento: formaPagamentoSchema,
  status: statusSchema
}

// Uma nova ordem sempre começa ABERTA; valor e pagamento possuem padrões.
export const criarOrdemSchema = z
  .object({
    clienteId: z.number().int().positive(),
    ...camposEditaveis,
    valor: camposEditaveis.valor.default(0),
    formaDePagamento: formaPagamentoSchema.default(
      FormaPagamento.NAO_INFORMADA
    ),
    status: z.literal(StatusOrdem.ABERTA).default(StatusOrdem.ABERTA)
  })
  .strict()

// Na atualização, todos os campos são opcionais, mas o corpo não pode ser vazio.
export const atualizarOrdemSchema = z
  .object({
    clienteId: z.number().int().positive().optional(),
    equipamento: camposEditaveis.equipamento.optional(),
    problemaRelatado: camposEditaveis.problemaRelatado.optional(),
    diagnostico: camposEditaveis.diagnostico,
    servicoRealizado: camposEditaveis.servicoRealizado,
    pecasUtilizadas: camposEditaveis.pecasUtilizadas,
    tecnicoResponsavel: camposEditaveis.tecnicoResponsavel,
    previsaoDeEntrega: camposEditaveis.previsaoDeEntrega,
    valor: camposEditaveis.valor.optional(),
    formaDePagamento: camposEditaveis.formaDePagamento.optional(),
    status: camposEditaveis.status.optional()
  })
  .strict()
  .refine(dados => Object.keys(dados).length > 0, {
    message: "Informe ao menos um campo para atualização"
  })

// Contrato reduzido para a rota dedicada exclusivamente ao status.
export const alterarStatusSchema = z
  .object({
    status: statusSchema
  })
  .strict()

// Filtros de URL são convertidos e recebem limites seguros de paginação.
export const listarOrdensQuerySchema = z
  .object({
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    busca: z.string().trim().max(120).optional(),
    status: statusSchema.optional(),
    clienteId: z.coerce.number().int().positive().optional()
  })
  .strict()

export type CriarOrdemInput = z.infer<typeof criarOrdemSchema>
export type AtualizarOrdemInput = z.infer<typeof atualizarOrdemSchema>
export type ListarOrdensQuery = z.infer<typeof listarOrdensQuerySchema>

export function validarCriacaoOrdem(dados: unknown) {
  return validarComSchema(criarOrdemSchema, dados)
}

export function validarAtualizacaoOrdem(dados: unknown) {
  return validarComSchema(atualizarOrdemSchema, dados)
}

export function validarAlteracaoStatus(dados: unknown) {
  return validarComSchema(alterarStatusSchema, dados)
}

export function validarQueryOrdens(dados: unknown) {
  return validarComSchema(listarOrdensQuerySchema, dados)
}

// Mantém IDs inválidos longe da camada de banco.
export function idEhInvalido(id: number): boolean {
  return !Number.isInteger(id) || id <= 0
}
