import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../config/env.js", () => ({
  obterConfiguracaoAssinaturasMercadoPago: () => ({
    status: "CONFIGURADA" as const,
    modo: "TESTE" as const,
    accessToken: "token-seguro-de-teste",
    publicKey: null,
    planId: null,
    backUrl: "https://servix.test",
    timeoutMs: 8000
  })
}))

import {
  cancelarAssinaturaMercadoPago,
  criarAssinaturaMercadoPago,
  ErroMercadoPagoAssinaturas
} from "./mercado-pago-assinaturas.client.js"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("cliente de assinaturas Mercado Pago", () => {
  it("cria checkout pendente sem receber dados de cartao", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "preapproval-123",
      status: "pending",
      external_reference: "servix_empresa_42",
      init_point: "https://www.mercadopago.com.br/subscriptions/checkout?id=123"
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    }))
    vi.stubGlobal("fetch", fetchMock)

    await criarAssinaturaMercadoPago({
      emailPagador: "comprador@testuser.com",
      referenciaExterna: "servix_empresa_42",
      transactionAmount: 79.9,
      currencyId: "BRL",
      backUrl: "https://servix.test/cadastro/concluido?checkout=uuid"
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body)) as Record<string, unknown>

    expect(url).toBe("https://api.mercadopago.com/preapproval")
    expect(init.method).toBe("POST")
    expect(body).toMatchObject({
      reason: "Servix - Plano mensal",
      external_reference: "servix_empresa_42",
      payer_email: "comprador@testuser.com",
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 79.9,
        currency_id: "BRL"
      }
    })
    expect(body).not.toHaveProperty("card_token_id")
    expect(body).not.toHaveProperty("preapproval_plan_id")
  })

  it("preserva o request id de uma falha do provedor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: "Internal server error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "x-request-id": "request-123"
        }
      }
    )))

    const erro = await criarAssinaturaMercadoPago({
      emailPagador: "comprador@testuser.com",
      referenciaExterna: "servix_empresa_42",
      transactionAmount: 79.9,
      currencyId: "BRL",
      backUrl: "https://servix.test/cadastro/concluido?checkout=uuid"
    }).catch(error => error)

    expect(erro).toBeInstanceOf(ErroMercadoPagoAssinaturas)
    expect(erro).toMatchObject({
      statusHttp: 500,
      codigo: "MERCADO_PAGO_HTTP_500",
      requestId: "request-123"
    })
    expect(erro.message).not.toContain("token do cartão")
  })

  it("cancela a recorrência usando o identificador do preapproval", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "preapproval-123",
      status: "cancelled"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }))
    vi.stubGlobal("fetch", fetchMock)

    const assinatura = await cancelarAssinaturaMercadoPago("preapproval-123")

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      "https://api.mercadopago.com/preapproval/preapproval-123"
    )
    expect(init.method).toBe("PUT")
    expect(JSON.parse(String(init.body))).toEqual({ status: "cancelled" })
    expect(assinatura.status).toBe("cancelled")
  })
})
