import { beforeEach, describe, expect, it, vi } from "vitest"
import { StatusAssinatura } from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  txQueryRaw: vi.fn(),
  txEmpresaFindUnique: vi.fn(),
  txEmpresaUpdate: vi.fn(),
  txAssinaturaUpsert: vi.fn(),
  txAssinaturaFindUnique: vi.fn(),
  txAssinaturaUpdate: vi.fn(),
  txHistoricoCreate: vi.fn(),
  buscarPorReferencia: vi.fn(),
  criarMercadoPago: vi.fn(),
  obterMercadoPago: vi.fn(),
  obterConfiguracao: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: { $transaction: mocks.transaction }
}))

vi.mock("../config/env.js", () => ({
  obterConfiguracaoAssinaturasMercadoPago: mocks.obterConfiguracao
}))

const configuracaoTeste = {
    status: "CONFIGURADA",
    modo: "TESTE",
    accessToken: "nao-exposto",
    publicKey: null,
    planId: null,
    backUrl: "https://servix.example",
    timeoutMs: 8000
  } as const

vi.mock("../integrations/mercado-pago-assinaturas.client.js", () => ({
  buscarAssinaturaPorReferenciaMercadoPago: mocks.buscarPorReferencia,
  cancelarAssinaturaMercadoPago: vi.fn(),
  criarAssinaturaMercadoPago: mocks.criarMercadoPago,
  ErroMercadoPagoAssinaturas: class extends Error {},
  obterAssinaturaMercadoPago: mocks.obterMercadoPago,
  obterPagamentoAutorizadoMercadoPago: vi.fn(),
  obterRequestIdMercadoPago: vi.fn(() => "mp-request-inicio")
}))

import { iniciarAssinaturaEmpresaService } from "./assinaturas.service.js"

const checkoutToken = "123e4567-e89b-12d3-a456-426614174000"
const checkoutUrl =
  "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=preapproval-123"

function criarTx() {
  return {
    $queryRaw: mocks.txQueryRaw,
    empresa: {
      findUnique: mocks.txEmpresaFindUnique,
      update: mocks.txEmpresaUpdate
    },
    assinaturaEmpresa: {
      upsert: mocks.txAssinaturaUpsert,
      findUnique: mocks.txAssinaturaFindUnique,
      update: mocks.txAssinaturaUpdate
    },
    historicoAssinaturaEmpresa: { create: mocks.txHistoricoCreate }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  mocks.obterConfiguracao.mockReturnValue(configuracaoTeste)
  mocks.txQueryRaw.mockResolvedValue([{ bloqueado: 1 }])
  mocks.txEmpresaFindUnique.mockResolvedValue({
    id: 8,
    assinatura: {
      status: StatusAssinatura.PENDENTE,
      mercadoPagoAssinaturaId: null,
      referenciaExterna: "servix_empresa_8",
      checkoutToken
    }
  })
  mocks.txAssinaturaUpsert.mockResolvedValue({
    checkoutToken,
    mercadoPagoAssinaturaId: null
  })
  mocks.txAssinaturaFindUnique.mockResolvedValue({
    id: 44,
    status: StatusAssinatura.PENDENTE,
    ativadaEm: null,
    canceladaEm: null
  })
  mocks.txAssinaturaUpdate.mockResolvedValue({
    id: 44,
    empresaId: 8,
    status: StatusAssinatura.PENDENTE,
    checkoutUrl
  })
  mocks.buscarPorReferencia.mockResolvedValue(null)
  mocks.criarMercadoPago.mockResolvedValue({
    id: "preapproval-123",
    status: "pending",
    external_reference: "servix_empresa_8",
    init_point: checkoutUrl
  })
  mocks.obterMercadoPago.mockResolvedValue({
    id: "preapproval-123",
    status: "pending",
    external_reference: "servix_empresa_8",
    init_point: checkoutUrl
  })
  mocks.transaction.mockImplementation(async callback => callback(criarTx()))
})

describe("inicio da assinatura no Mercado Pago", () => {
  it("bloqueia checkout direto de producao sem identidade legal confirmada", async () => {
    mocks.obterConfiguracao.mockReturnValue({
      ...configuracaoTeste,
      modo: "PRODUCAO"
    })
    vi.stubEnv("SERVIX_LEGAL_IDENTITY_READY", "false")

    await expect(iniciarAssinaturaEmpresaService(8, {
      emailPagador: "cliente@example.com",
      versaoTermos: "2026-08-01"
    })).rejects.toMatchObject({
      statusCode: 503,
      codigo: "IDENTIDADE_LEGAL_NAO_CONFIGURADA"
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.criarMercadoPago).not.toHaveBeenCalled()
  })

  it("mantem o lock da empresa da leitura ate persistir o preapproval", async () => {
    const resultado = await iniciarAssinaturaEmpresaService(8, {
      emailPagador: "buyer@testuser.com",
      versaoTermos: "2026-07-27"
    })

    expect(mocks.txQueryRaw).toHaveBeenCalledOnce()
    expect(mocks.txQueryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.txEmpresaFindUnique.mock.invocationCallOrder[0]!
    )
    expect(mocks.criarMercadoPago).toHaveBeenCalledOnce()
    expect(mocks.txAssinaturaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        mercadoPagoAssinaturaId: "preapproval-123",
        checkoutUrl
      })
    }))
    expect(resultado).toMatchObject({
      recuperada: false,
      assinatura: { checkoutUrl }
    })
  })

  it("serializa chamadas concorrentes e cria somente um preapproval", async () => {
    let mercadoPagoAssinaturaId: string | null = null
    let fila = Promise.resolve()
    const tx = criarTx()

    mocks.txEmpresaFindUnique.mockImplementation(async () => ({
      id: 8,
      assinatura: {
        status: StatusAssinatura.PENDENTE,
        mercadoPagoAssinaturaId,
        referenciaExterna: "servix_empresa_8",
        checkoutToken
      }
    }))
    mocks.txAssinaturaUpsert.mockImplementation(async () => ({
      checkoutToken,
      mercadoPagoAssinaturaId
    }))
    mocks.txAssinaturaUpdate.mockImplementation(async entrada => {
      const id = entrada.data.mercadoPagoAssinaturaId
      if (typeof id === "string") mercadoPagoAssinaturaId = id
      return {
        id: 44,
        empresaId: 8,
        status: StatusAssinatura.PENDENTE,
        checkoutUrl
      }
    })
    mocks.transaction.mockImplementation(callback => {
      const execucao = fila.then(() => callback(tx))
      fila = execucao.then(() => undefined, () => undefined)
      return execucao
    })

    const dados = {
      emailPagador: "buyer@testuser.com",
      versaoTermos: "2026-07-27"
    }
    const [primeira, segunda] = await Promise.all([
      iniciarAssinaturaEmpresaService(8, dados),
      iniciarAssinaturaEmpresaService(8, dados)
    ])

    expect(mocks.criarMercadoPago).toHaveBeenCalledOnce()
    expect(mocks.obterMercadoPago).toHaveBeenCalledOnce()
    expect(primeira.assinatura.checkoutUrl).toBe(checkoutUrl)
    expect(segunda.assinatura.checkoutUrl).toBe(checkoutUrl)
    expect([primeira.recuperada, segunda.recuperada]).toEqual([false, true])
  })
})
