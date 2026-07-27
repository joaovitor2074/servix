import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  StatusAssinatura,
  StatusEmpresa,
  TipoHistoricoAssinatura
} from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  assinaturaFindUnique: vi.fn(),
  transaction: vi.fn(),
  txAssinaturaFindUnique: vi.fn(),
  txAssinaturaUpdate: vi.fn(),
  txEmpresaUpdate: vi.fn(),
  txHistoricoCreate: vi.fn(),
  buscarPorReferencia: vi.fn(),
  criarMercadoPago: vi.fn(),
  cancelarMercadoPago: vi.fn(),
  obterMercadoPago: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    assinaturaEmpresa: { findUnique: mocks.assinaturaFindUnique },
    $transaction: mocks.transaction
  }
}))

vi.mock("../config/env.js", () => ({
  obterConfiguracaoAssinaturasMercadoPago: vi.fn(() => ({
    status: "CONFIGURADA",
    modo: "TESTE",
    accessToken: "nao-exposto",
    publicKey: null,
    planId: null,
    backUrl: "https://servix.example",
    timeoutMs: 8000
  }))
}))

vi.mock("../integrations/mercado-pago-assinaturas.client.js", () => ({
  buscarAssinaturaPorReferenciaMercadoPago: mocks.buscarPorReferencia,
  cancelarAssinaturaMercadoPago: mocks.cancelarMercadoPago,
  criarAssinaturaMercadoPago: mocks.criarMercadoPago,
  ErroMercadoPagoAssinaturas: class extends Error {},
  obterAssinaturaMercadoPago: mocks.obterMercadoPago,
  obterPagamentoAutorizadoMercadoPago: vi.fn(),
  obterRequestIdMercadoPago: vi.fn(() => "mp-request-reativacao")
}))

import { reativarAssinaturaEmpresaService } from "./assinaturas.service.js"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.assinaturaFindUnique.mockResolvedValue({
    id: 44,
    status: StatusAssinatura.CANCELADA,
    emailPagador: "buyer@testuser.com",
    referenciaExterna: "servix_empresa_8",
    mercadoPagoAssinaturaId: "preapproval-antiga",
    checkoutUrl: null,
    valorMensal: "79.90"
  })
  mocks.buscarPorReferencia.mockResolvedValue(null)
  mocks.criarMercadoPago.mockResolvedValue({
    id: "preapproval-nova",
    status: "authorized",
    external_reference: "referencia-reativacao",
    init_point: "https://www.mercadopago.com.br/subscriptions/checkout"
  })
  mocks.txAssinaturaFindUnique.mockResolvedValue({
    id: 44,
    status: StatusAssinatura.PENDENTE,
    ativadaEm: new Date("2026-07-25T10:00:00.000Z"),
    canceladaEm: new Date("2026-07-26T10:00:00.000Z")
  })
  mocks.txAssinaturaUpdate
    .mockResolvedValueOnce({ id: 44 })
    .mockResolvedValueOnce({
      id: 44,
      empresaId: 8,
      status: StatusAssinatura.PENDENTE,
      checkoutUrl: "https://www.mercadopago.com.br/subscriptions/checkout"
    })
  mocks.transaction.mockImplementation(async callback => callback({
    assinaturaEmpresa: {
      findUnique: mocks.txAssinaturaFindUnique,
      update: mocks.txAssinaturaUpdate
    },
    empresa: { update: mocks.txEmpresaUpdate },
    historicoAssinaturaEmpresa: { create: mocks.txHistoricoCreate }
  }))
})

describe("reativacao de assinatura cancelada", () => {
  it("gera uma nova recorrencia e mantem a empresa bloqueada ate o webhook", async () => {
    const resultado = await reativarAssinaturaEmpresaService(8)

    expect(mocks.criarMercadoPago).toHaveBeenCalledWith(expect.objectContaining({
      emailPagador: "buyer@testuser.com",
      backUrl: "https://servix.example/assinatura-suspensa?retorno=mercado-pago"
    }))
    expect(mocks.txEmpresaUpdate).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: StatusEmpresa.PENDENTE_ASSINATURA }
    })
    expect(mocks.txHistoricoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: TipoHistoricoAssinatura.REATIVACAO_SOLICITADA,
        mercadoPagoAssinaturaId: "preapproval-antiga"
      })
    })
    expect(mocks.txAssinaturaUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: StatusAssinatura.PENDENTE })
    }))
    expect(mocks.txAssinaturaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ativadaEm: null,
        canceladaEm: null,
        proximaCobrancaEm: null,
        ultimaSincronizacaoEm: null
      })
    }))
    expect(resultado).toMatchObject({
      status: StatusAssinatura.PENDENTE,
      checkoutUrl: "https://www.mercadopago.com.br/subscriptions/checkout"
    })
  })

  it("cancela a tentativa pendente e gera outro checkout quando solicitado", async () => {
    mocks.assinaturaFindUnique.mockResolvedValue({
      id: 44,
      status: StatusAssinatura.PENDENTE,
      emailPagador: "buyer@testuser.com",
      referenciaExterna: "servix_empresa_8_reativacao_anterior",
      mercadoPagoAssinaturaId: "preapproval-pendente",
      checkoutUrl: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=preapproval-pendente",
      valorMensal: "79.90"
    })
    mocks.obterMercadoPago.mockResolvedValue({
      id: "preapproval-pendente",
      status: "pending",
      external_reference: "servix_empresa_8_reativacao_anterior"
    })
    mocks.cancelarMercadoPago.mockResolvedValue({
      id: "preapproval-pendente",
      status: "cancelled"
    })

    await reativarAssinaturaEmpresaService(8, { gerarNovoCheckout: true })

    expect(mocks.cancelarMercadoPago).toHaveBeenCalledWith("preapproval-pendente")
    expect(mocks.criarMercadoPago).toHaveBeenCalledOnce()
    expect(mocks.criarMercadoPago).toHaveBeenCalledWith(expect.objectContaining({
      referenciaExterna: expect.stringMatching(/^servix_empresa_8_reativacao_/)
    }))
    expect(mocks.txHistoricoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: TipoHistoricoAssinatura.REATIVACAO_SOLICITADA,
        mercadoPagoAssinaturaId: "preapproval-pendente"
      })
    })
  })
})
