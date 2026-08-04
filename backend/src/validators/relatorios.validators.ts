import { z } from "zod"

import { validarComSchema } from "./validation.js"

const data = z.string().date().transform(valor => new Date(`${valor}T00:00:00.000Z`))

export const relatorioOperacionalQuerySchema = z.object({
  inicio: data.optional(),
  fim: data.optional()
}).strict().superRefine((dados, contexto) => {
  if (dados.inicio && dados.fim && dados.inicio > dados.fim) {
    contexto.addIssue({ code: "custom", path: ["fim"], message: "A data final deve ser posterior à inicial" })
  }
  if (dados.inicio && dados.fim) {
    const dias = (dados.fim.getTime() - dados.inicio.getTime()) / 86_400_000
    if (dias > 366) {
      contexto.addIssue({ code: "custom", path: ["fim"], message: "O período máximo é de 366 dias" })
    }
  }
})

export const validarQueryRelatorioOperacional = (dados: unknown) => validarComSchema(relatorioOperacionalQuerySchema, dados)
