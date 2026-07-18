import { z } from "zod"

import { PapelUsuario } from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

const papelUsuarioSchema = z.enum([
  PapelUsuario.ADMIN,
  PapelUsuario.ATENDENTE,
  PapelUsuario.TECNICO
])

export const criarUsuarioSchema = z
  .object({
    nome: z.string().trim().min(2).max(120),

    email: z
      .string()
      .trim()
      .min(1, { message: "O e-mail é obrigatório." })
      .toLowerCase()
      .email({ message: "Formato de e-mail inválido." })
      .max(254),

    senha: z
      .string()
      .min(8, { message: "A senha deve possuir pelo menos 8 caracteres." })
      .max(128),

    papel: papelUsuarioSchema.default(PapelUsuario.ATENDENTE)
  })
  .strict()

export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>

export function validarCriacaoUsuario(dados: unknown) {
  return validarComSchema(criarUsuarioSchema, dados)
}