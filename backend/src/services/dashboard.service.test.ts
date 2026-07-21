import { beforeEach, describe, expect, it, vi } from "vitest"

import { StatusOrdem } from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  contarClientes: vi.fn(),
  agruparOrdens: vi.fn(),
  listarOrdensRecentes: vi.fn(),
  executarTransacao: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    cliente: {
      count: prismaMocks.contarClientes
    },
    ordemServico: {
      groupBy: prismaMocks.agruparOrdens,
      findMany: prismaMocks.listarOrdensRecentes
    },
    $transaction: prismaMocks.executarTransacao
  }
}))

import { buscarResumoDashboardService } from "./dashboard.service.js"

describe("buscarResumoDashboardService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("monta o resumo da empresa e completa status ausentes com zero", async () => {
    const criadoEm = new Date("2026-07-21T12:00:00.000Z")
    const ordensRecentes = [
      {
        id: 7,
        equipamento: "Notebook",
        status: StatusOrdem.EM_ANDAMENTO,
        criadoEm,
        cliente: {
          id: 3,
          nome: "Cliente Teste"
        }
      }
    ]

    prismaMocks.executarTransacao.mockResolvedValue([
      4,
      [
        {
          status: StatusOrdem.ABERTA,
          _count: { _all: 2 }
        },
        {
          status: StatusOrdem.EM_ANDAMENTO,
          _count: { _all: 1 }
        }
      ],
      ordensRecentes
    ])

    const resumo = await buscarResumoDashboardService(12)

    expect(prismaMocks.contarClientes).toHaveBeenCalledWith({
      where: { empresaId: 12 }
    })
    expect(prismaMocks.agruparOrdens).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 12 } })
    )
    expect(prismaMocks.listarOrdensRecentes).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { empresaId: 12 },
        take: 5
      })
    )

    expect(resumo.clientes.total).toBe(4)
    expect(resumo.ordens.total).toBe(3)
    expect(resumo.ordens.porStatus.ABERTA).toBe(2)
    expect(resumo.ordens.porStatus.EM_ANDAMENTO).toBe(1)
    expect(resumo.ordens.porStatus.CONCLUIDA).toBe(0)
    expect(resumo.ordens.recentes).toEqual(ordensRecentes)
  })
})
