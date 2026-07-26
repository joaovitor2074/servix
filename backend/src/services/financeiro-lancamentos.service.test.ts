import { beforeEach, describe, expect, it, vi } from "vitest"

import { Prisma } from "../generated/prisma/client.js"
import {
  AmbienteFinanceiro,
  FormaPagamento,
  OrigemLancamentoFinanceiro,
  StatusLancamentoFinanceiro,
  StatusMovimentacaoFinanceira,
  TipoCategoriaFinanceira,
  TipoLancamentoFinanceiro,
  TipoMovimentacaoFinanceira
} from "../generated/prisma/enums.js"

const txMocks = vi.hoisted(() => ({
  categoriaBuscar: vi.fn(),
  centroBuscar: vi.fn(),
  contaBuscar: vi.fn(),
  clienteBuscar: vi.fn(),
  lancamentoBuscar: vi.fn(),
  lancamentoCriar: vi.fn(),
  lancamentoAtualizarMuitos: vi.fn(),
  lancamentoAtualizar: vi.fn(),
  lancamentoBuscarObrigatorio: vi.fn(),
  movimentacaoCriar: vi.fn(),
  movimentacaoAtualizar: vi.fn()
}))

const transacaoMocks = vi.hoisted(() => ({
  bloquear: vi.fn()
}))

const tx = {
  categoriaFinanceira: { findUnique: txMocks.categoriaBuscar },
  centroCustoFinanceiro: { findUnique: txMocks.centroBuscar },
  contaFinanceira: { findUnique: txMocks.contaBuscar },
  cliente: { findUnique: txMocks.clienteBuscar },
  lancamentoFinanceiro: {
    findUnique: txMocks.lancamentoBuscar,
    create: txMocks.lancamentoCriar,
    updateMany: txMocks.lancamentoAtualizarMuitos,
    update: txMocks.lancamentoAtualizar,
    findUniqueOrThrow: txMocks.lancamentoBuscarObrigatorio
  },
  movimentacaoFinanceira: {
    create: txMocks.movimentacaoCriar,
    update: txMocks.movimentacaoAtualizar
  }
}

vi.mock("../lib/prisma.js", () => ({ prisma: {} }))
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
  criarLancamentoFinanceiroService,
  estornarBaixaFinanceiraService,
  registrarBaixaFinanceiraService
} from "./financeiro-lancamentos.service.js"

const categoriaReceita = {
  id: 9,
  empresaId: 1,
  ambiente: AmbienteFinanceiro.PREVIEW,
  nome: "Serviços",
  tipo: TipoCategoriaFinanceira.RECEITA,
  ativa: true
}

function lancamentoSemBaixas() {
  return {
    id: 20,
    empresaId: 1,
    ambiente: AmbienteFinanceiro.PREVIEW,
    tipo: TipoLancamentoFinanceiro.RECEBER,
    status: StatusLancamentoFinanceiro.PENDENTE,
    origem: OrigemLancamentoFinanceiro.MANUAL,
    descricao: "Contrato mensal",
    documento: null,
    contraparte: "Cliente A",
    clienteId: null,
    categoriaId: 9,
    centroCustoId: null,
    contaPreferidaId: null,
    valorOriginal: new Prisma.Decimal(100),
    desconto: new Prisma.Decimal(0),
    juros: new Prisma.Decimal(0),
    multa: new Prisma.Decimal(0),
    valorTotal: new Prisma.Decimal(100),
    dataCompetencia: new Date("2026-07-01T12:00:00.000Z"),
    dataVencimento: new Date("2026-07-30T12:00:00.000Z"),
    observacao: null,
    versao: 1,
    criadoPorId: 3,
    canceladoEm: null,
    motivoCancelamento: null,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    categoria: { id: 9, nome: "Serviços", tipo: TipoCategoriaFinanceira.RECEITA, cor: null },
    centroCusto: null,
    contaPreferida: null,
    cliente: null,
    movimentacoes: []
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  transacaoMocks.bloquear.mockResolvedValue(undefined)
})

