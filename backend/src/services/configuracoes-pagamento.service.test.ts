import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AmbientePagamento,
  ProvedorPagamento,
  StatusConfiguracaoPagamento
} from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  buscarResumoIntegracao: vi.fn(),
  obterCredencialIntegracao: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    configuracaoPagamento: {
      upsert: prismaMocks.upsert,
      updateMany: prismaMocks.updateMany,
      findUniqueOrThrow: prismaMocks.findUniqueOrThrow
    }
  }
}))

vi.mock("./mercado-pago-oauth.service.js", () => ({
  buscarResumoIntegracaoMercadoPagoService:
    prismaMocks.buscarResumoIntegracao,
  obterCredencialMercadoPagoService:
    prismaMocks.obterCredencialIntegracao
}))

import {
  atualizarConfiguracaoPagamentoService,
  buscarConfiguracaoPagamentoService
} from "./configuracoes-pagamento.service.js"

const configuracaoManual = {
  provedor: ProvedorPagamento.MANUAL,
  status: StatusConfiguracaoPagamento.ATIVA,
  ambiente: AmbientePagamento.TESTE,
  ativo: true,
  pixHabilitado: false,
  versao: 1,
  atualizadoEm: new Date("2026-07-22T12:00:00.000Z")
}

beforeEach(() => {
  vi.stubEnv("SERVIX_CUSTOMER_PAYMENTS_MP_MODE", "TESTE")
  vi.stubEnv("SERVIX_PAYMENT_SIMULATOR_ENABLED", "true")
  vi.clearAllMocks()
  prismaMocks.upsert.mockResolvedValue(configuracaoManual)
  prismaMocks.obterCredencialIntegracao.mockResolvedValue(null)
  prismaMocks.buscarResumoIntegracao.mockResolvedValue({
    conectado: false,
    status: "DESCONECTADA",
    origem: null,
    oauthDisponivel: false,
    motivoIndisponibilidade:
      "OAuth do Mercado Pago nao configurado no servidor."
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("configuracao de pagamento", () => {
  it("garante a configuracao somente para a empresa autenticada", async () => {
    const resultado = await buscarConfiguracaoPagamentoService(8)

    expect(prismaMocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { empresaId: 8 },
      create: { empresaId: 8 }
    }))
    expect(resultado.configuracao).toEqual(configuracaoManual)
    expect(resultado.provedoresDisponiveis).toHaveLength(4)
  })

  it("atualiza com CAS e incrementa a versao", async () => {
    const atualizada = {
      ...configuracaoManual,
      provedor: ProvedorPagamento.SIMULADO,
      pixHabilitado: true,
      versao: 2
    }
    prismaMocks.updateMany.mockResolvedValue({ count: 1 })
    prismaMocks.findUniqueOrThrow.mockResolvedValue(atualizada)

    const resultado = await atualizarConfiguracaoPagamentoService(8, {
      versaoEsperada: 1,
      provedor: ProvedorPagamento.SIMULADO,
      ambiente: AmbientePagamento.TESTE,
      ativo: true,
      pixHabilitado: true
    })

    expect(prismaMocks.updateMany).toHaveBeenCalledWith({
      where: { empresaId: 8, versao: 1 },
      data: {
        provedor: ProvedorPagamento.SIMULADO,
        ambiente: AmbientePagamento.TESTE,
        ativo: true,
        pixHabilitado: true,
        status: StatusConfiguracaoPagamento.ATIVA,
        versao: { increment: 1 }
      }
    })
    expect(resultado).toMatchObject({
      sucesso: true,
      configuracao: { versao: 2 }
    })
  })

  it("rejeita versao obsoleta sem sobrescrever outro administrador", async () => {
    prismaMocks.upsert.mockResolvedValue({
      ...configuracaoManual,
      versao: 3
    })

    const resultado = await atualizarConfiguracaoPagamentoService(8, {
      versaoEsperada: 2,
      pixHabilitado: true
    })

    expect(resultado).toMatchObject({
      sucesso: false,
      motivo: "conflito_atualizacao",
      versaoEsperada: 2,
      versaoAtual: 3
    })
    expect(prismaMocks.updateMany).not.toHaveBeenCalled()
  })

  it("nao ativa provedor real antes da conexao segura", async () => {
    const resultado = await atualizarConfiguracaoPagamentoService(8, {
      versaoEsperada: 1,
      provedor: ProvedorPagamento.MERCADO_PAGO,
      ativo: true
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "provedor_nao_conectado",
      provedor: ProvedorPagamento.MERCADO_PAGO
    })
    expect(prismaMocks.updateMany).not.toHaveBeenCalled()
  })

  it("permite selecionar provedor futuro apenas como nao configurado", async () => {
    const desconectada = {
      ...configuracaoManual,
      provedor: ProvedorPagamento.ASAAS,
      status: StatusConfiguracaoPagamento.NAO_CONFIGURADA,
      ativo: false,
      versao: 2
    }
    prismaMocks.updateMany.mockResolvedValue({ count: 1 })
    prismaMocks.findUniqueOrThrow.mockResolvedValue(desconectada)

    const resultado = await atualizarConfiguracaoPagamentoService(8, {
      versaoEsperada: 1,
      provedor: ProvedorPagamento.ASAAS
    })

    expect(prismaMocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ativo: false,
        status: StatusConfiguracaoPagamento.NAO_CONFIGURADA
      })
    }))
    expect(resultado).toMatchObject({ sucesso: true })
  })

  it("ignora token avulso do ambiente e exige OAuth", async () => {
    vi.stubEnv(
      "MERCADO_PAGO_ACCESS_TOKEN_TESTE",
      "APP_USR-token-avulso-ignorado"
    )
    const resultado = await buscarConfiguracaoPagamentoService(8)
    const mercadoPago = resultado.provedoresDisponiveis.find(
      item => item.provedor === ProvedorPagamento.MERCADO_PAGO
    )

    expect(mercadoPago).toMatchObject({ disponivel: false })
    expect(resultado.integracaoMercadoPago.origem).toBeNull()
    expect(JSON.stringify(resultado)).not.toContain("token-avulso-ignorado")
  })

  it("libera somente a conexao OAuth da empresa consultada", async () => {
    prismaMocks.buscarResumoIntegracao.mockResolvedValue({
      conectado: true,
      status: "CONECTADA",
      mercadoPagoUserId: "241983636",
      conectadoEm: new Date("2026-07-23T12:00:00.000Z"),
      tokenExpiraEm: new Date("2027-01-23T12:00:00.000Z"),
      origem: "OAUTH",
      oauthDisponivel: true,
      liveMode: false
    })
    prismaMocks.obterCredencialIntegracao.mockImplementation(
      async (empresaId: number) =>
        empresaId === 8
          ? {
              accessToken: "TEST-token-da-empresa-8",
              mercadoPagoUserId: "241983636"
            }
          : null
    )

    const resultado = await buscarConfiguracaoPagamentoService(8)
    const mercadoPago = resultado.provedoresDisponiveis.find(
      item => item.provedor === ProvedorPagamento.MERCADO_PAGO
    )

    expect(mercadoPago).toMatchObject({
      disponivel: true,
      configuracaoServidor: "CONFIGURADA"
    })
    expect(resultado.integracaoMercadoPago).toMatchObject({
      conectado: true,
      origem: "OAUTH",
      mercadoPagoUserId: "241983636"
    })
    expect(JSON.stringify(resultado)).not.toContain("TEST-token-da-empresa-8")
  })

  it("mantem sandbox disponivel com NODE_ENV de producao", async () => {
    vi.stubEnv("NODE_ENV", "production")
    prismaMocks.buscarResumoIntegracao.mockResolvedValue({
      conectado: true,
      status: "CONECTADA",
      mercadoPagoUserId: "241983636",
      conectadoEm: new Date("2026-07-23T12:00:00.000Z"),
      tokenExpiraEm: new Date("2027-01-23T12:00:00.000Z"),
      origem: "OAUTH",
      oauthDisponivel: true,
      liveMode: false
    })

    const resultado = await buscarConfiguracaoPagamentoService(8)
    const mercadoPago = resultado.provedoresDisponiveis.find(
      item => item.provedor === ProvedorPagamento.MERCADO_PAGO
    )

    expect(mercadoPago).toMatchObject({
      disponivel: true,
      ambientes: [AmbientePagamento.TESTE]
    })
  })

  it("falha fechado em NODE_ENV de producao sem modo financeiro", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("SERVIX_CUSTOMER_PAYMENTS_MP_MODE", "")
    prismaMocks.buscarResumoIntegracao.mockResolvedValue({
      conectado: true,
      status: "CONECTADA",
      mercadoPagoUserId: "241983636",
      conectadoEm: new Date("2026-07-23T12:00:00.000Z"),
      tokenExpiraEm: new Date("2027-01-23T12:00:00.000Z"),
      origem: "OAUTH",
      oauthDisponivel: true,
      liveMode: false
    })

    const resultado = await buscarConfiguracaoPagamentoService(8)
    const mercadoPago = resultado.provedoresDisponiveis.find(
      item => item.provedor === ProvedorPagamento.MERCADO_PAGO
    )

    expect(mercadoPago).toMatchObject({
      disponivel: false,
      motivoIndisponibilidade:
        "Cobrancas Mercado Pago para clientes estao desabilitadas neste ambiente."
    })
  })

  it("mostra autorizacao live como bloqueada e nao conectada", async () => {
    prismaMocks.buscarResumoIntegracao.mockResolvedValue({
      conectado: false,
      status: "BLOQUEADA",
      mercadoPagoUserId: "987654321",
      conectadoEm: new Date("2026-07-23T12:00:00.000Z"),
      tokenExpiraEm: new Date("2027-01-23T12:00:00.000Z"),
      origem: "OAUTH",
      oauthDisponivel: true,
      liveMode: true
    })

    const resultado = await buscarConfiguracaoPagamentoService(8)
    const mercadoPago = resultado.provedoresDisponiveis.find(
      item => item.provedor === ProvedorPagamento.MERCADO_PAGO
    )

    expect(resultado.integracaoMercadoPago).toMatchObject({
      conectado: false,
      status: "BLOQUEADA",
      liveMode: true
    })
    expect(mercadoPago).toMatchObject({
      disponivel: false,
      motivoIndisponibilidade:
        "Cobrancas reais permanecem bloqueadas nesta etapa."
    })
  })
})
