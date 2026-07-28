import { beforeEach, describe, expect, it, vi } from "vitest"
import { StatusProcessamentoWebhook } from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  eventoFindMany: vi.fn(),
  eventoFindFirst: vi.fn(),
  assinaturaFindUnique: vi.fn(),
  assinaturaFindFirst: vi.fn(),
  processar: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    eventoWebhookAssinatura: {
      upsert: mocks.upsert,
      updateMany: mocks.updateMany,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      findMany: mocks.eventoFindMany,
      findFirst: mocks.eventoFindFirst
    },
    assinaturaEmpresa: {
      findUnique: mocks.assinaturaFindUnique,
      findFirst: mocks.assinaturaFindFirst
    }
  }
}))

vi.mock("./assinaturas.service.js", () => ({
  processarNotificacaoAssinaturaMercadoPagoService: mocks.processar
}))

import {
  processarEventoWebhookAssinaturaService,
  processarWebhooksAssinaturaPendentesService,
  reprocessarWebhookAssinaturaService,
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
  mocks.assinaturaFindUnique.mockResolvedValue({ id: 44, empresaId: 8 })
  mocks.assinaturaFindFirst.mockResolvedValue(null)
  mocks.eventoFindMany.mockResolvedValue([])
  mocks.eventoFindFirst.mockResolvedValue(null)
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
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 7,
        status: StatusProcessamentoWebhook.PROCESSANDO,
        ultimaTentativaEm: expect.any(Date)
      },
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
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 7,
        status: StatusProcessamentoWebhook.PROCESSANDO,
        ultimaTentativaEm: expect.any(Date)
      },
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

  it("inclui PROCESSANDO com lease vencida na varredura de recuperacao", async () => {
    await processarWebhooksAssinaturaPendentesService()

    expect(mocks.eventoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: expect.arrayContaining([
          expect.objectContaining({
            status: StatusProcessamentoWebhook.PROCESSANDO,
            OR: expect.arrayContaining([
              { ultimaTentativaEm: null },
              { ultimaTentativaEm: { lte: expect.any(Date) } }
            ])
          })
        ])
      }
    }))
  })

  it("nao deixa um worker com lease perdida sobrescrever o novo processamento", async () => {
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    mocks.processar.mockResolvedValue({ processada: true, empresaId: 8 })

    const resultado = await processarEventoWebhookAssinaturaService(7)

    expect(resultado).toEqual({ processado: false, leasePerdida: true })
  })

  it("associa a empresa identificavel mesmo quando o processamento falha", async () => {
    mocks.processar.mockRejectedValue(new Error("gateway indisponivel"))

    await processarEventoWebhookAssinaturaService(7)

    expect(mocks.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        empresaId: 8,
        assinaturaEmpresaId: 44,
        status: StatusProcessamentoWebhook.FALHA
      })
    }))
  })

  it("recusa reprocessamento manual enquanto o lease ainda esta ativo", async () => {
    mocks.eventoFindFirst.mockResolvedValue({
      id: 7,
      empresaId: 8,
      tipo: "subscription_preapproval",
      recursoId: "preapproval-123",
      status: StatusProcessamentoWebhook.PROCESSANDO,
      ultimaTentativaEm: new Date(Date.now() - 60_000)
    })

    await expect(reprocessarWebhookAssinaturaService(8, 7)).rejects.toMatchObject({
      statusCode: 409,
      codigo: "WEBHOOK_EM_PROCESSAMENTO"
    })
  })

  it("recupera manualmente um PROCESSANDO com lease vencida", async () => {
    const leaseAntiga = new Date(Date.now() - 6 * 60_000)
    mocks.eventoFindFirst.mockResolvedValue({
      id: 7,
      empresaId: 8,
      tipo: "subscription_preapproval",
      recursoId: "preapproval-123",
      status: StatusProcessamentoWebhook.PROCESSANDO,
      ultimaTentativaEm: leaseAntiga
    })
    mocks.processar.mockResolvedValue({ processada: true, empresaId: 8 })

    const resultado = await reprocessarWebhookAssinaturaService(8, 7)

    expect(resultado).toEqual({ processado: true, empresaId: 8 })
    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 7,
        status: StatusProcessamentoWebhook.PROCESSANDO,
        ultimaTentativaEm: leaseAntiga
      },
      data: expect.objectContaining({
        status: StatusProcessamentoWebhook.PENDENTE,
        tentativas: 0
      })
    })
  })

  it("associa com seguranca um evento legado sem empresa antes do reprocessamento", async () => {
    mocks.eventoFindFirst.mockResolvedValue({
      id: 7,
      empresaId: null,
      tipo: "subscription_preapproval",
      recursoId: "preapproval-123",
      status: StatusProcessamentoWebhook.FALHA,
      ultimaTentativaEm: new Date(Date.now() - 60_000)
    })
    mocks.assinaturaFindFirst.mockResolvedValue({ id: 44 })
    mocks.processar.mockResolvedValue({ processada: true, empresaId: 8 })

    const resultado = await reprocessarWebhookAssinaturaService(8, 7)

    expect(resultado).toEqual({ processado: true, empresaId: 8 })
    expect(mocks.assinaturaFindFirst).toHaveBeenCalledWith({
      where: {
        empresaId: 8,
        mercadoPagoAssinaturaId: "preapproval-123"
      },
      select: { id: true }
    })
    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 7, empresaId: null },
      data: { empresaId: 8, assinaturaEmpresaId: 44 }
    })
  })
})
