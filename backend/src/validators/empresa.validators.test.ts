import { describe, expect, it } from "vitest"

import { validarCriacaoEmpresa } from "./empresa.validators.js"

const cadastroValido = {
  nome: "Oficina Central",
  slug: "oficina-central",
  telefone: "(11) 99999-0000",
  email: "contato@oficina.com",
  tipoNegocio: "Assistencia tecnica",
  cpfCnpj: "12.345.678/0001-95",
  cidade: "Sao Paulo",
  estado: "sp",
  endereco: "Rua Central, 100",
  planoCodigo: "servix-mensal",
  aceitouTermos: true,
  administrador: {
    nome: "Ana Silva",
    email: "ana@oficina.com",
    telefone: "(11) 98888-0000",
    senha: "senha-segura"
  }
}

describe("cadastro publico de empresa", () => {
  it("normaliza identificadores e aceita somente o plano publicado", () => {
    const resultado = validarCriacaoEmpresa(cadastroValido)

    expect(resultado.valido).toBe(true)
    if (!resultado.valido) return

    expect(resultado.dados).toMatchObject({
      slug: "oficina-central",
      telefone: "11999990000",
      cpfCnpj: "12345678000195",
      estado: "SP",
      planoCodigo: "servix-mensal",
      aceitouTermos: true
    })
    expect(resultado.dados.administrador.telefone).toBe("11988880000")
  })

  it("recusa cadastro sem aceite legal ou com valor enviado pelo navegador", () => {
    const semAceite = validarCriacaoEmpresa({
      ...cadastroValido,
      aceitouTermos: false
    })
    const comPreco = validarCriacaoEmpresa({
      ...cadastroValido,
      valorMensal: "1.00"
    })

    expect(semAceite.valido).toBe(false)
    expect(comPreco.valido).toBe(false)
  })
})
