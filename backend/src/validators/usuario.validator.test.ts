import { describe, expect, it } from "vitest"

import { PapelUsuario } from "../generated/prisma/enums.js"
import { validarAtualizacaoUsuario } from "./usuario.validator.js"

// Confirma que o endpoint de atualização aceita somente os campos planejados.
describe("validação de atualização de usuário", () => {
  it("recusa um corpo vazio", () => {
    const resultado = validarAtualizacaoUsuario({})

    expect(resultado.valido).toBe(false)
  })

  it("recusa a alteração de senha por este endpoint", () => {
    const resultado = validarAtualizacaoUsuario({
      senha: "nova-senha-segura"
    })

    expect(resultado.valido).toBe(false)
  })

  it("normaliza e aceita nome, e-mail e papel", () => {
    const resultado = validarAtualizacaoUsuario({
      nome: "  Maria Silva  ",
      email: " MARIA@EXEMPLO.COM ",
      papel: PapelUsuario.TECNICO
    })

    expect(resultado.valido).toBe(true)

    if (resultado.valido) {
      expect(resultado.dados).toEqual({
        nome: "Maria Silva",
        email: "maria@exemplo.com",
        papel: PapelUsuario.TECNICO
      })
    }
  })
})
