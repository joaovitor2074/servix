import { z } from "zod"

import { StatusCobranca } from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

export const criarCobrancaSchema = z
  .object({
    orcamentoId: z.number().int().positive(),
    ordemId: z.number().int().positive().optional(),
    chaveIdempotencia: z
      .string()
      .trim()
      .min(8)
      .max(120)
      .regex(/^[A-Za-z0-9._:-]+$/, {
        message: "Chave de idempotencia invalida"
      })
  })
  .strict()

export const chaveIdempotenciaPublicaSchema = z
  .string()
  .trim()
  .min(8)
  .max(120)
  .regex(/^[A-Za-z0-9._:-]+$/, {
    message: "Chave de idempotencia invalida"
  })

export const listarCobrancasSchema = z
  .object({
    status: z
      .enum([
        StatusCobranca.PENDENTE,
        StatusCobranca.PAGA,
        StatusCobranca.EXPIRADA,
        StatusCobranca.CANCELADA,
        StatusCobranca.ESTORNADA
      ])
      .optional(),
    ordemId: z.coerce.number().int().positive().optional(),
    orcamentoId: z.coerce.number().int().positive().optional(),
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20)
  })
  .strict()

export type CriarCobrancaInput = z.infer<typeof criarCobrancaSchema>
export type ListarCobrancasInput = z.infer<typeof listarCobrancasSchema>

export function validarCriacaoCobranca(dados: unknown) {
  return validarComSchema(criarCobrancaSchema, dados)
}

export function validarChaveIdempotenciaPublica(dados: unknown) {
  return validarComSchema(chaveIdempotenciaPublicaSchema, dados)
}

export function validarListagemCobrancas(dados: unknown) {
  return validarComSchema(listarCobrancasSchema, dados)
}

export function idCobrancaEhInvalido(id: number): boolean {
  return !Number.isInteger(id) || id <= 0
}
