import { z } from 'zod'

// Campos opcionais vazios são convertidos em null, seguindo exatamente a
// normalização feita pelo backend e permitindo apagar valores durante a edição.
const textoOpcional = (limite: number) =>
  z.preprocess(
    valor =>
      typeof valor === 'string' && valor.trim() === '' ? null : valor,
    z.string().trim().max(limite).nullable(),
  )

const telefoneSchema = z
  .string()
  .transform(valor => valor.replace(/\D/g, ''))
  .refine(valor => valor.length >= 8 && valor.length <= 15, {
    message: 'Telefone deve possuir entre 8 e 15 dígitos',
  })

const cpfCnpjSchema = z.preprocess(
  valor => {
    if (typeof valor !== 'string' || valor.trim() === '') return null
    return valor.replace(/\D/g, '')
  },
  z
    .string()
    .refine(valor => valor.length === 11 || valor.length === 14, {
      message: 'CPF/CNPJ deve possuir 11 ou 14 dígitos',
    })
    .nullable(),
)

export const clienteSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe pelo menos 2 caracteres')
    .max(120, 'O nome deve possuir no máximo 120 caracteres'),
  telefone: telefoneSchema,
  email: z.preprocess(
    valor =>
      typeof valor === 'string' && valor.trim() === '' ? null : valor,
    z
      .string()
      .trim()
      .toLowerCase()
      .email('Informe um e-mail válido')
      .max(254)
      .nullable(),
  ),
  cpfCnpj: cpfCnpjSchema,
  endereco: textoOpcional(300),
  observacoes: textoOpcional(1000),
})

export type ClienteFormData = z.infer<typeof clienteSchema>
