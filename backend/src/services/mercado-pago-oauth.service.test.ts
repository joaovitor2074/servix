import { createHash } from "node:crypto"

import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ErroClienteOAuthMercadoPago,
  MercadoPagoOAuthClient
} from "../clients/mercado-pago-oauth.client.js"
import {
  ProvedorPagamento,
  StatusCobranca,
  StatusConfiguracaoPagamento
} from "../generated/prisma/enums.js"
import {
  criptografarToken,
  descriptografarToken
} from "../lib/criptografia-tokens.js"

const dependencias = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    usuario: { findFirst: vi.fn() },
    estadoOAuthMercadoPago: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn()
    },
    integracaoPagamento: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn()
    },
    cobranca: {
      updateMany: vi.fn(),
      count: vi.fn()
    },
    configuracaoPagamento: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn()
    }
  }

  return {
    tx,
    transaction: vi.fn(),
    configuracaoOAuth: vi.fn(),
    modoPagamentos: vi.fn()
  }
})

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    ...dependencias.tx,
    $transaction: dependencias.transaction
  }
}))

vi.mock("../config/env.js", () => ({
  obterConfiguracaoOAuthMercadoPago: dependencias.configuracaoOAuth,
  obterModoPagamentosClientesMercadoPago: dependencias.modoPagamentos
}))

import {
  buscarResumoIntegracaoMercadoPagoService,
  concluirOAuthMercadoPagoService,
  desconectarMercadoPagoService,
  ErroFluxoOAuthMercadoPago,
  iniciarOAuthMercadoPagoService,
  obterAccessTokenMercadoPagoService
} from "./mercado-pago-oauth.service.js"

const chave = Buffer.alloc(32, 7).toString("base64")
const configuracaoOAuth = {
  status: "CONFIGURADA" as const,
  modo: "TESTE" as const,
  liveModeEsperado: false,
  clientId: "app-123",
  clientSecret: "client-secret",
  redirectUri: "https://api.servix.test/integracoes/mercado-pago/callback",
  tokenEncryptionKey: chave,
  timeoutMs: 8000
}

function hashState(state: string) {
  return createHash("sha256").update(state, "utf8").digest("hex")
}

function estadoOAuth(empresaId: number, state: string) {
  const usuarioId = 3
  const stateHash = hashState(state)
  return {
    id: 41,
    empresaId,
    usuarioId,
    stateHash,
    codeVerifierCriptografado: criptografarToken(
      "verifier-valido-com-mais-de-quarenta-e-tres-caracteres-123456",
      chave,
      `oauth:mercado-pago:${empresaId}:${usuarioId}:${stateHash}:verifier`
    ),
    expiraEm: new Date(Date.now() + 60_000),
    consumidoEm: null
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  dependencias.configuracaoOAuth.mockReturnValue(configuracaoOAuth)
  dependencias.modoPagamentos.mockReturnValue("TESTE")
  dependencias.transaction.mockImplementation(
    async (callback: (tx: typeof dependencias.tx) => Promise<unknown>) =>
      callback(dependencias.tx)
  )
  dependencias.tx.usuario.findFirst.mockResolvedValue({ id: 3 })
  dependencias.tx.estadoOAuthMercadoPago.deleteMany.mockResolvedValue({ count: 0 })
  dependencias.tx.estadoOAuthMercadoPago.create.mockResolvedValue({ id: 41 })
  dependencias.tx.estadoOAuthMercadoPago.updateMany.mockResolvedValue({ count: 1 })
  dependencias.tx.integracaoPagamento.upsert.mockResolvedValue({ id: 51 })
  dependencias.tx.integracaoPagamento.findUnique.mockResolvedValue(null)
  dependencias.tx.integracaoPagamento.update.mockResolvedValue({ id: 51 })
  dependencias.tx.integracaoPagamento.updateMany.mockResolvedValue({ count: 1 })
  dependencias.tx.integracaoPagamento.findFirst.mockResolvedValue(null)
  dependencias.tx.cobranca.updateMany.mockResolvedValue({ count: 0 })
  dependencias.tx.cobranca.count.mockResolvedValue(0)
  dependencias.tx.configuracaoPagamento.upsert.mockResolvedValue({ id: 61 })
  dependencias.tx.configuracaoPagamento.findUnique.mockResolvedValue(null)
  dependencias.tx.configuracaoPagamento.updateMany.mockResolvedValue({ count: 1 })
  dependencias.tx.$queryRaw.mockResolvedValue([])
})

