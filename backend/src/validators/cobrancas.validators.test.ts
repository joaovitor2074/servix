import { describe, expect, it } from "vitest"

import { validarListagemCobrancas } from "./cobrancas.validators.js"

describe("validarListagemCobrancas", () => {
  it("aceita filtros de orcamento e ordem vindos da query string", () => {
    const resultado = validarListagemCobrancas({
      orcamentoId: "17",
      ordemId: "22",
      status: "PENDENTE",
      pagina: "2",
      limite: "10"
    })

    expect(resultado).toEqual({
      valido: true,
      dados: {
        orcamentoId: 17,
        ordemId: 22,
        status: "PENDENTE",
        pagina: 2,
        limite: 10
      }
    })
  })

  it("recusa identificadores invalidos e campos desconhecidos", () => {
    expect(validarListagemCobrancas({ orcamentoId: "0" }).valido).toBe(false)
    expect(validarListagemCobrancas({ empresaId: "9" }).valido).toBe(false)
  })
})
