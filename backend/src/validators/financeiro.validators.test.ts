import { describe, expect, it } from "vitest"

import {
  atualizarLancamentoFinanceiroSchema,
  criarCategoriaFinanceiraSchema,
  criarLancamentoFinanceiroSchema,
  criarTransferenciaFinanceiraSchema,
  listarContasFinanceirasQuerySchema,
  registrarBaixaFinanceiraSchema
} from "./financeiro.validators.js"

const lancamentoValido = {
  tipo: "RECEBER",
  descricao: "Mensalidade de manutenção",
  categoriaId: 10,
  valorOriginal: 250.5,
  desconto: 10.5,
  juros: 0,
  multa: 0,
  dataCompetencia: "2026-07-01",
  dataVencimento: "2026-07-25"
}

describe("validators do financeiro preview", () => {
  it("normaliza datas e aplica defaults ao criar um lançamento", () => {
    const resultado = criarLancamentoFinanceiroSchema.parse(lancamentoValido)

    expect(resultado.status).toBe("PENDENTE")
    expect(resultado.dataCompetencia).toBeInstanceOf(Date)
    expect(resultado.dataVencimento.toISOString()).toBe("2026-07-25T12:00:00.000Z")
  })

  it("rejeita um dia civil inexistente", () => {
    expect(criarLancamentoFinanceiroSchema.safeParse({
      ...lancamentoValido,
      dataVencimento: "2026-02-31"
    }).success).toBe(false)
  })

  it("rejeita timestamp sem Z ou offset explícito", () => {
    expect(criarLancamentoFinanceiroSchema.safeParse({
      ...lancamentoValido,
      dataVencimento: "2026-07-25T10:30:00"
    }).success).toBe(false)
    expect(criarLancamentoFinanceiroSchema.safeParse({
      ...lancamentoValido,
      dataVencimento: "2026-07-25T10:30:00-03:00"
    }).success).toBe(true)
  })

  it("recusa desconto acima do valor original", () => {
    const resultado = criarLancamentoFinanceiroSchema.safeParse({
      ...lancamentoValido,
      desconto: 300
    })

    expect(resultado.success).toBe(false)
  })

  it("recusa propriedades capazes de injetar empresa ou ambiente", () => {
    const resultado = criarLancamentoFinanceiroSchema.safeParse({
      ...lancamentoValido,
      empresaId: 99,
      ambiente: "PRODUCAO"
    })

    expect(resultado.success).toBe(false)
  })

  it("exige ao menos uma alteração além da versão", () => {
    expect(atualizarLancamentoFinanceiroSchema.safeParse({
      versaoEsperada: 1
    }).success).toBe(false)
  })

  it("impede transferência para a mesma conta", () => {
    expect(criarTransferenciaFinanceiraSchema.safeParse({
      contaOrigemId: 2,
      contaDestinoId: 2,
      valor: 50,
      descricao: "Transferência de teste",
      movimentadoEm: "2026-07-24"
    }).success).toBe(false)
  })

  it("preserva false em filtros booleanos vindos da query", () => {
    expect(listarContasFinanceirasQuerySchema.parse({ ativa: "false" }))
      .toEqual({ ativa: false })
  })

  it("aceita somente cor hexadecimal completa", () => {
    expect(criarCategoriaFinanceiraSchema.safeParse({
      nome: "Serviços",
      tipo: "RECEITA",
      cor: "azul"
    }).success).toBe(false)
    expect(criarCategoriaFinanceiraSchema.safeParse({
      nome: "Serviços",
      tipo: "RECEITA",
      cor: "#2563EB"
    }).success).toBe(true)
  })

  it("não permite forma de pagamento não informada em uma baixa", () => {
    expect(registrarBaixaFinanceiraSchema.safeParse({
      contaId: 1,
      valor: 10,
      formaPagamento: "NAO_INFORMADA",
      movimentadoEm: "2026-07-24",
      versaoEsperada: 1
    }).success).toBe(false)
  })
})
