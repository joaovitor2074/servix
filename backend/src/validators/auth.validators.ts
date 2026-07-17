import { z } from "zod"

import { validarComSchema } from "./validation.js"

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

export function validarLogin(dados: unknown) {
  return validarComSchema(loginSchema, dados)
}
