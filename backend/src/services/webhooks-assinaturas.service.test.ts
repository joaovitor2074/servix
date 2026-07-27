import { beforeEach, describe, expect, it, vi } from "vitest"
import { StatusProcessamentoWebhook } from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  update: vi.fn(),
  assinaturaFindUnique: vi.fn(),
  processar: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    eventoWebhookAssinatura: {
      upsert: mocks.upsert,
      updateMany: mocks.updateMany,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      update: mocks.update,
      findMany: vi.fn(),
      findFirst: vi.fn()
    },
    assinaturaEmpresa: {
      findUnique: mocks.assinaturaFindUnique
    }
  }
}))

vi.mock("./assinaturas.service.js", () => ({
  processarNotificacaoAssinaturaMercadoPagoService: mocks.processar
}))

import {
  processarEventoWebhookAssinaturaService,
  registrarWebhookAssinaturaService
} from "./webhooks-assinaturas.service.js"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.upsert.mockResolvedValue({
    id: 7,
    status: StatusProcessamentoWebhook.PENDENTE,
    tentativas: 0
  })
  mocks.updateMany.mockResolvedValue({ count: 1 })
  mocks.findUniqueOrThrow.mockResolvedValue({
    id: 7,
    tipo: "subscription_preapproval",
    recursoId: "preapproval-123",
    tentativas: 1,
    alertaEmitidoEm: null
  })
  mocks.assinaturaFindUnique.mockResolvedValue({ id: 44 })
})

describe("caixa de entrada dos webhooks de assinatura", () => {
  it("registra somente metadados idempotentes e agenda o processamento", async () => {
    await registrarWebhookAssinaturaService({
      requestId: "request-abc",
      tipo: "subscription_preapproval",
      recursoId: "preapproval-123"
    })

    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { requestId: "request-abc" },
      update: {},
      create: expect.objectContaining({
        tipo: "subscription_preapproval",
        recursoId: "preapproval-123",
        status: StatusProcessamentoWebhook.PENDENTE
      })
    }))
  })

  it("associa e conclui o evento depois de consultar a fonte oficial", async () => {
    mocks.processar.mockResolvedValue({ processada: true, empresaId: 8 })

    const resultado = await processarEventoWebhookAssinaturaService(7)

    expect(resultado).toEqual({ processado: true, empresaId: 8 })
    expect(mocks.update).toHaveBeenLastCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        empresaId: 8,
        assinaturaEmpresaId: 44,
        status: StatusProcessamentoWebhook.PROCESSADO,
        ultimoErro: null
      })
    })
  })

  it("agenda nova tentativa e emite alerta estruturado apos falhas repetidas", async () => {
    mocks.findUniqueOrThrow.mockResolvedValue({
      id: 7,
      tipo: "subscription_preapproval",
      recursoId: "preapproval-123",
      tentativas: 3,
      alertaEmitidoEm: null
    })
    mocks.processar.mockRejectedValue(new Error("falha\nsegura"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const resultado = await processarEventoWebhookAssinaturaService(7)

    expect(resultado).toEqual({ processado: false, erro: "falha segura" })
    expect(mocks.update).toHaveBeenLastCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        status: StatusProcessamentoWebhook.FALHA,
        ultimoErro: "falha segura",
        proximaTentativaEm: expect.any(Date),
        alertaEmitidoEm: expect.any(Date)
      })
    })
    expect(consoleError).toHaveBeenCalledWith(
      "ALERTA_WEBHOOK_ASSINATURA_FALHANDO",
      expect.objectContaining({ eventoId: 7, tentativas: 3 })
    )
    consoleError.mockRestore()
  })
})
