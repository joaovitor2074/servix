import type { Request, Response } from "express"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  validarAssinatura: vi.fn(),
  registrarWebhook: vi.fn(),
  processarEvento: vi.fn(),
  iniciarPorCheckout: vi.fn()
}))

vi.mock("mercadopago", () => ({
  InvalidWebhookSignatureError: class InvalidWebhookSignatureError extends Error {},
  WebhookSignatureValidator: { validate: mocks.validarAssinatura }
}))

vi.mock("../config/env.js", () => ({
  obterModoAssinaturasMercadoPago: vi.fn(() => "TESTE"),
  obterSegredoWebhookAssinaturasMercadoPago: vi.fn(() => "segredo-webhook")
}))

vi.mock("../billing/assinaturas.service.js", () => ({
  listarPlanosServixService: vi.fn()
}))

vi.mock("../services/assinaturas.service.js", () => ({
  buscarCheckoutPorTokenService: vi.fn(),
  buscarAssinaturaEmpresaService: vi.fn(),
  buscarPainelAssinaturaEmpresaService: vi.fn(),
  buscarPortalAssinaturaEmpresaService: vi.fn(),
  cancelarAssinaturaEmpresaService: vi.fn(),
  iniciarAssinaturaEmpresaService: vi.fn(),
  iniciarAssinaturaPorCheckoutTokenService: mocks.iniciarPorCheckout,
  reativarAssinaturaEmpresaService: vi.fn(),
  sincronizarAssinaturaPorCheckoutTokenService: vi.fn(),
  sincronizarAssinaturaEmpresaService: vi.fn()
}))

vi.mock("../services/webhooks-assinaturas.service.js", () => ({
  processarEventoWebhookAssinaturaService: mocks.processarEvento,
  registrarWebhookAssinaturaService: mocks.registrarWebhook,
  reprocessarWebhookAssinaturaService: vi.fn()
}))

import {
  confirmarCheckoutAssinaturaController,
  webhookAssinaturasMercadoPagoController
} from "./assinaturas.controllers.js"

describe("aceite dos Termos no checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.iniciarPorCheckout.mockResolvedValue({
      recuperada: false,
      assinatura: {
        checkoutUrl: "https://www.mercadopago.com.br/subscriptions/checkout",
        status: "PENDENTE"
      }
    })
  })

  it("rejeita uma versao dos Termos diferente da publicada pelo servidor", async () => {
    const req = {
      params: { token: "checkout-token" },
      body: {
        emailPagador: "comprador@testuser.com",
        versaoTermos: "2026-07-25",
        aceiteModoTeste: true
      }
    } as unknown as Request
    const next = vi.fn()

    await confirmarCheckoutAssinaturaController(
      req,
      {} as Response,
      next
    )

    expect(mocks.iniciarPorCheckout).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 409,
      codigo: "VERSAO_TERMOS_DESATUALIZADA"
    }))
  })

  it("encaminha a versao atual publicada pelo servidor", async () => {
    const req = {
      params: { token: "checkout-token" },
      body: {
        emailPagador: "comprador@testuser.com",
        versaoTermos: "2026-08-01",
        aceiteModoTeste: true
      }
    } as unknown as Request
    const json = vi.fn()
    const status = vi.fn(() => ({ json }))
    const next = vi.fn()

    await confirmarCheckoutAssinaturaController(
      req,
      { status } as unknown as Response,
      next
    )

    expect(next).not.toHaveBeenCalled()
    expect(mocks.iniciarPorCheckout).toHaveBeenCalledWith(
      "checkout-token",
      {
        emailPagador: "comprador@testuser.com",
        versaoTermos: "2026-08-01"
      }
    )
    expect(status).toHaveBeenCalledWith(201)
  })
})

describe("webhook de assinaturas do Mercado Pago", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.registrarWebhook.mockResolvedValue({
      id: 7,
      status: "PROCESSADO",
      duplicado: true
    })
  })

  it("usa como recurso somente o data.id autenticado da query", async () => {
    const req = {
      query: { "data.id": "preapproval-assinado" },
      body: {
        type: "subscription_preapproval",
        data: { id: "preapproval-divergente" }
      },
      header: vi.fn((nome: string) => ({
        "x-signature": "ts=123,v1=assinatura",
        "x-request-id": "request-123"
      })[nome])
    } as unknown as Request
    const sendStatus = vi.fn()
    const res = { sendStatus } as unknown as Response

    await webhookAssinaturasMercadoPagoController(req, res)

    expect(mocks.validarAssinatura).toHaveBeenCalledWith({
      xSignature: "ts=123,v1=assinatura",
      xRequestId: "request-123",
      dataId: "preapproval-assinado",
      secret: "segredo-webhook"
    })
    expect(mocks.registrarWebhook).toHaveBeenCalledWith({
      requestId: "request-123",
      tipo: "subscription_preapproval",
      recursoId: "preapproval-assinado"
    })
    expect(sendStatus).toHaveBeenCalledWith(200)
  })
})
