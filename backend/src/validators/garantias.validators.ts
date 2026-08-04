import { z } from "zod"

import { StatusGarantia } from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

export const listarGarantiasQuerySchema = z.object({
  busca: z.string().trim().max(120).optional(),
  status: z.enum([
    StatusGarantia.ATIVA,
    StatusGarantia.UTILIZADA,
    StatusGarantia.CANCELADA
  ]).optional()
}).strict()

export const acionarGarantiaSchema = z.object({
  observacao: z.string().trim().min(3).max(1000)
}).strict()

export const cancelarGarantiaSchema = z.object({
  observacao: z.string().trim().min(3).max(1000)
}).strict()

export const validarQueryGarantias = (dados: unknown) => validarComSchema(listarGarantiasQuerySchema, dados)
export const validarAcionamentoGarantia = (dados: unknown) => validarComSchema(acionarGarantiaSchema, dados)
export const validarCancelamentoGarantia = (dados: unknown) => validarComSchema(cancelarGarantiaSchema, dados)
