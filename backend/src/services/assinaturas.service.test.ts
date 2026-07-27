import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  StatusAssinatura,
  StatusEmpresa
} from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  assinaturaFindUnique: vi.fn(),
  txAssinaturaFindUnique: vi.fn(),
  txAssinaturaUpdate: vi.fn(),
  txEmpresaUpdate: vi.fn(),
  txHistoricoCreate: vi.fn(),
  transaction: vi.fn(),
  cancelarMercadoPago: vi.fn(),
  obterMercadoPago: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    assinaturaEmpresa: {
      findUnique: mocks.assinaturaFindUnique
    },
    $transaction: mocks.transaction
  }
}))

vi.mock("../config/env.js", () => ({
  obterConfiguracaoAssinaturasMercadoPago: vi.fn()
}))

vi.mock("../integrations/mercado-pago-assinaturas.client.js", () => ({
  buscarAssinaturaPorReferenciaMercadoPago: vi.fn(),
  cancelarAssinaturaMercadoPago: mocks.cancelarMercadoPago,
  criarAssinaturaMercadoPago: vi.fn(),
  ErroMercadoPagoAssinaturas: class extends Error {},
  obterAssinaturaMercadoPago: mocks.obterMercadoPago,
  obterPagamentoAutorizadoMercadoPago: vi.fn(),
  obterRequestIdMercadoPago: vi.fn(() => "mp-request-123")
}))

import { cancelarAssinaturaEmpresaService } from "./assinaturas.service.js"

beforeEach(() => {
  vi.clearAllMocks()

  mocks.assinaturaFindUnique.mockResolvedValue({
    status: StatusAssinatura.ATIVA,
    mercadoPagoAssinaturaId: "preapproval-123"
  })
  mocks.cancelarMercadoPago.mockResolvedValue({
    id: "preapproval-123",
    status: "cancelled",
    external_reference: "servix_empresa_8"
  })
  mocks.txAssinaturaFindUnique.mockResolvedValue({
    id: 44,
    status: StatusAssinatura.ATIVA,
    ativadaEm: new Date("2026-07-25T12:00:00.000Z"),
    canceladaEm: null
  })
  mocks.txAssinaturaUpdate.mockResolvedValue({
    empresaId: 8,
    status: StatusAssinatura.CANCELADA
  })
  mocks.txEmpresaUpdate.mockResolvedValue({ id: 8 })
  mocks.txHistoricoCreate.mockResolvedValue({ id: 1 })
  mocks.transaction.mockImplementation(async callback => callback({
    assinaturaEmpresa: {
      findUnique: mocks.txAssinaturaFindUnique,
      update: mocks.txAssinaturaUpdate
    },
    empresa: {
      update: mocks.txEmpresaUpdate
    },
    historicoAssinaturaEmpresa: {
      create: mocks.txHistoricoCreate
    }
  }))
})

describe("cancelamento da assinatura Servix", () => {
  it("suspende a empresa somente depois da confirmacao do Mercado Pago", async () => {
    const resultado = await cancelarAssinaturaEmpresaService(8)

    expect(mocks.cancelarMercadoPago).toHaveBeenCalledWith("preapproval-123")
    expect(mocks.txAssinaturaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { empresaId: 8 },
      data: expect.objectContaining({
        status: StatusAssinatura.CANCELADA,
        canceladaEm: expect.any(Date),
        ultimaSincronizacaoEm: expect.any(Date)
      })
    }))
    expect(mocks.txEmpresaUpdate).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: StatusEmpresa.SUSPENSA }
    })
    expect(mocks.txHistoricoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        empresaId: 8,
        assinaturaEmpresaId: 44,
        tipo: "CANCELADA",
        requestIdProvedor: "mp-request-123"
      })
    })
    expect(resultado).toMatchObject({
      empresaId: 8,
      status: StatusAssinatura.CANCELADA
    })
  })

  it("nao suspende a empresa quando o provedor nao confirma o cancelamento", async () => {
    mocks.cancelarMercadoPago.mockResolvedValue({
      id: "preapproval-123",
      status: "authorized"
    })
    mocks.obterMercadoPago.mockResolvedValue({
      id: "preapproval-123",
      status: "authorized"
    })

    await expect(cancelarAssinaturaEmpresaService(8)).rejects.toMatchObject({
      statusCode: 409,
      codigo: "CANCELAMENTO_ASSINATURA_NAO_CONFIRMADO"
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.txEmpresaUpdate).not.toHaveBeenCalled()
  })
})
