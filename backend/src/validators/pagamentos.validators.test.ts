import { describe, expect, it } from "vitest"

import {
  FormaPagamento,
  StatusOrdem
} from "../generated/prisma/enums.js"
import {
  idPagamentoEhInvalido,
  validarEstornoPagamento,
  validarRegistroPagamento
} from "./pagamentos.validators.js"

describe("validarRegistroPagamento", () => {
  it("aceita um registro confirmado e normaliza os campos opcionais", () => {
    const resultado = validarRegistroPagamento({
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      valor: 125.5,
      formaPagamento: FormaPagamento.PIX,
      pagoEm: "2026-07-22T12:30:00.000-03:00",
      observacao: "  primeira parcela  "
    })

    expect(resultado.valido).toBe(true)
    if (resultado.valido) {
      expect(resultado.dados.pagoEm).toBeInstanceOf(Date)
      expect(resultado.dados.observacao).toBe("primeira parcela")
    }
  })

  it("recusa NAO_INFORMADA porque o pagamento ja ocorreu", () => {
    const resultado = validarRegistroPagamento({
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      valor: 50,
      formaPagamento: FormaPagamento.NAO_INFORMADA
    })

    expect(resultado.valido).toBe(false)
  })

  it.each([0, -1, 10.999])(
    "recusa valor invalido: %s",
    valor => {
      const resultado = validarRegistroPagamento({
        statusEsperado: StatusOrdem.PRONTO,
        versaoEsperada: 7,
        valor,
        formaPagamento: FormaPagamento.DINHEIRO
      })

      expect(resultado.valido).toBe(false)
    }
  )

  it("exige status e versao esperados e rejeita campos desconhecidos", () => {
    const resultado = validarRegistroPagamento({
      valor: 50,
      formaPagamento: FormaPagamento.PIX,
      campoExtra: true
    })

    expect(resultado.valido).toBe(false)
  })
})

describe("validarEstornoPagamento", () => {
  it("aceita motivo aparado com o snapshot da ordem", () => {
    const resultado = validarEstornoPagamento({
      statusEsperado: StatusOrdem.EM_EXECUCAO,
      versaoEsperada: 3,
      motivo: "  cobranca duplicada  "
    })

    expect(resultado).toEqual({
      valido: true,
      dados: {
        statusEsperado: StatusOrdem.EM_EXECUCAO,
        versaoEsperada: 3,
        motivo: "cobranca duplicada"
      }
    })
  })

  it("recusa motivo vazio ou muito curto", () => {
    expect(
      validarEstornoPagamento({
        statusEsperado: StatusOrdem.EM_EXECUCAO,
        versaoEsperada: 3,
        motivo: "  "
      }).valido
    ).toBe(false)
  })
})

describe("idPagamentoEhInvalido", () => {
  it("aceita apenas inteiros positivos", () => {
    expect(idPagamentoEhInvalido(1)).toBe(false)
    expect(idPagamentoEhInvalido(0)).toBe(true)
    expect(idPagamentoEhInvalido(1.5)).toBe(true)
    expect(idPagamentoEhInvalido(Number.NaN)).toBe(true)
  })
})
