import { beforeEach, describe, expect, it, vi } from "vitest"

import { Prisma } from "../generated/prisma/client.js"
import {
  StatusMovimentacaoFinanceira,
  TipoMovimentacaoFinanceira
} from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  listarContas: vi.fn(),
  listarMovimentos: vi.fn(),
  listarLancamentos: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    contaFinanceira: { findMany: prismaMocks.listarContas },
    movimentacaoFinanceira: { findMany: prismaMocks.listarMovimentos },
    lancamentoFinanceiro: { findMany: prismaMocks.listarLancamentos }
  }
}))

import { buscarFluxoCaixaFinanceiroService } from "./financeiro-relatorios.service.js"

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
