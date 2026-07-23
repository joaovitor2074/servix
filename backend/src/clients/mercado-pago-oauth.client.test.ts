import { describe, expect, it, vi } from "vitest"

import {
  ErroClienteOAuthMercadoPago,
  falhaOAuthMercadoPagoEhDefinitiva,
  MercadoPagoOAuthClient
} from "./mercado-pago-oauth.client.js"

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

function tokens(accessToken: string, refreshToken: string) {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 15_552_000,
    user_id: 241983636,
    live_mode: false,
    scope: "read write offline_access"
  }
}

describe("cliente OAuth Mercado Pago", () => {
  it("troca authorization_code com PKCE e redirect URI estatico", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      resposta(tokens("APP_USR-access", "TG-refresh"))
    )
    const client = new MercadoPagoOAuthClient({
      clientId: "app-123",
      clientSecret: "client-secret",
      redirectUri: "https://api.servix.test/integracoes/mercado-pago/callback",
      fetchImpl
    })

    await expect(client.trocarCodigoPorTokens(
      "authorization-code",
      "code-verifier"
    )).resolves.toEqual({
      accessToken: "APP_USR-access",
      refreshToken: "TG-refresh",
      expiresIn: 15_552_000,
      mercadoPagoUserId: "241983636",
      liveMode: false
    })

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.mercadopago.com/oauth/token")
    expect(JSON.parse(String(init.body))).toEqual({
      client_id: "app-123",
      client_secret: "client-secret",
      grant_type: "authorization_code",
      code: "authorization-code",
      redirect_uri: "https://api.servix.test/integracoes/mercado-pago/callback",
      code_verifier: "code-verifier",
      test_token: "true"
    })
    expect(init.redirect).toBe("error")
  })

  it("renova e devolve o refresh_token rotacionado", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      resposta(tokens("APP_USR-novo", "TG-refresh-novo"))
    )
    const client = new MercadoPagoOAuthClient({
      clientId: "app-123",
      clientSecret: "client-secret",
      redirectUri: "https://api.servix.test/callback",
      fetchImpl
    })

    const resultado = await client.renovarTokens("TG-refresh-antigo")

    expect(resultado.refreshToken).toBe("TG-refresh-novo")
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      client_id: "app-123",
      client_secret: "client-secret",
      grant_type: "refresh_token",
      refresh_token: "TG-refresh-antigo"
    })
  })

  it("classifica invalid_grant sem vazar tokens nem corpo externo", async () => {
    const segredo = "TG-segredo-que-nao-pode-vazar"
    const fetchImpl = vi.fn().mockResolvedValue(resposta({
      error: "invalid_grant",
      message: segredo
    }, 400))
    const client = new MercadoPagoOAuthClient({
      clientId: "app-123",
      clientSecret: "client-secret",
      redirectUri: "https://api.servix.test/callback",
      fetchImpl
    })

    const erro = await client.renovarTokens(segredo).catch(error => error)

    expect(erro).toMatchObject({
      codigo: "RESPOSTA_REJEITADA",
      statusHttp: 400,
      erroProvedor: "invalid_grant"
    })
    expect(erro).toBeInstanceOf(ErroClienteOAuthMercadoPago)
    expect(falhaOAuthMercadoPagoEhDefinitiva(erro)).toBe(true)
    expect(String(erro)).not.toContain(segredo)
  })

  it("preserva Retry-After ao limitar a renovacao", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "local_rate_limited" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "9"
        }
      }
    ))
    const client = new MercadoPagoOAuthClient({
      clientId: "app-123",
      clientSecret: "client-secret",
      redirectUri: "https://api.servix.test/callback",
      fetchImpl
    })

    await expect(client.renovarTokens("TG-refresh"))
      .rejects.toMatchObject({
        statusHttp: 429,
        erroProvedor: "local_rate_limited",
        tentarNovamenteEmMs: 9000
      })
  })
})
