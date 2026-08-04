import { describe, expect, it } from "vitest"
import { validarCriacaoProdutoEstoque, validarMovimentacaoEstoque } from "./estoque.validators.js"

describe("validadores de estoque", () => {
  it("aceita o cadastro completo de uma peça", () => {
    const resultado = validarCriacaoProdutoEstoque({
      nome: "Tela OLED",
      sku: "TELA-001",
      unidade: "un",
      quantidade: 4,
      estoqueMinimo: 1,
      custoUnitario: 120,
      precoVenda: 220
    })
    expect(resultado.valido).toBe(true)
  })

  it("exige ordem para saída vinculada a serviço", () => {
    const resultado = validarMovimentacaoEstoque({
      produtoId: 1,
      tipo: "SAIDA_ORDEM",
      quantidade: 1
    })
    expect(resultado.valido).toBe(false)
  })

  it("rejeita quantidades negativas", () => {
    const resultado = validarMovimentacaoEstoque({
      produtoId: 1,
      tipo: "ENTRADA",
      quantidade: -2
    })
    expect(resultado.valido).toBe(false)
  })
})
