import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  StatusAssinatura,
  StatusEmpresa
} from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  assinaturaFindUnique: vi.fn(),
  assinaturaFindFirst: vi.fn(),
  txAssinaturaFindUnique: vi.fn(),
  txAssinaturaUpdate: vi.fn(),
  txEmpresaUpdate: vi.fn(),
  txHistoricoCreate: vi.fn(),
  transaction: vi.fn(),
  cancelarMercadoPago: vi.fn(),
  obterMercadoPago: vi.fn(),
  obterPagamentoAutorizado: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    assinaturaEmpresa: {
      findUnique: mocks.assinaturaFindUnique,
      findFirst: mocks.assinaturaFindFirst
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
  obterPagamentoAutorizadoMercadoPago: mocks.obterPagamentoAutorizado,
  obterRequestIdMercadoPago: vi.fn(() => "mp-request-123")
}))

import {
  cancelarAssinaturaEmpresaService,
  processarNotificacaoAssinaturaMercadoPagoService,
  sincronizarAssinaturaEmpresaService
} from "./assinaturas.service.js"

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
      findUniqueOrThrow: mocks.txAssinaturaFindUnique,
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

describe("sincronizacao da reativacao", () => {
  it("libera a empresa e registra uma nova data de ativacao quando o provedor confirma", async () => {
    const ativacaoAnterior = new Date("2026-07-25T12:00:00.000Z")
    mocks.assinaturaFindUnique.mockResolvedValue({
      mercadoPagoAssinaturaId: "preapproval-reativada"
    })
    mocks.obterMercadoPago.mockResolvedValue({
      id: "preapproval-reativada",
      status: "authorized",
      external_reference: "servix_empresa_8_reativacao_teste"
    })
    mocks.txAssinaturaFindUnique.mockResolvedValue({
      id: 44,
      status: StatusAssinatura.PENDENTE,
      ativadaEm: ativacaoAnterior,
      canceladaEm: new Date("2026-07-26T10:00:00.000Z")
    })
    mocks.txAssinaturaUpdate.mockResolvedValue({
      empresaId: 8,
      status: StatusAssinatura.ATIVA
    })

    await sincronizarAssinaturaEmpresaService(8)

    const atualizacao = mocks.txAssinaturaUpdate.mock.calls[0]?.[0]
    expect(atualizacao.data.status).toBe(StatusAssinatura.ATIVA)
    expect(atualizacao.data.canceladaEm).toBeNull()
    expect(atualizacao.data.ativadaEm).toBeInstanceOf(Date)
    expect(atualizacao.data.ativadaEm.getTime()).toBeGreaterThan(
      ativacaoAnterior.getTime()
    )
    expect(mocks.txEmpresaUpdate).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: StatusEmpresa.ATIVA }
    })
  })

  it("mantem a empresa bloqueada quando o Mercado Pago ainda responde pending", async () => {
    mocks.assinaturaFindUnique.mockResolvedValue({
      mercadoPagoAssinaturaId: "preapproval-pendente-do-banco"
    })
    mocks.obterMercadoPago.mockResolvedValue({
      id: "preapproval-pendente-do-banco",
      status: "pending",
      external_reference: "servix_empresa_8_reativacao_teste"
    })
    mocks.txAssinaturaFindUnique.mockResolvedValue({
      id: 44,
      status: StatusAssinatura.PENDENTE,
      ativadaEm: null,
      canceladaEm: null
    })
    mocks.txAssinaturaUpdate.mockResolvedValue({
      empresaId: 8,
      status: StatusAssinatura.PENDENTE
    })

    await sincronizarAssinaturaEmpresaService(8)

    expect(mocks.obterMercadoPago).toHaveBeenCalledWith(
      "preapproval-pendente-do-banco"
    )
    expect(mocks.txAssinaturaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: StatusAssinatura.PENDENTE })
      })
    )
    expect(mocks.txEmpresaUpdate).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: StatusEmpresa.PENDENTE_ASSINATURA }
    })
    expect(mocks.txEmpresaUpdate).not.toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: StatusEmpresa.ATIVA }
    })
  })

  it("mantem a empresa suspensa quando o Mercado Pago responde cancelled", async () => {
    mocks.assinaturaFindUnique.mockResolvedValue({
      mercadoPagoAssinaturaId: "preapproval-cancelada-do-banco"
    })
    mocks.obterMercadoPago.mockResolvedValue({
      id: "preapproval-cancelada-do-banco",
      status: "cancelled",
      external_reference: "servix_empresa_8_reativacao_teste"
    })
    mocks.txAssinaturaFindUnique.mockResolvedValue({
      id: 44,
      status: StatusAssinatura.PENDENTE,
      ativadaEm: null,
      canceladaEm: null
    })
    mocks.txAssinaturaUpdate.mockResolvedValue({
      empresaId: 8,
      status: StatusAssinatura.CANCELADA
    })

    await sincronizarAssinaturaEmpresaService(8)

    expect(mocks.txEmpresaUpdate).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: StatusEmpresa.SUSPENSA }
    })
    expect(mocks.txEmpresaUpdate).not.toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: StatusEmpresa.ATIVA }
    })
  })
})

