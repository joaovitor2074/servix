import { z } from "zod"
import { ModoEnvioWhatsApp } from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

const telefone = z.preprocess(
  valor => typeof valor === "string" && valor.trim() === "" ? null : valor,
  z.string().transform(valor => valor.replace(/\D/g, "")).refine(
    valor => valor.length >= 10 && valor.length <= 15,
    { message: "Informe um telefone com DDD e código do país quando necessário" }
  ).nullable().optional()
)

const template = z.string().trim().min(10).max(1200)

export const atualizarConfiguracaoWhatsAppSchema = z.object({
  versaoEsperada: z.number().int().positive(),
  ativo: z.boolean(),
  modoEnvio: z.enum([
    ModoEnvioWhatsApp.LINK_MANUAL,
    ModoEnvioWhatsApp.CLOUD_API
  ]),
  telefoneEmpresa: telefone,
  incluirLink: z.boolean(),
  templateOrcamento: template,
  templateRecebido: template,
  templateEmAnalise: template,
  templateEmExecucao: template,
  templateAguardandoPeca: template,
  templatePronto: template,
  templateEntregue: template,
  templateGarantia: template,
  apiPhoneNumberId: z.preprocess(
    valor => typeof valor === "string" && valor.trim() === "" ? null : valor,
    z.string().trim().regex(/^\d{5,80}$/, "Informe somente os números do Phone Number ID").nullable().optional()
  ),
  apiBusinessAccountId: z.preprocess(
    valor => typeof valor === "string" && valor.trim() === "" ? null : valor,
    z.string().trim().regex(/^\d{5,80}$/, "Informe somente os números do Business Account ID").nullable().optional()
  ),
  apiAccessToken: z.preprocess(valor => valor === "" ? undefined : valor, z.string().trim().min(20).max(4000).optional()),
  removerApiAccessToken: z.boolean().optional()
}).strict()

export const prepararMensagemWhatsAppSchema = z.object({
  origem: z.enum(["ORDEM", "ORCAMENTO", "GARANTIA"]),
  referenciaId: z.number().int().positive()
}).strict()

export type AtualizarConfiguracaoWhatsAppInput = z.infer<typeof atualizarConfiguracaoWhatsAppSchema>
export type PrepararMensagemWhatsAppInput = z.infer<typeof prepararMensagemWhatsAppSchema>

export const validarAtualizacaoConfiguracaoWhatsApp = (dados: unknown) => validarComSchema(atualizarConfiguracaoWhatsAppSchema, dados)
export const validarPreparacaoMensagemWhatsApp = (dados: unknown) => validarComSchema(prepararMensagemWhatsAppSchema, dados)
