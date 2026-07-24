import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AmbientePagamento,
  ProvedorPagamento
} from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  obterCredencial: vi.fn()
}))

vi.mock("../services/mercado-pago-oauth.service.js", () => ({
  obterCredencialMercadoPagoService: mocks.obterCredencial
}))

import {
  obterGatewayPagamento,
  resolverGatewayPagamento
} from "./gateway-pagamento.factory.js"
import { MercadoPagoGateway } from "./mercado-pago.gateway.js"

beforeEach(() => {
  vi.stubEnv("SERVIX_CUSTOMER_PAYMENTS_MP_MODE", "TESTE")
  vi.stubEnv("SERVIX_PAYMENT_SIMULATOR_ENABLED", "true")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe("factory de gateway de pagamento", () => {
  it("ignora token avulso do ambiente mesmo fora de producao", async () => {
    vi.stubEnv(
      "MERCADO_PAGO_ACCESS_TOKEN_TESTE",
      "APP_USR-token-que-nao-deve-ser-usado"
    )
    mocks.obterCredencial.mockResolvedValue(null)

    expect(obterGatewayPagamento(ProvedorPagamento.MERCADO_PAGO, {
      empresaId: 8,
      ambiente: AmbientePagamento.TESTE
    })).toBeNull()

    await expect(resolverGatewayPagamento(
      ProvedorPagamento.MERCADO_PAGO,
      {
        empresaId: 8,
        ambiente: AmbientePagamento.TESTE
      }
    )).resolves.toBeNull()
    await expect(resolverGatewayPagamento(
      ProvedorPagamento.MERCADO_PAGO,
      {
        empresaId: 8,
        ambiente: AmbientePagamento.PRODUCAO
      }
    )).resolves.toBeNull()
  })

  it("bloqueia Mercado Pago no ambiente de producao", async () => {
    mocks.obterCredencial.mockResolvedValue({
      accessToken: "APP_USR-token-oauth",
      mercadoPagoUserId: "241983636"
    })

    await expect(resolverGatewayPagamento(
      ProvedorPagamento.MERCADO_PAGO,
      {
        empresaId: 8,
        ambiente: AmbientePagamento.PRODUCAO
      }
    )).resolves.toBeNull()
    expect(mocks.obterCredencial).not.toHaveBeenCalled()
  })

  it("permite sandbox OAuth em deploy tecnico de producao", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mocks.obterCredencial.mockResolvedValue({
      accessToken: "APP_USR-token-oauth-sandbox",
      mercadoPagoUserId: "241983636"
    })

    await expect(resolverGatewayPagamento(
      ProvedorPagamento.MERCADO_PAGO,
      {
        empresaId: 8,
        ambiente: AmbientePagamento.TESTE
      }
    )).resolves.toBeInstanceOf(MercadoPagoGateway)
    expect(mocks.obterCredencial).toHaveBeenCalledWith(8)
  })

  it("falha fechado em producao tecnica sem modo financeiro explicito", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("SERVIX_CUSTOMER_PAYMENTS_MP_MODE", "")
    mocks.obterCredencial.mockResolvedValue({
      accessToken: "APP_USR-token-que-nao-deve-ser-usado",
      mercadoPagoUserId: "241983636"
    })

    await expect(resolverGatewayPagamento(
      ProvedorPagamento.MERCADO_PAGO,
      {
        empresaId: 8,
        ambiente: AmbientePagamento.TESTE
      }
    )).resolves.toBeNull()
    expect(mocks.obterCredencial).not.toHaveBeenCalled()
  })

  it("nao habilita movimentacao real ao receber modo PRODUCAO", async () => {
    vi.stubEnv("SERVIX_CUSTOMER_PAYMENTS_MP_MODE", "PRODUCAO")
    mocks.obterCredencial.mockResolvedValue({
      accessToken: "APP_USR-token-live-que-nao-deve-ser-usado",
      mercadoPagoUserId: "241983636"
    })

    await expect(resolverGatewayPagamento(
      ProvedorPagamento.MERCADO_PAGO,
      {
        empresaId: 8,
        ambiente: AmbientePagamento.TESTE
      }
    )).resolves.toBeNull()
    expect(mocks.obterCredencial).not.toHaveBeenCalled()
  })

  it("resolve o token OAuth usando somente o empresaId do contexto", async () => {
    mocks.obterCredencial.mockImplementation(async (empresaId: number) =>
      empresaId === 8
        ? {
            accessToken: "TEST-token-empresa-8",
            mercadoPagoUserId: "241983636"
          }
        : null
    )

    await expect(resolverGatewayPagamento(
      ProvedorPagamento.MERCADO_PAGO,
      { empresaId: 8, ambiente: AmbientePagamento.TESTE }
    )).resolves.toBeInstanceOf(MercadoPagoGateway)

    await expect(resolverGatewayPagamento(
      ProvedorPagamento.MERCADO_PAGO,
      { empresaId: 9, ambiente: AmbientePagamento.TESTE }
    )).resolves.toBeNull()

    expect(mocks.obterCredencial).toHaveBeenNthCalledWith(1, 8)
    expect(mocks.obterCredencial).toHaveBeenNthCalledWith(2, 9)
  })

  it("usa a credencial OAuth retornada para a empresa", async () => {
    mocks.obterCredencial.mockResolvedValue({
      accessToken: "APP_USR-token-oauth",
      mercadoPagoUserId: "222222"
    })

    const gateway = await resolverGatewayPagamento(
      ProvedorPagamento.MERCADO_PAGO,
      { empresaId: 8, ambiente: AmbientePagamento.TESTE }
    )

    expect(gateway).toBeInstanceOf(MercadoPagoGateway)
    expect((gateway as unknown as { accessToken: string }).accessToken)
      .toBe("APP_USR-token-oauth")
  })
})
