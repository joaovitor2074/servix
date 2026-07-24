import { z } from "zod"

import {
  AmbientePagamento,
  ProvedorPagamento
} from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

const provedorSchema = z.enum([
  ProvedorPagamento.MANUAL,
  ProvedorPagamento.SIMULADO,
  ProvedorPagamento.MERCADO_PAGO,
  ProvedorPagamento.ASAAS
])

const ambienteSchema = z.enum([
  AmbientePagamento.TESTE,
  AmbientePagamento.PRODUCAO
])

export const atualizarConfiguracaoPagamentoSchema = z
  .object({
    versaoEsperada: z.number().int().positive(),
    provedor: provedorSchema.optional(),
    ambiente: ambienteSchema.optional(),
    ativo: z.boolean().optional(),
    pixHabilitado: z.boolean().optional()
  })
  .strict()
  .refine(
    dados =>
      dados.provedor !== undefined ||
      dados.ambiente !== undefined ||
      dados.ativo !== undefined ||
      dados.pixHabilitado !== undefined,
    { message: "Informe ao menos uma configuracao para atualizar" }
  )

export type AtualizarConfiguracaoPagamentoInput = z.infer<
  typeof atualizarConfiguracaoPagamentoSchema
>

export function validarAtualizacaoConfiguracaoPagamento(dados: unknown) {
  return validarComSchema(atualizarConfiguracaoPagamentoSchema, dados)
}

