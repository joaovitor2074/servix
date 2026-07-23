import { z } from "zod"

import { validarComSchema } from "./validation.js"

const tokenCheckoutSchema = z.string().uuid()

const confirmarAssinaturaTesteSchema = z
  .object({
    aceiteModoTeste: z.literal(true)
  })
  .strict()

export function validarTokenCheckout(valor: unknown) {
  return validarComSchema(tokenCheckoutSchema, valor)
}

export function validarConfirmacaoAssinaturaTeste(dados: unknown) {
  return validarComSchema(confirmarAssinaturaTesteSchema, dados)
}
