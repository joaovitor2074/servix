import { describe, expect, it } from "vitest"

import {
  FormaPagamento,
  StatusOrcamento,
  TipoItemOrcamento
} from "../generated/prisma/enums.js"
import {
  validarAlteracaoStatusOrcamento,
  validarAprovacaoPublicaOrcamento,
  validarAtualizacaoOrcamento,
  validarCriacaoOrcamento,
  validarTransformacaoOrcamento
} from "./orcamentos.validators.js"

const criacaoValida = {
  clienteId: 4,
  equipamento: "Notebook",
  descricaoProblema: "Nao liga",
  itens: [
    {
      descricao: "Diagnostico",
      quantidade: 1,
      valorUnitario: 50,
      tipo: TipoItemOrcamento.SERVICO
    }
  ]
}

describe("validadores de orcamento", () => {
  it("aceita a criacao e aplica desconto zero", () => {
    const resultado = validarCriacaoOrcamento(criacaoValida)

    expect(resultado.valido).toBe(true)
    if (resultado.valido) {
      expect(resultado.dados.desconto).toBe(0)
    }
  })

  it("recusa total calculado pelo cliente", () => {
    const resultado = validarCriacaoOrcamento({
      ...criacaoValida,
      total: 1
    })

    expect(resultado.valido).toBe(false)
  })

  it("exige itens, quantidade inteira e centavos validos", () => {
    expect(
      validarCriacaoOrcamento({ ...criacaoValida, itens: [] }).valido
    ).toBe(false)
    expect(
      validarCriacaoOrcamento({
        ...criacaoValida,
        itens: [{ ...criacaoValida.itens[0], quantidade: 1.5 }]
      }).valido
    ).toBe(false)
    expect(
      validarCriacaoOrcamento({
        ...criacaoValida,
        itens: [{ ...criacaoValida.itens[0], valorUnitario: 10.001 }]
      }).valido
    ).toBe(false)
  })

  it("exige snapshot e ao menos uma mudanca na edicao", () => {
    expect(
      validarAtualizacaoOrcamento({
        statusEsperado: StatusOrcamento.RASCUNHO,
        versaoEsperada: 1
      }).valido
    ).toBe(false)
    expect(
      validarAtualizacaoOrcamento({
        statusEsperado: StatusOrcamento.RASCUNHO,
        versaoEsperada: 1,
        equipamento: "Notebook revisado"
      }).valido
    ).toBe(true)
  })

  it("reserva aprovacao, rejeicao e conversao aos endpoints proprios", () => {
    for (const status of [
      StatusOrcamento.APROVADO,
      StatusOrcamento.REJEITADO,
      StatusOrcamento.CONVERTIDO
    ]) {
      expect(
        validarAlteracaoStatusOrcamento({
          statusEsperado: StatusOrcamento.ENVIADO,
          versaoEsperada: 2,
          status
        }).valido
      ).toBe(false)
    }

    expect(
      validarAlteracaoStatusOrcamento({
        statusEsperado: StatusOrcamento.RASCUNHO,
        versaoEsperada: 1,
        status: StatusOrcamento.ENVIADO
      }).valido
    ).toBe(true)
  })

  it("fixa APROVADO como estado esperado na transformacao", () => {
    expect(
      validarTransformacaoOrcamento({
        statusEsperado: StatusOrcamento.APROVADO,
        versaoEsperada: 2
      }).valido
    ).toBe(true)
    expect(
      validarTransformacaoOrcamento({
        statusEsperado: StatusOrcamento.ENVIADO,
        versaoEsperada: 2
      }).valido
    ).toBe(false)
  })

  it("exige uma forma de pagamento valida na aprovacao publica", () => {
    expect(
      validarAprovacaoPublicaOrcamento({ versaoEsperada: 2 }).valido
    ).toBe(false)
    expect(
      validarAprovacaoPublicaOrcamento({
        versaoEsperada: 2,
        formaPagamento: FormaPagamento.NAO_INFORMADA
      }).valido
    ).toBe(false)
    expect(
      validarAprovacaoPublicaOrcamento({
        versaoEsperada: 2,
        formaPagamento: FormaPagamento.PIX
      }).valido
    ).toBe(true)
  })
})
