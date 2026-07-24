import { z } from "zod"

import { PapelUsuario } from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

// O papel aceito deriva do enum do banco, evitando strings arbitrárias.
const papelUsuarioSchema = z.enum([
  PapelUsuario.ADMIN,
  PapelUsuario.ATENDENTE,
  PapelUsuario.TECNICO
])

// Normaliza o e-mail, valida a senha e usa ATENDENTE como papel padrão.
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

// A senha não pode ser alterada por esta rota. Os outros campos ficam opcionais,
// mas pelo menos um deles precisa ser enviado.
export const atualizarUsuarioSchema = criarUsuarioSchema
  .omit({ senha: true })
  .partial()
  .extend({ papel: papelUsuarioSchema.optional() })
  .refine(dados => Object.keys(dados).length > 0, {
    message: "Informe ao menos um campo para atualização"
  })
// Query strings chegam como texto; `coerce` faz a conversão da paginação.
export const listarUsuarioQuerySchema = z
  .object({
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    busca: z.string().trim().max(120).optional()
  })
  .strict()

// O endpoint de situação da conta aceita somente um booleano `ativo`.
export const alterarAtivoUsuarioSchema = z
  .object({
    ativo: z.boolean()
  })
  .strict()

export type AlterarAtivoUsuarioInput = z.infer<typeof alterarAtivoUsuarioSchema>
export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>
export type ListarUsuarioQuery = z.infer<typeof listarUsuarioQuerySchema>
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>

export function validarAlteracaoAtivoUsuario(dados: unknown) {
  return validarComSchema(alterarAtivoUsuarioSchema, dados)
}

export function validarAtualizacaoUsuario(dados: unknown) {
  return validarComSchema(atualizarUsuarioSchema, dados)
}

export function validarCriacaoUsuario(dados: unknown) {
  return validarComSchema(criarUsuarioSchema, dados)
}

export function validarQueryUsuarios(dados:unknown){
  return validarComSchema(listarUsuarioQuerySchema,dados)
}
