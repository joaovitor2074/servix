import { describe, expect, it } from "vitest"

import {
  validarAtualizacaoCliente,
  validarCriacaoCliente,
  validarQueryClientes
} from "./clientes.validators.js"

// Testes de unidade garantem que normalização, proteção contra campos internos e
// limites da paginação continuem iguais após futuras alterações nos schemas.
describe("validação de clientes", () => {
  it("normaliza telefone, CPF e e-mail", () => {
    const resultado = validarCriacaoCliente({
      nome: "  Maria Silva  ",
      telefone: "(11) 99999-9999",
      email: " MARIA@EXEMPLO.COM ",
      cpfCnpj: "123.456.789-01"
    })

    expect(resultado.valido).toBe(true)

    if (resultado.valido) {
      expect(resultado.dados).toMatchObject({
        nome: "Maria Silva",
        telefone: "11999999999",
        email: "maria@exemplo.com",
        cpfCnpj: "12345678901"
      })
    }
  })

  it("recusa campos internos como empresaId", () => {
    const resultado = validarAtualizacaoCliente({
      nome: "Outro nome",
      empresaId: 99
    })

    expect(resultado.valido).toBe(false)
  })

  it("limita paginação", () => {
    const resultado = validarQueryClientes({ limite: "101" })
    expect(resultado.valido).toBe(false)
  })
})
