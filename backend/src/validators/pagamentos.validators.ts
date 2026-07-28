import { z } from "zod"

import {
  FormaPagamento,
  StatusOrdem
} from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

const statusOrdemSchema = z.enum([
  StatusOrdem.RECEBIDO,
  StatusOrdem.EM_ANALISE,
  StatusOrdem.EM_EXECUCAO,
  StatusOrdem.AGUARDANDO_PECA,
  StatusOrdem.PRONTO,
  StatusOrdem.ENTREGUE,
  StatusOrdem.CANCELADO
])

// Um pagamento efetivamente registrado precisa informar a forma utilizada.
// NAO_INFORMADA continua disponivel para dados legados, mas nao para a API.
const formaPagamentoRegistradaSchema = z.enum([
  FormaPagamento.DINHEIRO,
  FormaPagamento.CARTAO_CREDITO,
  FormaPagamento.CARTAO_DEBITO,
  FormaPagamento.BOLETO,
  FormaPagamento.OUTRO
])

const controleConcorrenciaSchema = {
  statusEsperado: statusOrdemSchema,
  versaoEsperada: z.number().int().positive()
}

const textoOpcional = z.preprocess(
  valor => valor === "" ? undefined : valor,
  z.string().trim().min(1).max(500).optional()
)

const pagoEmOpcional = z.preprocess(
  valor => valor === "" ? undefined : valor,
  z
    .string()
    .datetime({ offset: true })
    .transform(valor => new Date(valor))
    .optional()
)

export const registrarPagamentoSchema = z
  .object({
    ...controleConcorrenciaSchema,
    valor: z
      .number()
      .finite()
      .positive()
      .max(99999999.99)
      .multipleOf(0.01),
    formaPagamento: formaPagamentoRegistradaSchema,
    pagoEm: pagoEmOpcional,
    observacao: textoOpcional
  })
  .strict()

export const estornarPagamentoSchema = z
  .object({
    ...controleConcorrenciaSchema,
    motivo: z.string().trim().min(3).max(500)
  })
  .strict()

export type RegistrarPagamentoInput = z.infer<
  typeof registrarPagamentoSchema
>
export type EstornarPagamentoInput = z.infer<
  typeof estornarPagamentoSchema
>

export function validarRegistroPagamento(dados: unknown) {
  return validarComSchema(registrarPagamentoSchema, dados)
}

export function validarEstornoPagamento(dados: unknown) {
  return validarComSchema(estornarPagamentoSchema, dados)
}

export function idPagamentoEhInvalido(id: number): boolean {
  return !Number.isInteger(id) || id <= 0
}
