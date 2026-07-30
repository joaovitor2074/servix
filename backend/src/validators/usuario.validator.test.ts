import { describe, expect, it } from "vitest"

import { PapelUsuario } from "../generated/prisma/enums.js"
import {
  validarAtualizacaoUsuario,
  validarCriacaoUsuario,
  validarRedefinicaoSenhaUsuario
} from "./usuario.validator.js"

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
      telefone: "(99) 99999-9999",
      papel: PapelUsuario.TECNICO
    })

    expect(resultado.valido).toBe(true)

    if (resultado.valido) {
      expect(resultado.dados).toEqual({
        nome: "Maria Silva",
        email: "maria@exemplo.com",
        telefone: "(99) 99999-9999",
        papel: PapelUsuario.TECNICO
      })
    }
  })
})

describe("validação de criação e senha de usuário", () => {
  it("aceita os três perfis e transforma telefone vazio em nulo", () => {
    const resultado = validarCriacaoUsuario({
      nome: "João Técnico",
      email: "tecnico@empresa.com",
      telefone: "",
      senha: "senha-segura-123",
      papel: PapelUsuario.TECNICO
    })

    expect(resultado.valido).toBe(true)
    if (resultado.valido) expect(resultado.dados.telefone).toBeNull()
  })

  it("recusa redefinição de senha curta", () => {
    expect(validarRedefinicaoSenhaUsuario({ senha: "1234567" }).valido).toBe(false)
    expect(validarRedefinicaoSenhaUsuario({ senha: "12345678" }).valido).toBe(true)
  })
})
