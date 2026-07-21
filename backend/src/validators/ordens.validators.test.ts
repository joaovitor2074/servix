import { describe, expect, it } from "vitest"

import { FormaPagamento, StatusOrdem } from "../generated/prisma/enums.js"
import {
  validarAtualizacaoOrdem,
  validarCriacaoOrdem
} from "./ordens.validators.js"

// Cobre os contratos principais de criação e atualização sem acessar o banco.
describe("validação de ordens", () => {
  it("aplica os padrões e converte a data", () => {
    const resultado = validarCriacaoOrdem({
      clienteId: 1,
      equipamento: "Notebook",
      problemaRelatado: "Não liga",
      diagnostico: null,
      servicoRealizado: null,
      pecasUtilizadas: null,
      tecnicoResponsavel: null,
      previsaoDeEntrega: "2026-07-20T15:00:00-03:00"
    })

    expect(resultado.valido).toBe(true)

    if (resultado.valido) {
      expect(resultado.dados.status).toBe(StatusOrdem.ABERTA)
      expect(resultado.dados.formaDePagamento).toBe(
        FormaPagamento.NAO_INFORMADA
      )
      expect(resultado.dados.previsaoDeEntrega).toBeInstanceOf(Date)
    }
  })

  it("recusa status do contrato antigo em minúsculas", () => {
    const resultado = validarAtualizacaoOrdem({ status: "entregue" })
    expect(resultado.valido).toBe(false)
  })

  it("exige que uma ordem nova comece aberta", () => {
    const resultado = validarCriacaoOrdem({
      clienteId: 1,
      equipamento: "Notebook",
      problemaRelatado: "Não liga",
      status: StatusOrdem.ENTREGUE
    })

    expect(resultado.valido).toBe(false)
  })

  it("recusa valor com mais de duas casas decimais", () => {
    const resultado = validarCriacaoOrdem({
      clienteId: 1,
      equipamento: "Notebook",
      problemaRelatado: "Não liga",
      valor: 10.999
    })

    expect(resultado.valido).toBe(false)
  })

  it("aceita atualização parcial", () => {
    const resultado = validarAtualizacaoOrdem({
      status: StatusOrdem.EM_ANALISE
    })

    expect(resultado.valido).toBe(true)
  })
})
