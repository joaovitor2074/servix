import { z } from "zod"

import { validarComSchema } from "./validation.js"

// O schema valida e também normaliza slug e e-mail. `.strict()` rejeita campos
// extras, reduzindo a superfície de dados inesperados na autenticação.
export const loginSchema = z
  .object({
    empresaSlug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    email: z.string().trim().toLowerCase().email().max(254),
    senha: z.string().min(8).max(128)
  })
  .strict()

export type LoginInput = z.infer<typeof loginSchema>

// Controllers usam esta função para receber o ResultadoValidacao padronizado.
export function validarLogin(dados: unknown) {
  return validarComSchema(loginSchema, dados)
}