describe("faturas recorrentes da assinatura", () => {
  function prepararFatura(
    dados: Record<string, unknown>,
    statusLocal: StatusAssinatura = StatusAssinatura.ATIVA
  ) {
    mocks.obterPagamentoAutorizado.mockResolvedValue({
      id: 9001,
      preapproval_id: "preapproval-123",
      ...dados
    })
    mocks.assinaturaFindUnique.mockResolvedValueOnce({
      empresaId: 8,
      status: statusLocal
    })
  }

  it("mantem acesso durante recycling e registra inadimplencia", async () => {
    prepararFatura({
      status: "recycling",
      summarized: "pending",
      retry_attempt: 2,
      payment: { id: 7001, status: "rejected" }
    })

    const resultado = await processarNotificacaoAssinaturaMercadoPagoService(
      "subscription_authorized_payment",
      "9001"
    )

    expect(mocks.txAssinaturaUpdate).toHaveBeenCalledWith({
      where: { empresaId: 8 },
      data: {
        status: StatusAssinatura.INADIMPLENTE,
        ultimaSincronizacaoEm: expect.any(Date),
        versao: { increment: 1 }
      }
    })
    expect(mocks.txEmpresaUpdate).not.toHaveBeenCalled()
    expect(mocks.txHistoricoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: "INADIMPLENCIA_DETECTADA",
        statusNovo: StatusAssinatura.INADIMPLENTE
      })
    })
    expect(resultado).toMatchObject({
      processada: true,
      inadimplente: true,
      suspensa: false
    })
  })

  it.each([
    {
      nome: "waiting for gateway",
      fatura: {
        status: "waiting for gateway",
        payment: { status: "in_process" }
      }
    },
    {
      nome: "resumo pending",
      fatura: {
        status: "scheduled",
        summarized: "pending",
        payment: { status: "pending" }
      }
    },
    {
      nome: "processed com pagamento ainda pending",
      fatura: {
        status: "processed",
        payment: { status: "pending" }
      }
    }
  ])("nao suspende enquanto a fatura esta em $nome", async ({ fatura }) => {
    prepararFatura(fatura)

    const resultado = await processarNotificacaoAssinaturaMercadoPagoService(
      "subscription_authorized_payment",
      "9001"
    )

    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.obterMercadoPago).not.toHaveBeenCalled()
    expect(mocks.txEmpresaUpdate).not.toHaveBeenCalled()
    expect(resultado).toMatchObject({ processada: true, aguardando: true })
  })

  it("suspende depois que processed confirma pagamento rejeitado", async () => {
    prepararFatura({
      status: "processed",
      summarized: "done",
      retry_attempt: 4,
      payment: {
        id: 7001,
        status: "rejected",
        status_detail: "cc_rejected_other_reason"
      }
    })

    const resultado = await processarNotificacaoAssinaturaMercadoPagoService(
      "subscription_authorized_payment",
      "9001"
    )

    expect(mocks.txAssinaturaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusAssinatura.INADIMPLENTE
        })
      })
    )
    expect(mocks.txEmpresaUpdate).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: StatusEmpresa.SUSPENSA }
    })
    expect(resultado).toMatchObject({
      processada: true,
      inadimplente: true,
      suspensa: true
    })
  })

  it("restaura acesso quando approved e o preapproval segue autorizado", async () => {
    prepararFatura(
      {
        status: "processed",
        payment: { id: 7001, status: "approved" }
      },
      StatusAssinatura.INADIMPLENTE
    )
    mocks.obterMercadoPago.mockResolvedValue({
      id: "preapproval-123",
      status: "authorized",
      external_reference: "servix_empresa_8"
    })
    mocks.txAssinaturaFindUnique.mockResolvedValue({
      id: 44,
      status: StatusAssinatura.INADIMPLENTE,
      ativadaEm: new Date("2026-07-25T12:00:00.000Z"),
      canceladaEm: null
    })

    const resultado = await processarNotificacaoAssinaturaMercadoPagoService(
      "subscription_authorized_payment",
      "9001"
    )

    expect(mocks.obterMercadoPago).toHaveBeenCalledWith("preapproval-123")
    expect(mocks.txAssinaturaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusAssinatura.ATIVA
        })
      })
    )
    expect(mocks.txEmpresaUpdate).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { status: StatusEmpresa.ATIVA }
    })
    expect(resultado).toMatchObject({
      processada: true,
      inadimplente: false
    })
  })

  it("preapproval authorized isolado nao regulariza inadimplencia", async () => {
    mocks.obterMercadoPago.mockResolvedValue({
      id: "preapproval-123",
      status: "authorized",
      external_reference: "servix_empresa_8"
    })
    mocks.assinaturaFindFirst.mockResolvedValue({ empresaId: 8 })
    mocks.txAssinaturaFindUnique.mockResolvedValue({
      id: 44,
      status: StatusAssinatura.INADIMPLENTE,
      ativadaEm: new Date("2026-07-25T12:00:00.000Z"),
      canceladaEm: null
    })

    await processarNotificacaoAssinaturaMercadoPagoService(
      "subscription_preapproval",
      "preapproval-123"
    )

    expect(mocks.txAssinaturaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusAssinatura.INADIMPLENTE
        })
      })
    )
    expect(mocks.txEmpresaUpdate).not.toHaveBeenCalled()
  })

  it("sincronizacao manual nao regulariza inadimplencia sem pagamento approved", async () => {
    mocks.assinaturaFindUnique.mockResolvedValueOnce({
      mercadoPagoAssinaturaId: "preapproval-123"
    })
    mocks.obterMercadoPago.mockResolvedValue({
      id: "preapproval-123",
      status: "authorized",
      external_reference: "servix_empresa_8"
    })
    mocks.txAssinaturaFindUnique.mockResolvedValue({
      id: 44,
      status: StatusAssinatura.INADIMPLENTE,
      ativadaEm: new Date("2026-07-25T12:00:00.000Z"),
      canceladaEm: null
    })

    await sincronizarAssinaturaEmpresaService(8)

    expect(mocks.txAssinaturaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusAssinatura.INADIMPLENTE
        })
      })
    )
    expect(mocks.txEmpresaUpdate).not.toHaveBeenCalled()
  })

  it("solicita nova tentativa se processed nao traz resultado final", async () => {
    prepararFatura({
      status: "processed",
      payment: null
    })

    await expect(
      processarNotificacaoAssinaturaMercadoPagoService(
        "subscription_authorized_payment",
        "9001"
      )
    ).rejects.toThrow("status final de pagamento reconhecido")

    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.txEmpresaUpdate).not.toHaveBeenCalled()
  })

  it("ignora fatura atrasada de assinatura ja cancelada", async () => {
    prepararFatura(
      {
        status: "processed",
        payment: { status: "approved" }
      },
      StatusAssinatura.CANCELADA
    )

    const resultado = await processarNotificacaoAssinaturaMercadoPagoService(
      "subscription_authorized_payment",
      "9001"
    )

    expect(mocks.obterMercadoPago).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(resultado).toMatchObject({ processada: true, ignorada: true })
  })
})
