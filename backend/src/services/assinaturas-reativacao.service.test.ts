import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  AmbienteAssinatura,
  ProvedorAssinatura,
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
  txQueryRaw: vi.fn(),
  buscarPorReferencia: vi.fn(),
  criarMercadoPago: vi.fn(),
  cancelarMercadoPago: vi.fn(),
  obterMercadoPago: vi.fn(),
  obterConfiguracao: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    assinaturaEmpresa: { findUnique: mocks.assinaturaFindUnique },
    $transaction: mocks.transaction
  }
}))

vi.mock("../config/env.js", () => ({
  obterConfiguracaoAssinaturasMercadoPago: mocks.obterConfiguracao
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
  vi.unstubAllEnvs()
  mocks.obterConfiguracao.mockReturnValue({
    status: "CONFIGURADA",
    modo: "TESTE",
    accessToken: "nao-exposto",
    publicKey: null,
    planId: null,
    backUrl: "https://servix.example",
    timeoutMs: 8000
  })
  mocks.assinaturaFindUnique.mockResolvedValue({ versao: 5 })
  mocks.txQueryRaw.mockResolvedValue([{ bloqueado: 1 }])
  mocks.txAssinaturaFindUnique.mockResolvedValue({
    id: 44,
    status: StatusAssinatura.CANCELADA,
    ambiente: AmbienteAssinatura.TESTE,
    provedor: ProvedorAssinatura.MERCADO_PAGO_SERVIX,
    emailPagador: "buyer@testuser.com",
    referenciaExterna: "servix_empresa_8",
    mercadoPagoAssinaturaId: "preapproval-antiga",
    checkoutUrl: null,
    valorMensal: "79.90",
    versao: 5,
    ativadaEm: new Date("2026-07-25T10:00:00.000Z"),
    canceladaEm: new Date("2026-07-26T10:00:00.000Z")
  })
  mocks.buscarPorReferencia.mockResolvedValue(null)
  mocks.criarMercadoPago.mockResolvedValue({
    id: "preapproval-nova",
    status: "authorized",
    external_reference: "referencia-reativacao",
    init_point: "https://www.mercadopago.com.br/subscriptions/checkout"
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
    $queryRaw: mocks.txQueryRaw,
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

    expect(mocks.txQueryRaw).toHaveBeenCalledOnce()
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
        ambiente: AmbienteAssinatura.TESTE,
        provedor: ProvedorAssinatura.MERCADO_PAGO_SERVIX,
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
    mocks.txAssinaturaFindUnique.mockResolvedValue({
      id: 44,
      status: StatusAssinatura.PENDENTE,
      ambiente: AmbienteAssinatura.TESTE,
      provedor: ProvedorAssinatura.MERCADO_PAGO_SERVIX,
      emailPagador: "buyer@testuser.com",
      referenciaExterna: "servix_empresa_8_reativacao_anterior",
      mercadoPagoAssinaturaId: "preapproval-pendente",
      checkoutUrl: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=preapproval-pendente",
      valorMensal: "79.90",
      versao: 5,
      ativadaEm: null,
      canceladaEm: null
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

  it("reutiliza o checkout criado por uma requisicao concorrente", async () => {
    mocks.txAssinaturaFindUnique.mockResolvedValue({
      id: 44,
      status: StatusAssinatura.PENDENTE,
      ambiente: AmbienteAssinatura.TESTE,
      provedor: ProvedorAssinatura.MERCADO_PAGO_SERVIX,
      emailPagador: "buyer@testuser.com",
      referenciaExterna: "servix_empresa_8_reativacao_6",
      mercadoPagoAssinaturaId: "preapproval-concorrente",
      checkoutUrl: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=preapproval-concorrente",
      valorMensal: "79.90",
      versao: 7,
      ativadaEm: null,
      canceladaEm: null
    })

    const resultado = await reativarAssinaturaEmpresaService(8, {
      gerarNovoCheckout: true
    })

    expect(resultado).toMatchObject({ recuperada: true })
    expect(mocks.obterMercadoPago).not.toHaveBeenCalled()
    expect(mocks.cancelarMercadoPago).not.toHaveBeenCalled()
    expect(mocks.criarMercadoPago).not.toHaveBeenCalled()
  })

  it("atualiza ambiente e provedor ao reativar depois da mudanca para producao", async () => {
    vi.stubEnv("SERVIX_LEGAL_IDENTITY_READY", "true")
    mocks.obterConfiguracao.mockReturnValue({
      status: "CONFIGURADA",
      modo: "PRODUCAO",
      accessToken: "nao-exposto",
      publicKey: null,
      planId: null,
      backUrl: "https://servix.example",
      timeoutMs: 8000
    })
    mocks.txAssinaturaFindUnique.mockResolvedValue({
      id: 44,
      status: StatusAssinatura.CANCELADA,
      ambiente: AmbienteAssinatura.TESTE,
      provedor: ProvedorAssinatura.SIMULADO,
      emailPagador: "cliente@example.com",
      referenciaExterna: "servix_empresa_8",
      mercadoPagoAssinaturaId: null,
      checkoutUrl: null,
      valorMensal: "79.90",
      versao: 5,
      ativadaEm: null,
      canceladaEm: new Date("2026-07-26T10:00:00.000Z")
    })

    await reativarAssinaturaEmpresaService(8)

    expect(mocks.txAssinaturaUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        ambiente: AmbienteAssinatura.PRODUCAO,
        provedor: ProvedorAssinatura.MERCADO_PAGO_SERVIX
      })
    }))
  })

  it("bloqueia reativacao de producao sem identidade legal confirmada", async () => {
    mocks.obterConfiguracao.mockReturnValue({
      status: "CONFIGURADA",
      modo: "PRODUCAO",
      accessToken: "nao-exposto",
      publicKey: null,
      planId: null,
      backUrl: "https://servix.example",
      timeoutMs: 8000
    })
    vi.stubEnv("SERVIX_LEGAL_IDENTITY_READY", "false")

    await expect(reativarAssinaturaEmpresaService(8)).rejects.toMatchObject({
      statusCode: 503,
      codigo: "IDENTIDADE_LEGAL_NAO_CONFIGURADA"
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.criarMercadoPago).not.toHaveBeenCalled()
  })
})
