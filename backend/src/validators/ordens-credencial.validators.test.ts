import { describe, expect, it } from "vitest"

import { StatusOrdem } from "../generated/prisma/enums.js"
import { validarAtualizacaoOrdem } from "./ordens.validators.js"

describe("credencial de acesso na ordem", () => {
  const base = {
    statusEsperado: StatusOrdem.RECEBIDO,
    versaoEsperada: 1
  }

  it("aceita cadastro e remocao", () => {
    const cadastro = validarAtualizacaoOrdem({
      ...base,
      credencialAcesso: "2580"
    })

    expect(cadastro.valido).toBe(true)
    if (cadastro.valido) {
      expect(cadastro.dados.credencialAcesso).toBe("2580")
    }

    expect(validarAtualizacaoOrdem({
      ...base,
      credencialAcesso: null
    }).valido).toBe(true)
  })

  it("recusa credencial maior que o limite", () => {
    expect(validarAtualizacaoOrdem({
      ...base,
      credencialAcesso: "x".repeat(121)
    }).valido).toBe(false)
  })
})