describe("OAuth Mercado Pago por empresa", () => {
  it("inicia state/PKCE somente para a empresa autenticada", async () => {
    const resultado = await iniciarOAuthMercadoPagoService(8, 3)
    const url = new URL(resultado.authorizationUrl)
    const state = url.searchParams.get("state")

    expect(url.origin).toBe("https://auth.mercadopago.com")
    expect(url.pathname).toBe("/authorization")
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("client_id")).toBe(configuracaoOAuth.clientId)
    expect(url.searchParams.get("platform_id")).toBe("mp")
    expect(url.searchParams.get("redirect_uri"))
      .toBe(configuracaoOAuth.redirectUri)
    expect(state).toBeTruthy()
    expect(url.searchParams.get("scope")).toBe("offline_access read write")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(dependencias.tx.estadoOAuthMercadoPago.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        empresaId: 8,
        usuarioId: 3,
        stateHash: hashState(String(state))
      }),
      select: { id: true }
    })
    expect(JSON.stringify(
      dependencias.tx.estadoOAuthMercadoPago.create.mock.calls[0]
    )).not.toContain(String(state))
  })

  it("consome state uma vez e conecta somente a empresa que iniciou", async () => {
    const state = "state-empresa-a-com-entropia-suficiente-1234567890"
    dependencias.tx.estadoOAuthMercadoPago.findUnique.mockResolvedValue(
      estadoOAuth(8, state)
    )
    dependencias.tx.configuracaoPagamento.findUnique.mockResolvedValue({
      provedor: ProvedorPagamento.MANUAL,
      ativo: true
    })
    const trocar = vi.spyOn(
      MercadoPagoOAuthClient.prototype,
      "trocarCodigoPorTokens"
    ).mockResolvedValue({
      accessToken: "APP_USR-access-empresa-a",
      refreshToken: "TG-refresh-empresa-a",
      expiresIn: 3600,
      mercadoPagoUserId: "payer-empresa-a",
      liveMode: false
    })

    const resultado = await concluirOAuthMercadoPagoService({
      state,
      code: "authorization-code"
    })

    expect(resultado).toEqual({
      sucesso: true,
      empresaId: 8,
      liveMode: false
    })
    expect(dependencias.tx.estadoOAuthMercadoPago.updateMany)
      .toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          stateHash: hashState(state),
          consumidoEm: null
        })
      }))
    expect(dependencias.tx.integracaoPagamento.upsert)
      .toHaveBeenCalledWith(expect.objectContaining({
        where: {
          empresaId_provedor: {
            empresaId: 8,
            provedor: ProvedorPagamento.MERCADO_PAGO
          }
        },
        create: expect.objectContaining({ empresaId: 8 })
      }))
    expect(dependencias.tx.configuracaoPagamento.findUnique)
      .toHaveBeenCalledWith(expect.objectContaining({ where: { empresaId: 8 } }))
    expect(dependencias.tx.configuracaoPagamento.updateMany)
      .not.toHaveBeenCalled()

    const persistido = JSON.stringify(
      dependencias.tx.integracaoPagamento.upsert.mock.calls[0]
    )
    expect(persistido).not.toContain("APP_USR-access-empresa-a")
    expect(persistido).not.toContain("TG-refresh-empresa-a")
    expect(JSON.stringify(resultado)).not.toContain("APP_USR-access-empresa-a")

    dependencias.tx.estadoOAuthMercadoPago.updateMany.mockResolvedValueOnce({
      count: 0
    })
    await expect(concluirOAuthMercadoPagoService({
      state,
      code: "outro-code"
    })).rejects.toMatchObject({ codigo: "STATE_INVALIDO" })
    expect(trocar).toHaveBeenCalledTimes(1)
  })

  it("persiste credencial live somente quando o servidor esta em PRODUCAO", async () => {
    const state = "state-producao-com-entropia-suficiente-1234567890"
    dependencias.configuracaoOAuth.mockReturnValue({
      ...configuracaoOAuth,
      modo: "PRODUCAO",
      liveModeEsperado: true
    })
    dependencias.modoPagamentos.mockReturnValue("PRODUCAO")
    dependencias.tx.estadoOAuthMercadoPago.findUnique.mockResolvedValue(
      estadoOAuth(8, state)
    )
    dependencias.tx.configuracaoPagamento.findUnique.mockResolvedValue({
      provedor: ProvedorPagamento.MANUAL,
      ativo: true
    })
    vi.spyOn(
      MercadoPagoOAuthClient.prototype,
      "trocarCodigoPorTokens"
    ).mockResolvedValue({
      accessToken: "APP_USR-access-live",
      refreshToken: "TG-refresh-live",
      expiresIn: 3600,
      mercadoPagoUserId: "payer-producao",
      liveMode: true
    })

    await expect(concluirOAuthMercadoPagoService({
      state,
      code: "authorization-code-live"
    })).resolves.toEqual({
      sucesso: true,
      empresaId: 8,
      liveMode: true
    })
    expect(dependencias.tx.integracaoPagamento.upsert)
      .toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ liveMode: true }),
        update: expect.objectContaining({ liveMode: true })
      }))
  })

  it("bloqueia a primeira conexao se houver cobranca legada sem conciliacao", async () => {
    const state = "state-legado-sem-conciliacao-1234567890"
    dependencias.tx.estadoOAuthMercadoPago.findUnique.mockResolvedValue(
      estadoOAuth(8, state)
    )
    dependencias.tx.cobranca.count.mockResolvedValue(1)
    vi.spyOn(MercadoPagoOAuthClient.prototype, "trocarCodigoPorTokens")
      .mockResolvedValue({
        accessToken: "APP_USR-access-sandbox",
        refreshToken: "TG-refresh-sandbox",
        expiresIn: 3600,
        mercadoPagoUserId: "payer-sandbox",
        liveMode: false
      })

    await expect(concluirOAuthMercadoPagoService({
      state,
      code: "authorization-code"
    })).resolves.toEqual({
      sucesso: false,
      codigo: "COBRANCAS_PENDENTES"
    })
    expect(dependencias.tx.cobranca.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        empresaId: 8,
        OR: expect.arrayContaining([
          { status: StatusCobranca.PENDENTE },
          expect.objectContaining({ finalizadaNoGatewayEm: null })
        ])
      })
    })
    expect(dependencias.tx.integracaoPagamento.upsert).not.toHaveBeenCalled()
  })

  it("nunca devolve para B o access token cifrado de A", async () => {
    const tokenEmpresaA = "APP_USR-token-exclusivo-empresa-a"
    dependencias.tx.integracaoPagamento.findUnique.mockImplementation(
      ({ where }: { where: { empresaId_provedor: { empresaId: number } } }) => {
        if (where.empresaId_provedor.empresaId !== 8) return null
        return {
          mercadoPagoUserId: "payer-a",
          accessTokenCriptografado: criptografarToken(
            tokenEmpresaA,
            chave,
            "integracao:mercado-pago:8:access-token"
          ),
          refreshTokenCriptografado: criptografarToken(
            "TG-a",
            chave,
            "integracao:mercado-pago:8:refresh-token"
          ),
          tokenExpiraEm: new Date(Date.now() + 60 * 60 * 1000),
          liveMode: false,
          status: StatusConfiguracaoPagamento.ATIVA
        }
      }
    )

    await expect(obterAccessTokenMercadoPagoService(9)).resolves.toBeNull()
    await expect(obterAccessTokenMercadoPagoService(8)).resolves.toBe(
      tokenEmpresaA
    )
    expect(dependencias.tx.integracaoPagamento.findUnique)
      .toHaveBeenNthCalledWith(1, expect.objectContaining({
        where: {
          empresaId_provedor: {
            empresaId: 9,
            provedor: ProvedorPagamento.MERCADO_PAGO
          }
        }
      }))
  })

  it("descarta tokens live sem persistir integracao", async () => {
    const state = "state-live-com-entropia-suficiente-1234567890"
    dependencias.tx.estadoOAuthMercadoPago.findUnique.mockResolvedValue(
      estadoOAuth(8, state)
    )
    vi.spyOn(MercadoPagoOAuthClient.prototype, "trocarCodigoPorTokens")
      .mockResolvedValue({
        accessToken: "APP_USR-token-live-secreto",
        refreshToken: "TG-refresh-live-secreto",
        expiresIn: 3600,
        mercadoPagoUserId: "987654321",
        liveMode: true
      })

    await expect(concluirOAuthMercadoPagoService({
      state,
      code: "authorization-code"
    })).resolves.toEqual({
      sucesso: false,
      codigo: "AMBIENTE_INCOMPATIVEL"
    })

    expect(dependencias.tx.estadoOAuthMercadoPago.updateMany)
      .toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          finalizadoEm: expect.any(Date)
        })
      }))
    expect(dependencias.tx.integracaoPagamento.upsert).not.toHaveBeenCalled()
    expect(dependencias.tx.configuracaoPagamento.findUnique)
      .not.toHaveBeenCalled()
    expect(dependencias.tx.configuracaoPagamento.updateMany)
      .not.toHaveBeenCalled()
    expect(JSON.stringify(
      dependencias.tx.estadoOAuthMercadoPago.updateMany.mock.calls
    ))
      .not.toMatch(/token-live-secreto|refresh-live-secreto/)
  })

  it("nao permite vincular a mesma conta a outra empresa", async () => {
    const state = "state-conta-duplicada-com-entropia-1234567890"
    dependencias.tx.estadoOAuthMercadoPago.findUnique.mockResolvedValue(
      estadoOAuth(8, state)
    )
    dependencias.tx.integracaoPagamento.findFirst.mockResolvedValue({ id: 99 })
    vi.spyOn(MercadoPagoOAuthClient.prototype, "trocarCodigoPorTokens")
      .mockResolvedValue({
        accessToken: "APP_USR-access-duplicado",
        refreshToken: "TG-refresh-duplicado",
        expiresIn: 3600,
        mercadoPagoUserId: "241983636",
        liveMode: false
      })

    await expect(concluirOAuthMercadoPagoService({
      state,
      code: "authorization-code"
    })).resolves.toEqual({
      sucesso: false,
      codigo: "CONTA_JA_CONECTADA"
    })
    expect(dependencias.tx.integracaoPagamento.upsert).not.toHaveBeenCalled()
  })

  it("nao desconecta enquanto houver cobranca Pix pendente", async () => {
    dependencias.tx.cobranca.count.mockResolvedValue(1)

    await expect(desconectarMercadoPagoService(8)).resolves.toEqual({
      sucesso: false,
      codigo: "COBRANCAS_PENDENTES"
    })
    expect(dependencias.tx.integracaoPagamento.deleteMany)
      .not.toHaveBeenCalled()
    expect(dependencias.tx.cobranca.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        empresaId: 8,
        OR: expect.arrayContaining([
          expect.objectContaining({ status: StatusCobranca.PENDENTE }),
          expect.objectContaining({ finalizadaNoGatewayEm: null })
        ])
      })
    })
  })

  it("resume autorizacao live como bloqueada, nunca conectada", async () => {
    dependencias.tx.integracaoPagamento.findUnique.mockResolvedValue({
      mercadoPagoUserId: "987654321",
      tokenExpiraEm: new Date("2027-01-23T12:00:00.000Z"),
      liveMode: true,
      status: StatusConfiguracaoPagamento.INATIVA,
      conectadoEm: new Date("2026-07-23T12:00:00.000Z")
    })

    await expect(buscarResumoIntegracaoMercadoPagoService(8))
      .resolves.toMatchObject({
        conectado: false,
        status: "BLOQUEADA",
        origem: "OAUTH",
        liveMode: true
      })
  })

  it("renova e persiste o novo refresh_token cifrado", async () => {
    dependencias.tx.integracaoPagamento.findUnique.mockResolvedValue({
      mercadoPagoUserId: "payer-a",
      accessTokenCriptografado: criptografarToken(
        "APP_USR-antigo",
        chave,
        "integracao:mercado-pago:8:access-token"
      ),
      refreshTokenCriptografado: criptografarToken(
        "TG-refresh-antigo",
        chave,
        "integracao:mercado-pago:8:refresh-token"
      ),
      tokenExpiraEm: new Date(Date.now() + 30_000),
      liveMode: false,
      status: StatusConfiguracaoPagamento.ATIVA
    })
    const renovar = vi.spyOn(
      MercadoPagoOAuthClient.prototype,
      "renovarTokens"
    ).mockResolvedValue({
      accessToken: "APP_USR-novo",
      refreshToken: "TG-refresh-novo",
      expiresIn: 3600,
      mercadoPagoUserId: "payer-a",
      liveMode: false
    })

    await expect(obterAccessTokenMercadoPagoService(8)).resolves.toBe(
      "APP_USR-novo"
    )
    expect(renovar).toHaveBeenCalledWith("TG-refresh-antigo")

    const atualizacao = dependencias.tx.integracaoPagamento.updateMany.mock
      .calls.find(([argumento]) =>
        Boolean(argumento.data.refreshTokenCriptografado)
      )?.[0]
    expect(atualizacao).toBeDefined()
    expect(atualizacao.data.refreshTokenCriptografado)
      .not.toContain("TG-refresh-novo")
    expect(descriptografarToken(
      atualizacao.data.refreshTokenCriptografado,
      chave,
      "integracao:mercado-pago:8:refresh-token"
    )).toBe("TG-refresh-novo")
  })

  it("invalida a configuracao em invalid_grant sem vazar refresh token", async () => {
    const refresh = "TG-refresh-revogado-secreto"
    dependencias.tx.integracaoPagamento.findUnique.mockResolvedValue({
      mercadoPagoUserId: "payer-a",
      accessTokenCriptografado: criptografarToken(
        "APP_USR-antigo",
        chave,
        "integracao:mercado-pago:8:access-token"
      ),
      refreshTokenCriptografado: criptografarToken(
        refresh,
        chave,
        "integracao:mercado-pago:8:refresh-token"
      ),
      tokenExpiraEm: new Date(Date.now() - 1000),
      liveMode: false,
      status: StatusConfiguracaoPagamento.ATIVA
    })
    vi.spyOn(MercadoPagoOAuthClient.prototype, "renovarTokens")
      .mockRejectedValue(new ErroClienteOAuthMercadoPago(
        "RESPOSTA_REJEITADA",
        400,
        "invalid_grant"
      ))

    await expect(obterAccessTokenMercadoPagoService(8)).resolves.toBeNull()
    expect(dependencias.tx.integracaoPagamento.updateMany)
      .toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ empresaId: 8 }),
        data: expect.objectContaining({
          status: StatusConfiguracaoPagamento.ERRO
        })
      }))
    expect(dependencias.tx.configuracaoPagamento.updateMany)
      .toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ empresaId: 8 }),
        data: expect.objectContaining({
          status: StatusConfiguracaoPagamento.ERRO,
          ativo: false,
          pixHabilitado: false
        })
      }))
    expect(String(new ErroFluxoOAuthMercadoPago("TROCA_TOKEN_FALHOU")))
      .not.toContain(refresh)
  })

  it("mantem o lease durante Retry-After sem invalidar a conexao", async () => {
    dependencias.tx.integracaoPagamento.findUnique.mockResolvedValue({
      mercadoPagoUserId: "241983636",
      accessTokenCriptografado: criptografarToken(
        "APP_USR-antigo",
        chave,
        "integracao:mercado-pago:8:access-token"
      ),
      refreshTokenCriptografado: criptografarToken(
        "TG-refresh-antigo",
        chave,
        "integracao:mercado-pago:8:refresh-token"
      ),
      tokenExpiraEm: new Date(Date.now() - 1000),
      liveMode: false,
      status: StatusConfiguracaoPagamento.ATIVA
    })
    vi.spyOn(MercadoPagoOAuthClient.prototype, "renovarTokens")
      .mockRejectedValue(new ErroClienteOAuthMercadoPago(
        "RESPOSTA_REJEITADA",
        429,
        "local_rate_limited",
        9000
      ))

    await expect(obterAccessTokenMercadoPagoService(8)).resolves.toBeNull()

    expect(dependencias.tx.integracaoPagamento.updateMany)
      .toHaveBeenLastCalledWith(expect.objectContaining({
        data: {
          renovacaoBloqueadaAte: expect.any(Date)
        }
      }))
    expect(dependencias.tx.configuracaoPagamento.updateMany)
      .not.toHaveBeenCalled()
  })
})