describe("financeiro-lancamentos.service", () => {
  it("rejeita uma categoria que não pertence à empresa autenticada", async () => {
    // Uma categoria de outra empresa nunca é encontrada pela chave composta.
    txMocks.categoriaBuscar.mockResolvedValue(null)

    const resultado = await criarLancamentoFinanceiroService(1, 3, {
      tipo: TipoLancamentoFinanceiro.RECEBER,
      status: StatusLancamentoFinanceiro.PENDENTE,
      descricao: "Receita de teste",
      categoriaId: 99,
      valorOriginal: 100,
      desconto: 0,
      juros: 0,
      multa: 0,
      dataCompetencia: new Date("2026-07-01T12:00:00.000Z"),
      dataVencimento: new Date("2026-07-30T12:00:00.000Z")
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "referencia_invalida",
      campo: "categoriaId"
    })
    expect(txMocks.categoriaBuscar).toHaveBeenCalledWith({
      where: {
        id_empresaId_ambiente: {
          id: 99,
          empresaId: 1,
          ambiente: AmbienteFinanceiro.PREVIEW
        }
      }
    })
    expect(txMocks.lancamentoCriar).not.toHaveBeenCalled()
  })

  it("registra baixa parcial e incrementa a versão do lançamento", async () => {
    const atual = lancamentoSemBaixas()
    const movimento = {
      id: 40,
      contaId: 7,
      tipo: TipoMovimentacaoFinanceira.ENTRADA,
      status: StatusMovimentacaoFinanceira.CONFIRMADA,
      valor: new Prisma.Decimal(40),
      formaPagamento: FormaPagamento.PIX,
      descricao: "Baixa: Contrato mensal",
      observacao: null,
      movimentadoEm: new Date("2026-07-24T12:00:00.000Z"),
      estornadoEm: null,
      motivoEstorno: null,
      criadoEm: new Date(),
      conta: { id: 7, nome: "Caixa principal" }
    }
    txMocks.lancamentoBuscar.mockResolvedValue(atual)
    txMocks.contaBuscar.mockResolvedValue({ id: 7, ativa: true })
    txMocks.lancamentoAtualizarMuitos.mockResolvedValue({ count: 1 })
    txMocks.movimentacaoCriar.mockResolvedValue(movimento)
    txMocks.lancamentoBuscarObrigatorio.mockResolvedValue({
      ...atual,
      status: StatusLancamentoFinanceiro.PARCIAL,
      versao: 2,
      movimentacoes: [movimento]
    })

    const resultado = await registrarBaixaFinanceiraService(20, 1, 3, {
      contaId: 7,
      valor: 40,
      formaPagamento: FormaPagamento.PIX,
      movimentadoEm: new Date("2026-07-24T12:00:00.000Z"),
      versaoEsperada: 1
    })

    expect(resultado.sucesso).toBe(true)
    if (resultado.sucesso) {
      expect(resultado.lancamento.valorPago.toFixed(2)).toBe("40.00")
      expect(resultado.lancamento.saldoAberto.toFixed(2)).toBe("60.00")
    }
    expect(txMocks.lancamentoAtualizarMuitos).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        status: StatusLancamentoFinanceiro.PARCIAL,
        versao: { increment: 1 }
      }
    }))
  })

  it("impede sobrebaixa antes de criar qualquer movimento", async () => {
    txMocks.lancamentoBuscar.mockResolvedValue(lancamentoSemBaixas())
    txMocks.contaBuscar.mockResolvedValue({ id: 7, ativa: true })

    const resultado = await registrarBaixaFinanceiraService(20, 1, 3, {
      contaId: 7,
      valor: 100.01,
      formaPagamento: FormaPagamento.PIX,
      movimentadoEm: new Date("2026-07-24T12:00:00.000Z"),
      versaoEsperada: 1
    })

    expect(resultado.sucesso).toBe(false)
    if (!resultado.sucesso) expect(resultado.motivo).toBe("valor_excede_saldo")
    expect(txMocks.movimentacaoCriar).not.toHaveBeenCalled()
  })

  it("quita o lançamento ao completar uma baixa parcial", async () => {
    const atual = lancamentoSemBaixas()
    const primeiraBaixa = {
      id: 40,
      contaId: 7,
      tipo: TipoMovimentacaoFinanceira.ENTRADA,
      status: StatusMovimentacaoFinanceira.CONFIRMADA,
      valor: new Prisma.Decimal(40),
      formaPagamento: FormaPagamento.PIX,
      descricao: "Primeira baixa",
      observacao: null,
      movimentadoEm: new Date("2026-07-20T12:00:00.000Z"),
      estornadoEm: null,
      motivoEstorno: null,
      criadoEm: new Date(),
      conta: { id: 7, nome: "Caixa principal" }
    }
    const ultimaBaixa = {
      ...primeiraBaixa,
      id: 41,
      valor: new Prisma.Decimal(60),
      descricao: "Baixa final"
    }
    txMocks.lancamentoBuscar.mockResolvedValue({
      ...atual,
      status: StatusLancamentoFinanceiro.PARCIAL,
      versao: 2,
      movimentacoes: [primeiraBaixa]
    })
    txMocks.contaBuscar.mockResolvedValue({ id: 7, ativa: true })
    txMocks.lancamentoAtualizarMuitos.mockResolvedValue({ count: 1 })
    txMocks.movimentacaoCriar.mockResolvedValue(ultimaBaixa)
    txMocks.lancamentoBuscarObrigatorio.mockResolvedValue({
      ...atual,
      status: StatusLancamentoFinanceiro.QUITADO,
      versao: 3,
      movimentacoes: [primeiraBaixa, ultimaBaixa]
    })

    const resultado = await registrarBaixaFinanceiraService(20, 1, 3, {
      contaId: 7,
      valor: 60,
      formaPagamento: FormaPagamento.PIX,
      movimentadoEm: new Date("2026-07-24T12:00:00.000Z"),
      versaoEsperada: 2
    })

    expect(resultado.sucesso).toBe(true)
    if (resultado.sucesso) {
      expect(resultado.lancamento.statusCalculado).toBe(StatusLancamentoFinanceiro.QUITADO)
      expect(resultado.lancamento.saldoAberto.toFixed(2)).toBe("0.00")
    }
    expect(txMocks.lancamentoAtualizarMuitos).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: StatusLancamentoFinanceiro.QUITADO, versao: { increment: 1 } }
    }))
  })

  it("reabre como parcial ao estornar uma das baixas de um título quitado", async () => {
    const atual = lancamentoSemBaixas()
    const primeiraBaixa = {
      id: 40,
      contaId: 7,
      tipo: TipoMovimentacaoFinanceira.ENTRADA,
      status: StatusMovimentacaoFinanceira.CONFIRMADA,
      valor: new Prisma.Decimal(40),
      formaPagamento: FormaPagamento.PIX,
      descricao: "Primeira baixa",
      observacao: null,
      movimentadoEm: new Date("2026-07-20T12:00:00.000Z"),
      estornadoEm: null,
      motivoEstorno: null,
      criadoEm: new Date(),
      conta: { id: 7, nome: "Caixa principal" }
    }
    const ultimaBaixa = { ...primeiraBaixa, id: 41, valor: new Prisma.Decimal(60) }
    const estornada = {
      ...ultimaBaixa,
      status: StatusMovimentacaoFinanceira.ESTORNADA,
      estornadoEm: new Date(),
      motivoEstorno: "Pagamento duplicado"
    }
    txMocks.lancamentoBuscar.mockResolvedValue({
      ...atual,
      status: StatusLancamentoFinanceiro.QUITADO,
      versao: 3,
      movimentacoes: [primeiraBaixa, ultimaBaixa]
    })
    txMocks.movimentacaoAtualizar.mockResolvedValue(estornada)
    txMocks.lancamentoAtualizar.mockResolvedValue({ count: 1 })
    txMocks.lancamentoBuscarObrigatorio.mockResolvedValue({
      ...atual,
      status: StatusLancamentoFinanceiro.PARCIAL,
      versao: 4,
      movimentacoes: [primeiraBaixa, estornada]
    })

    const resultado = await estornarBaixaFinanceiraService(20, 41, 1, 3, {
      motivo: "Pagamento duplicado",
      versaoEsperada: 3
    })

    expect(resultado.sucesso).toBe(true)
    if (resultado.sucesso) {
      expect(resultado.lancamento.statusCalculado).toBe(StatusLancamentoFinanceiro.PARCIAL)
      expect(resultado.lancamento.saldoAberto.toFixed(2)).toBe("60.00")
    }
    expect(txMocks.lancamentoAtualizar).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: StatusLancamentoFinanceiro.PARCIAL, versao: { increment: 1 } }
    }))
  })
})
