import { beforeEach, describe, expect, it, vi } from "vitest"

import { Prisma } from "../generated/prisma/client.js"
import {
  StatusMovimentacaoFinanceira,
  TipoMovimentacaoFinanceira
} from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  listarContas: vi.fn(),
  listarMovimentos: vi.fn(),
  listarLancamentos: vi.fn(),
  agregarOrdens: vi.fn(),
  contarOrdens: vi.fn(),
  listarOrdens: vi.fn(),
  agregarPagamentos: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    contaFinanceira: { findMany: prismaMocks.listarContas },
    movimentacaoFinanceira: { findMany: prismaMocks.listarMovimentos },
    lancamentoFinanceiro: { findMany: prismaMocks.listarLancamentos },
    ordemServico: {
      aggregate: prismaMocks.agregarOrdens,
      count: prismaMocks.contarOrdens,
      findMany: prismaMocks.listarOrdens
    },
    pagamento: { aggregate: prismaMocks.agregarPagamentos }
  }
}))

import {
  buscarFluxoCaixaFinanceiroService,
  buscarResumoServicosFinanceiroService
} from "./financeiro-relatorios.service.js"

beforeEach(() => {
  vi.clearAllMocks()
})
describe("fluxo de caixa financeiro", () => {
  it("respeita a data do saldo inicial e injeta contas abertas dentro do período", async () => {
    prismaMocks.listarContas.mockResolvedValue([
      {
        id: 1,
        saldoInicial: new Prisma.Decimal(100),
        dataSaldoInicial: new Date("2026-06-30T12:00:00.000Z")
      },
      {
        id: 2,
        saldoInicial: new Prisma.Decimal(50),
        dataSaldoInicial: new Date("2026-07-02T12:00:00.000Z")
      }
    ])
    prismaMocks.listarMovimentos
      .mockResolvedValueOnce([
        {
          contaId: 1,
          tipo: TipoMovimentacaoFinanceira.ENTRADA,
          valor: new Prisma.Decimal(20),
          movimentadoEm: new Date("2026-06-29T12:00:00.000Z")
        },
        {
          contaId: 1,
          tipo: TipoMovimentacaoFinanceira.ENTRADA,
          valor: new Prisma.Decimal(30),
          movimentadoEm: new Date("2026-06-30T13:00:00.000Z")
        },
        {
          contaId: 2,
          tipo: TipoMovimentacaoFinanceira.ENTRADA,
          valor: new Prisma.Decimal(10),
          movimentadoEm: new Date("2026-07-01T12:00:00.000Z")
        }
      ])
      .mockResolvedValueOnce([
        {
          contaId: 1,
          tipo: TipoMovimentacaoFinanceira.SAIDA,
          status: StatusMovimentacaoFinanceira.CONFIRMADA,
          valor: new Prisma.Decimal(5),
          movimentadoEm: new Date("2026-07-01T13:00:00.000Z")
        },
        {
          contaId: 2,
          tipo: TipoMovimentacaoFinanceira.ENTRADA,
          status: StatusMovimentacaoFinanceira.CONFIRMADA,
          valor: new Prisma.Decimal(7),
          movimentadoEm: new Date("2026-07-02T10:00:00.000Z")
        },
        {
          contaId: 2,
          tipo: TipoMovimentacaoFinanceira.ENTRADA,
          status: StatusMovimentacaoFinanceira.CONFIRMADA,
          valor: new Prisma.Decimal(8),
          movimentadoEm: new Date("2026-07-02T13:00:00.000Z")
        }
      ])
    prismaMocks.listarLancamentos.mockResolvedValue([])

    const resultado = await buscarFluxoCaixaFinanceiroService(1, {
      inicio: new Date("2026-07-01T12:00:00.000Z"),
      fim: new Date("2026-07-03T12:00:00.000Z")
    })

    expect(resultado.sucesso).toBe(true)
    if (!resultado.sucesso) return
    expect(resultado.fluxo.saldoInicialPeriodo.toFixed(2)).toBe("130.00")
    expect(resultado.fluxo.dias[0]?.saldoRealizadoAcumulado.toFixed(2)).toBe("125.00")
    expect(resultado.fluxo.dias[1]?.saldosIniciais.toFixed(2)).toBe("50.00")
    expect(resultado.fluxo.dias[1]?.saldoRealizadoAcumulado.toFixed(2)).toBe("183.00")
    expect(resultado.fluxo.totais.saldosIniciais.toFixed(2)).toBe("50.00")
  })
})

describe("resumo financeiro dos servicos", () => {
  it("soma ordens e pagamentos confirmados sem misturar servicos cancelados", async () => {
    prismaMocks.agregarOrdens.mockResolvedValue({
      _sum: { valor: new Prisma.Decimal(1000) },
      _avg: { valor: new Prisma.Decimal(500) },
      _count: { _all: 2 }
    })
    prismaMocks.contarOrdens.mockResolvedValue(1)
    prismaMocks.agregarPagamentos
      .mockResolvedValueOnce({ _sum: { valor: new Prisma.Decimal(600) } })
      .mockResolvedValueOnce({ _sum: { valor: new Prisma.Decimal(150) } })
      .mockResolvedValueOnce({ _sum: { valor: new Prisma.Decimal(450) } })
    prismaMocks.listarOrdens.mockResolvedValue([
      {
        id: 9,
        numero: 1048,
        equipamento: "Celular",
        status: "EM_EXECUCAO",
        valor: new Prisma.Decimal(750),
        criadoEm: new Date("2026-07-29T12:00:00.000Z"),
        cliente: { nome: "Cliente teste" },
        pagamentos: [{ valor: new Prisma.Decimal(150) }]
      }
    ])

    const resultado = await buscarResumoServicosFinanceiroService(
      7,
      new Date("2026-07-29T15:00:00.000Z")
    )

    expect(resultado.ambiente).toBe("PREVIEW")
    expect(resultado.indicadores.valorTotalServicos.toFixed(2)).toBe("1000.00")
    expect(resultado.indicadores.recebidoHoje.toFixed(2)).toBe("150.00")
    expect(resultado.indicadores.recebidoNoMes.toFixed(2)).toBe("450.00")
    expect(resultado.indicadores.aReceber.toFixed(2)).toBe("400.00")
    expect(resultado.indicadores.quantidadeServicos).toBe(2)
    expect(resultado.indicadores.servicosEmAberto).toBe(1)
    expect(resultado.servicosRecentes[0]?.saldo.toFixed(2)).toBe("600.00")

    expect(prismaMocks.agregarPagamentos).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          pagoEm: {
            gte: new Date("2026-07-29T03:00:00.000Z"),
            lt: new Date("2026-07-30T03:00:00.000Z")
          }
        })
      })
    )
  })
})
