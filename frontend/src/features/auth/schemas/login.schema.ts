import { z } from 'zod'

export const loginSchema = z.object({
  empresaSlug: z
    .string()
    .trim()
    .min(2, 'Informe a empresa')
    .max(80, 'Nome da empresa muito longo')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Use apenas letras minúsculas, números e hífens',
    ),

  email: z
    .string()
    .trim()
    .email('Informe um e-mail válido')
    .max(254, 'E-mail muito longo'),

  senha: z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .max(128, 'Senha muito longa'),
})

export type LoginFormData = z.infer<typeof loginSchema>