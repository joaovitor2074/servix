import { z } from "zod";

import { validarComSchema } from "./validation.js";

// Valida em conjunto a empresa e o administrador inicial. Slug e e-mails são
// normalizados para minúsculas antes de chegarem ao service.
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
                message: "Slug inválido"
            }),
        telefone: z
            .string()
            .transform(valor => valor.replace(/\D/g, ""))
            .refine(valor => valor.length >= 8 && valor.length <= 15, {
                message: "Telefone deve possuir entre 8 e 15 dígitos"
            })
            .optional(),
        email: z.string()
        .trim()
            .min(1, { message: 'O e-mail é obrigatório.' })
            .toLowerCase()
            .email({ message: 'Formato de e-mail inválido.' })
            .optional(),
        administrador: z.object({
            nome: z.string().trim().min(2).max(120),
email: z
  .string()
  .trim()
  .min(1, { message: "O e-mail é obrigatório." })
  .toLowerCase()
  .email({ message: "Formato de e-mail inválido." })
  .max(254),
              senha: z.string().min(8).max(120)
        }).strict()
    }).strict()

export type CriarEmpresaInput = z.infer<typeof criarEmpresaSchema>

// Mantém o mesmo formato de sucesso/erro utilizado pelos demais controllers.
export function validarCriacaoEmpresa(dados: unknown) {
    return validarComSchema(criarEmpresaSchema, dados)
}
