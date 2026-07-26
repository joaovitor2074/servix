import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  AmbienteFinanceiro,
  StatusMovimentacaoFinanceira,
  TipoMovimentacaoFinanceira
} from "../generated/prisma/enums.js"

const txMocks = vi.hoisted(() => ({
  contaBuscar: vi.fn(),
  contasListar: vi.fn(),
  movimentoCriar: vi.fn(),
  movimentoBuscar: vi.fn(),
  movimentosAtualizar: vi.fn(),
  movimentosListar: vi.fn()
}))

const transacaoMocks = vi.hoisted(() => ({ bloquear: vi.fn() }))
const prismaMocks = vi.hoisted(() => ({
  listar: vi.fn(),
  contar: vi.fn(),
  transacao: vi.fn()
}))

const tx = {
  contaFinanceira: {
    findUnique: txMocks.contaBuscar,
    findMany: txMocks.contasListar
  },
  movimentacaoFinanceira: {
    create: txMocks.movimentoCriar,
    findUnique: txMocks.movimentoBuscar,
    updateMany: txMocks.movimentosAtualizar,
    findMany: txMocks.movimentosListar
  }
}

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    movimentacaoFinanceira: {
      findMany: prismaMocks.listar,
      count: prismaMocks.contar
    },
    $transaction: prismaMocks.transacao
  }
}))
vi.mock("../lib/transacao.js", () => ({
  bloquearFinanceiroPreviewDaEmpresaTx: transacaoMocks.bloquear,
  executarTransacaoComRollback: vi.fn(
    async (executar: (cliente: typeof tx) => Promise<unknown>) => executar(tx)
  )
}))
vi.mock("./financeiro-auditoria.service.js", () => ({
  registrarAuditoriaFinanceiraTx: vi.fn()
}))

import {
  criarAjusteFinanceiroService,
  criarTransferenciaFinanceiraService,
  estornarMovimentacaoAvulsaFinanceiraService,
  listarMovimentacoesFinanceirasService
} from "./financeiro-movimentacoes.service.js"

beforeEach(() => {
  vi.clearAllMocks()
  transacaoMocks.bloquear.mockResolvedValue(undefined)
  prismaMocks.transacao.mockImplementation(async (operacoes: unknown[]) => Promise.all(operacoes))
})

describe("financeiro-movimentacoes.service", () => {
  it("trata o fim do filtro como o início exclusivo do dia seguinte", async () => {
    prismaMocks.listar.mockResolvedValue([])
    prismaMocks.contar.mockResolvedValue(0)

    await listarMovimentacoesFinanceirasService(1, {
      pagina: 1,
      limite: 20,
      incluirEstornadas: false,
      inicio: new Date("2026-07-01T12:00:00.000Z"),
      fim: new Date("2026-07-24T12:00:00.000Z")
    })

    expect(prismaMocks.listar).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        movimentadoEm: {
          gte: new Date("2026-07-01T00:00:00.000Z"),
          lt: new Date("2026-07-25T00:00:00.000Z")
        }
      })
    }))
  })

  it("rejeita conta de outro tenant no ajuste", async () => {
    txMocks.contaBuscar.mockResolvedValue(null)

    const resultado = await criarAjusteFinanceiroService(1, 3, {
      contaId: 88,
      direcao: "ENTRADA",
      valor: 25,
      descricao: "Ajuste de conferência",
      movimentadoEm: new Date("2026-07-24T12:00:00.000Z")
    })

    expect(resultado).toEqual({ sucesso: false, motivo: "conta_invalida" })
    expect(txMocks.contaBuscar).toHaveBeenCalledWith({
      where: {
        id_empresaId_ambiente: {
          id: 88,
          empresaId: 1,
          ambiente: AmbienteFinanceiro.PREVIEW
        }
      }
    })
    expect(txMocks.movimentoCriar).not.toHaveBeenCalled()
  })

  it("cria as duas pernas da transferência no mesmo grupo", async () => {
    const dataSaldoInicial = new Date("2026-07-01T00:00:00.000Z")
    txMocks.contasListar.mockResolvedValue([
      { id: 1, nome: "Caixa", dataSaldoInicial },
      { id: 2, nome: "Banco", dataSaldoInicial }
    ])
    txMocks.movimentoCriar
      .mockResolvedValueOnce({ id: 10, tipo: TipoMovimentacaoFinanceira.TRANSFERENCIA_SAIDA })
      .mockResolvedValueOnce({ id: 11, tipo: TipoMovimentacaoFinanceira.TRANSFERENCIA_ENTRADA })

    const resultado = await criarTransferenciaFinanceiraService(1, 3, {
      contaOrigemId: 1,
      contaDestinoId: 2,
      valor: 80,
      descricao: "Reforço bancário",
      movimentadoEm: new Date("2026-07-24T12:00:00.000Z")
    })

    expect(resultado.sucesso).toBe(true)
    expect(txMocks.movimentoCriar).toHaveBeenCalledTimes(2)
    const saida = txMocks.movimentoCriar.mock.calls[0]?.[0].data
    const entrada = txMocks.movimentoCriar.mock.calls[1]?.[0].data
    expect(saida.tipo).toBe(TipoMovimentacaoFinanceira.TRANSFERENCIA_SAIDA)
    expect(entrada.tipo).toBe(TipoMovimentacaoFinanceira.TRANSFERENCIA_ENTRADA)
    expect(saida.grupoTransferencia).toBe(entrada.grupoTransferencia)
    expect(saida.grupoTransferencia).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("estorna as duas pernas de uma transferência de forma atômica", async () => {
    const criadoEm = new Date("2026-07-24T12:00:00.000Z")
    txMocks.movimentoBuscar.mockResolvedValue({
      id: 10,
      empresaId: 1,
      ambiente: AmbienteFinanceiro.PREVIEW,
      lancamentoId: null,
      status: StatusMovimentacaoFinanceira.CONFIRMADA,
      grupoTransferencia: "grupo-123",
      criadoEm
    })
    txMocks.movimentosAtualizar.mockResolvedValue({ count: 2 })
    txMocks.movimentosListar
      .mockResolvedValueOnce([
        { criadoEm },
        { criadoEm: new Date("2026-07-24T12:00:01.000Z") }
      ])
      .mockResolvedValueOnce([
        { id: 10, status: StatusMovimentacaoFinanceira.ESTORNADA, grupoTransferencia: "grupo-123" },
        { id: 11, status: StatusMovimentacaoFinanceira.ESTORNADA, grupoTransferencia: "grupo-123" }
      ])

    const resultado = await estornarMovimentacaoAvulsaFinanceiraService(
      10,
      1,
      3,
      { motivo: "Transferência duplicada" }
    )

    expect(resultado.sucesso).toBe(true)
    if (resultado.sucesso) expect(resultado.movimentacoes).toHaveLength(2)
    expect(txMocks.movimentosAtualizar).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ grupoTransferencia: "grupo-123" }),
      data: expect.objectContaining({
        status: StatusMovimentacaoFinanceira.ESTORNADA,
        estornadoEm: expect.any(Date)
      })
    }))
    const estornadoEm = txMocks.movimentosAtualizar.mock.calls[0]?.[0].data.estornadoEm as Date
    expect(estornadoEm.getTime()).toBeGreaterThanOrEqual(
      new Date("2026-07-24T12:00:01.000Z").getTime()
    )
  })
})
