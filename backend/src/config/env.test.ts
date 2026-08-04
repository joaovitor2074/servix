import { afterEach, describe, expect, it, vi } from "vitest"

import {
  obterConfiguracaoAssinaturasMercadoPago,
  obterConfiguracaoOAuthMercadoPago,
  obterSegredoWebhookAssinaturasMercadoPago
} from "./env.js"

const chave = Buffer.alloc(32, 9).toString("base64")

function configurarOAuthTeste(redirectUri: string) {
  vi.stubEnv("SERVIX_CUSTOMER_PAYMENTS_MP_MODE", "TESTE")
  vi.stubEnv("MERCADO_PAGO_OAUTH_TESTE_CLIENT_ID", "client-id-teste")
  vi.stubEnv("MERCADO_PAGO_OAUTH_TESTE_CLIENT_SECRET", "secret-teste")
  vi.stubEnv("MERCADO_PAGO_OAUTH_TESTE_REDIRECT_URI", redirectUri)
  vi.stubEnv("MERCADO_PAGO_OAUTH_TESTE_TOKEN_ENCRYPTION_KEY", chave)
}

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
    vi.stubEnv("SERVIX_LEGAL_IDENTITY_READY", "true")
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

  it("ignora variaveis OAuth legadas em TESTE", () => {
    vi.stubEnv("SERVIX_CUSTOMER_PAYMENTS_MP_MODE", "TESTE")
    vi.stubEnv("MERCADO_PAGO_CLIENT_ID", "client-id-legado")
    vi.stubEnv("MERCADO_PAGO_CLIENT_SECRET", "secret-legado")
    vi.stubEnv(
      "MERCADO_PAGO_REDIRECT_URI",
      "https://api.servix.test/integracoes/mercado-pago/callback"
    )
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", chave)
    vi.stubEnv("MERCADO_PAGO_OAUTH_TESTE_CLIENT_ID", "")
    vi.stubEnv("MERCADO_PAGO_OAUTH_TESTE_CLIENT_SECRET", "")
    vi.stubEnv("MERCADO_PAGO_OAUTH_TESTE_REDIRECT_URI", "")
    vi.stubEnv("MERCADO_PAGO_OAUTH_TESTE_TOKEN_ENCRYPTION_KEY", "")

    expect(obterConfiguracaoOAuthMercadoPago()).toMatchObject({
      status: "NAO_CONFIGURADA"
    })
  })

  it("rejeita callback OAuth HTTP mesmo em localhost", () => {
    configurarOAuthTeste(
      "http://localhost:3005/integracoes/mercado-pago/callback"
    )

    expect(obterConfiguracaoOAuthMercadoPago()).toMatchObject({
      status: "ERRO"
    })
  })

  it.each([
    "https://localhost/integracoes/mercado-pago/callback",
    "https://127.0.0.1/integracoes/mercado-pago/callback",
    "https://[::1]/integracoes/mercado-pago/callback"
  ])("rejeita callback OAuth HTTPS em host local ou loopback: %s", redirectUri => {
    configurarOAuthTeste(redirectUri)

    expect(obterConfiguracaoOAuthMercadoPago()).toMatchObject({
      status: "ERRO"
    })
  })

  it("rejeita callback OAuth com path diferente", () => {
    configurarOAuthTeste(
      "https://api.servix.test/integracoes/mercado-pago/outro-callback"
    )

    expect(obterConfiguracaoOAuthMercadoPago()).toMatchObject({
      status: "ERRO"
    })
  })

  it.each([
    "https://usuario:senha@api.servix.test/integracoes/mercado-pago/callback",
    "https://api.servix.test/integracoes/mercado-pago/callback?origem=teste",
    "https://api.servix.test/integracoes/mercado-pago/callback#retorno"
  ])("rejeita callback OAuth com componentes extras: %s", redirectUri => {
    configurarOAuthTeste(redirectUri)

    expect(obterConfiguracaoOAuthMercadoPago()).toMatchObject({
      status: "ERRO"
    })
  })

  it("aceita callback OAuth HTTPS com path exato", () => {
    const redirectUri =
      "https://api.servix.test/integracoes/mercado-pago/callback"
    configurarOAuthTeste(redirectUri)

    expect(obterConfiguracaoOAuthMercadoPago()).toMatchObject({
      status: "CONFIGURADA",
      modo: "TESTE",
      liveModeEsperado: false,
      clientId: "client-id-teste",
      redirectUri
    })
  })
})
