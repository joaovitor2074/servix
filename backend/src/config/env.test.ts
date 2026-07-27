import { afterEach, describe, expect, it, vi } from "vitest"

import {
  obterConfiguracaoAssinaturasMercadoPago,
  obterConfiguracaoOAuthMercadoPago,
  obterSegredoWebhookAssinaturasMercadoPago
} from "./env.js"

const chave = Buffer.alloc(32, 9).toString("base64")

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("separacao de ambientes do Mercado Pago", () => {
  it("mantem compatibilidade com nomes legados somente em TESTE", () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "TESTE")
    vi.stubEnv("SERVIX_SUBSCRIPTIONS_MP_MODE", "TESTE")
    vi.stubEnv("MERCADO_PAGO_SUBSCRIPTIONS_ACCESS_TOKEN", "token-legado-teste")
    vi.stubEnv("MERCADO_PAGO_SUBSCRIPTIONS_BACK_URL", "https://teste.servix.test")

    expect(obterConfiguracaoAssinaturasMercadoPago()).toMatchObject({
      status: "CONFIGURADA",
      modo: "TESTE",
      accessToken: "token-legado-teste"
    })
  })

  it("PRODUCAO nunca reutiliza credenciais legadas ou de TESTE", () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "PRODUCAO")
    vi.stubEnv("SERVIX_SUBSCRIPTIONS_MP_MODE", "PRODUCAO")
    vi.stubEnv("MERCADO_PAGO_SUBSCRIPTIONS_ACCESS_TOKEN", "token-legado-teste")
    vi.stubEnv("MERCADO_PAGO_SUBSCRIPTIONS_TESTE_ACCESS_TOKEN", "token-teste")
    vi.stubEnv("MERCADO_PAGO_SUBSCRIPTIONS_TESTE_BACK_URL", "https://teste.servix.test")

    expect(obterConfiguracaoAssinaturasMercadoPago()).toMatchObject({
      status: "ERRO"
    })
  })

  it("seleciona apenas o namespace de PRODUCAO das assinaturas", () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "PRODUCAO")
    vi.stubEnv("SERVIX_SUBSCRIPTIONS_MP_MODE", "PRODUCAO")
    vi.stubEnv("MERCADO_PAGO_SUBSCRIPTIONS_PRODUCAO_ACCESS_TOKEN", "token-producao")
    vi.stubEnv("MERCADO_PAGO_SUBSCRIPTIONS_PRODUCAO_BACK_URL", "https://app.servix.test")

    expect(obterConfiguracaoAssinaturasMercadoPago()).toMatchObject({
      status: "CONFIGURADA",
      modo: "PRODUCAO",
      accessToken: "token-producao"
    })
  })

  it("rejeita modos divergentes entre billing e provedor", () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "TESTE")
    vi.stubEnv("SERVIX_SUBSCRIPTIONS_MP_MODE", "PRODUCAO")

    expect(obterConfiguracaoAssinaturasMercadoPago()).toMatchObject({
      status: "ERRO"
    })
  })

  it("usa segredo de webhook exclusivo de PRODUCAO", () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "PRODUCAO")
    vi.stubEnv("SERVIX_SUBSCRIPTIONS_MP_MODE", "PRODUCAO")
    vi.stubEnv("MERCADO_PAGO_SUBSCRIPTIONS_WEBHOOK_SECRET", "segredo-teste")
    vi.stubEnv("MERCADO_PAGO_SUBSCRIPTIONS_PRODUCAO_WEBHOOK_SECRET", "segredo-producao")

    expect(obterSegredoWebhookAssinaturasMercadoPago()).toBe("segredo-producao")
  })

  it("seleciona o OAuth de PRODUCAO e exige live mode", () => {
    vi.stubEnv("SERVIX_CUSTOMER_PAYMENTS_MP_MODE", "PRODUCAO")
    vi.stubEnv("MERCADO_PAGO_CLIENT_ID", "client-id-legado")
    vi.stubEnv("MERCADO_PAGO_OAUTH_PRODUCAO_CLIENT_ID", "client-id-producao")
    vi.stubEnv("MERCADO_PAGO_OAUTH_PRODUCAO_CLIENT_SECRET", "secret-producao")
    vi.stubEnv("MERCADO_PAGO_OAUTH_PRODUCAO_REDIRECT_URI", "https://api.servix.test/integracoes/mercado-pago/callback")
    vi.stubEnv("MERCADO_PAGO_OAUTH_PRODUCAO_TOKEN_ENCRYPTION_KEY", chave)

    expect(obterConfiguracaoOAuthMercadoPago()).toMatchObject({
      status: "CONFIGURADA",
      modo: "PRODUCAO",
      liveModeEsperado: true,
      clientId: "client-id-producao"
    })
  })
})
