import { z } from "zod"

import { validarComSchema } from "./validation.js"

const textoOpcional = (limite: number) =>
  z.preprocess(
    valor => valor === "" ? null : valor,
    z.string().trim().max(limite).nullable().optional()
  )

const telefoneSchema = z
  .string()
  .transform(valor => valor.replace(/\D/g, ""))
  .refine(valor => valor.length >= 8 && valor.length <= 15, {
    message: "Telefone deve possuir entre 8 e 15 dígitos"
  })

const cpfCnpjSchema = z.preprocess(
  valor => {
    if (valor === "" || valor === null || valor === undefined) {
      return null
    }

    return typeof valor === "string"
      ? valor.replace(/\D/g, "")
      : valor
  },
  z
    .string()
    .refine(valor => valor.length === 11 || valor.length === 14, {
      message: "CPF/CNPJ deve possuir 11 ou 14 dígitos"
    })
    .nullable()
    .optional()
)

export const criarClienteSchema = z
  .object({
    nome: z.string().trim().min(2).max(120),
    telefone: telefoneSchema,
    email: z.preprocess(
      valor => valor === "" ? null : valor,
      z.string().trim().toLowerCase().email().max(254).nullable().optional()
    ),
    cpfCnpj: cpfCnpjSchema,
    endereco: textoOpcional(300),
    observacoes: textoOpcional(1000)
  })
  .strict()

export const atualizarClienteSchema = criarClienteSchema
  .partial()
  .refine(dados => Object.keys(dados).length > 0, {
    message: "Informe ao menos um campo para atualização"
  })

export const listarClientesQuerySchema = z
  .object({
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    busca: z.string().trim().max(120).optional()
  })
  .strict()

export type CriarClienteInput = z.infer<typeof criarClienteSchema>
export type AtualizarClienteInput = z.infer<typeof atualizarClienteSchema>
export type ListarClientesQuery = z.infer<typeof listarClientesQuerySchema>

export function validarCriacaoCliente(dados: unknown) {
  return validarComSchema(criarClienteSchema, dados)
}

export function validarAtualizacaoCliente(dados: unknown) {
  return validarComSchema(atualizarClienteSchema, dados)
}

export function validarQueryClientes(dados: unknown) {
  return validarComSchema(listarClientesQuerySchema, dados)
}

export function idEhInvalido(id: number): boolean {
  return !Number.isInteger(id) || id <= 0
}
