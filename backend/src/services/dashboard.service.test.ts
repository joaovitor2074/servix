import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  StatusOrcamento,
  StatusOrdem,
  StatusRegistroPagamento
} from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  contarClientes: vi.fn(),
  agruparOrdens: vi.fn(),
  listarOrdens: vi.fn(),
  agruparOrcamentos: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    cliente: {
      count: prismaMocks.contarClientes
    },
    ordemServico: {
      groupBy: prismaMocks.agruparOrdens,
      findMany: prismaMocks.listarOrdens
    },
    orcamento: {
      groupBy: prismaMocks.agruparOrcamentos
    }
  }
}))

import { buscarResumoDashboardService } from "./dashboard.service.js"

describe("buscarResumoDashboardService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("monta indicadores e filas operacionais isolados por empresa", async () => {
    const criadoEm = new Date("2026-07-18T12:00:00.000Z")
    const atualizadoEm = new Date("2026-07-21T12:00:00.000Z")
    const cliente = { id: 3, nome: "Cliente Teste" }
    const ordemBase = {
      equipamento: "Notebook",
      criadoEm,
      atualizadoEm,
      previsaoDeEntrega: null,
      cliente
    }
    const ordensEmAberto = [
      {
        ...ordemBase,
        id: 7,
        status: StatusOrdem.EM_EXECUCAO
      }
    ]
    const ordensComPendencia = [
      {
        ...ordemBase,
        id: 8,
        status: StatusOrdem.AGUARDANDO_PECA,
        valor: "120.00",
        pagamentos: []
      },
      {
        ...ordemBase,
        id: 9,
        status: StatusOrdem.PRONTO,
        valor: "300.00",
        pagamentos: [
          {
            valor: "100.00",
            status: StatusRegistroPagamento.CONFIRMADO
          }
        ]
      },
      {
        ...ordemBase,
        id: 10,
        status: StatusOrdem.PRONTO,
        valor: "150.00",
        pagamentos: [
          {
            valor: "150.00",
            status: StatusRegistroPagamento.CONFIRMADO
          }
        ]
      }
    ]
    prismaMocks.contarClientes.mockResolvedValue(4)
    prismaMocks.agruparOrdens.mockResolvedValue([
        { status: StatusOrdem.RECEBIDO, _count: { _all: 2 } },
        { status: StatusOrdem.EM_EXECUCAO, _count: { _all: 1 } },
        { status: StatusOrdem.AGUARDANDO_PECA, _count: { _all: 1 } },
        { status: StatusOrdem.PRONTO, _count: { _all: 2 } },
        { status: StatusOrdem.ENTREGUE, _count: { _all: 4 } },
        { status: StatusOrdem.CANCELADO, _count: { _all: 1 } }
    ])
    prismaMocks.listarOrdens
      .mockResolvedValueOnce(ordensEmAberto)
      .mockResolvedValueOnce(ordensComPendencia)
    prismaMocks.agruparOrcamentos.mockResolvedValue([
        { status: StatusOrcamento.ENVIADO, _count: { _all: 3 } },
        { status: StatusOrcamento.APROVADO, _count: { _all: 2 } }
    ])

    const resumo = await buscarResumoDashboardService(12)

    expect(prismaMocks.contarClientes).toHaveBeenCalledWith({
      where: { empresaId: 12 }
    })
    expect(prismaMocks.agruparOrdens).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 12 } })
    )
    expect(prismaMocks.listarOrdens).toHaveBeenCalledTimes(2)
    expect(prismaMocks.listarOrdens).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ empresaId: 12 }),
        take: 8
      })
    )
    expect(prismaMocks.listarOrdens).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ empresaId: 12 }),
        take: 8,
        select: expect.objectContaining({ pagamentos: expect.any(Object) })
      })
    )
    expect(prismaMocks.agruparOrcamentos).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ empresaId: 12 })
      })
    )
    expect(resumo.clientes.total).toBe(4)
    expect(resumo.ordens.total).toBe(11)
    expect(resumo.ordens.abertas).toBe(6)
    expect(resumo.ordens.aguardandoPeca).toBe(1)
    expect(resumo.ordens.prontasParaFinalizar).toBe(2)
    expect(resumo.ordens.porStatus.EM_ANALISE).toBe(0)
    expect(resumo.ordens.emAberto).toEqual(ordensEmAberto)
    expect(resumo.orcamentos).toEqual({
      aguardandoCliente: 3,
      aprovadosParaOrdem: 2
    })
    expect(resumo.ordens.pendencias).toEqual([
      expect.objectContaining({
        id: 8,
        tipo: "AGUARDANDO_PECA",
        pagamento: null
      }),
      expect.objectContaining({
        id: 9,
        tipo: "AGUARDANDO_PAGAMENTO",
        pagamento: expect.objectContaining({
          status: "PARCIAL",
          totalPago: "100.00",
          saldo: "200.00"
        })
      }),
      expect.objectContaining({
        id: 10,
        tipo: "AGUARDANDO_ENTREGA",
        pagamento: expect.objectContaining({
          status: "PAGO",
          saldo: "0.00"
        })
      })
    ])
  })

  it("retorna zero e listas vazias quando a empresa ainda nao tem operacao", async () => {
    prismaMocks.contarClientes.mockResolvedValue(0)
    prismaMocks.agruparOrdens.mockResolvedValue([])
    prismaMocks.listarOrdens.mockResolvedValue([])
    prismaMocks.agruparOrcamentos.mockResolvedValue([])

    const resumo = await buscarResumoDashboardService(99)

    expect(resumo).toEqual({
      clientes: { total: 0 },
      ordens: {
        total: 0,
        abertas: 0,
        aguardandoPeca: 0,
        prontasParaFinalizar: 0,
        emAberto: [],
        pendencias: [],
        porStatus: expect.objectContaining({
          RECEBIDO: 0,
          EM_ANALISE: 0,
          EM_EXECUCAO: 0,
          AGUARDANDO_PECA: 0,
          PRONTO: 0,
          ENTREGUE: 0,
          CANCELADO: 0
        })
      },
      orcamentos: {
        aguardandoCliente: 0,
        aprovadosParaOrdem: 0
      }
    })
  })
})
