import { z } from "zod"

import { validarComSchema } from "./validation.js"

// Valida em conjunto a empresa, o plano escolhido e o administrador inicial.
// Campos de identificacao sao normalizados antes de chegar ao service.
export const criarEmpresaSchema = z
  .object({
    nome: z.string().trim().min(2).max(80),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: "Slug invalido"
      }),
    telefone: z
      .string()
      .transform(valor => valor.replace(/\D/g, ""))
      .refine(valor => valor.length >= 8 && valor.length <= 15, {
        message: "Telefone deve possuir entre 8 e 15 digitos"
      })
      .optional(),
    email: z
      .string()
      .trim()
      .min(1, { message: "O e-mail e obrigatorio." })
      .toLowerCase()
      .email({ message: "Formato de e-mail invalido." })
      .optional(),
    tipoNegocio: z.string().trim().min(2).max(80),
    cpfCnpj: z
      .string()
      .transform(valor => valor.replace(/\D/g, ""))
      .refine(valor => valor.length === 11 || valor.length === 14, {
        message: "CPF ou CNPJ deve possuir 11 ou 14 digitos"
      }),
    cidade: z.string().trim().min(2).max(80),
    estado: z
      .string()
      .trim()
      .toUpperCase()
      .length(2, { message: "Informe a sigla do estado" }),
    endereco: z.string().trim().max(200).optional(),
    planoCodigo: z.literal("servix-mensal"),
    aceitouTermos: z.boolean().refine(valor => valor, {
      message: "Aceite os Termos de Uso e a Politica de Privacidade"
    }),
    administrador: z
      .object({
        nome: z.string().trim().min(2).max(120),
        email: z
          .string()
          .trim()
          .min(1, { message: "O e-mail e obrigatorio." })
          .toLowerCase()
          .email({ message: "Formato de e-mail invalido." })
          .max(254),
        telefone: z
          .string()
          .transform(valor => valor.replace(/\D/g, ""))
          .refine(valor => valor.length >= 8 && valor.length <= 15, {
            message: "Telefone deve possuir entre 8 e 15 digitos"
          }),
        senha: z.string().min(8).max(120)
      })
      .strict()
  })
  .strict()

export type CriarEmpresaInput = z.infer<typeof criarEmpresaSchema>

export function validarCriacaoEmpresa(dados: unknown) {
  return validarComSchema(criarEmpresaSchema, dados)
}
