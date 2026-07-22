import { describe, expect, it } from "vitest"

import { StatusOrdem } from "../generated/prisma/enums.js"
import {
  validarAlteracaoStatus,
  validarAtualizacaoOrdem,
  validarCancelamentoOrdem
} from "./ordens.validators.js"

// Cobre os contratos principais de criação e atualização sem acessar o banco.
describe("validação de ordens", () => {
  it("recusa status do contrato antigo em minúsculas", () => {
    const resultado = validarAtualizacaoOrdem({ status: "entregue" })
    expect(resultado.valido).toBe(false)
  })

  it("mantém os campos comerciais imutáveis depois da aprovação", () => {
    const base = {
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 1
    }

    expect(validarAtualizacaoOrdem({ ...base, clienteId: 2 }).valido).toBe(false)
    expect(validarAtualizacaoOrdem({ ...base, equipamento: "Outro" }).valido).toBe(false)
    expect(validarAtualizacaoOrdem({ ...base, valor: 10 }).valido).toBe(false)
    expect(validarAtualizacaoOrdem({ ...base, formaDePagamento: "PIX" }).valido).toBe(false)
  })

  it("aceita atualização parcial", () => {
    const resultado = validarAtualizacaoOrdem({
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 1,
      status: StatusOrdem.EM_ANALISE
    })

    expect(resultado.valido).toBe(true)
  })

  it("exige status e versão esperados em toda atualização", () => {
    expect(
      validarAtualizacaoOrdem({ diagnostico: "Teste" }).valido
    ).toBe(false)

    expect(
      validarAtualizacaoOrdem({
        statusEsperado: StatusOrdem.RECEBIDO,
        versaoEsperada: 1
      }).valido
    ).toBe(false)
  })

  it("recusa estados de aprovação que pertencem ao orçamento", () => {
    const resultado = validarAtualizacaoOrdem({
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 1,
      status: "AGUARDANDO_APROVACAO"
    })

    expect(resultado.valido).toBe(false)
  })

  it("exige a fotografia da ordem na rota dedicada de status", () => {
    expect(
      validarAlteracaoStatus({ status: StatusOrdem.EM_ANALISE }).valido
    ).toBe(false)

    expect(
      validarAlteracaoStatus({
        statusEsperado: StatusOrdem.RECEBIDO,
        versaoEsperada: 1,
        status: StatusOrdem.EM_ANALISE
      }).valido
    ).toBe(true)
  })

  it("protege o cancelamento com status e versão esperados", () => {
    expect(validarCancelamentoOrdem({}).valido).toBe(false)
    expect(
      validarCancelamentoOrdem({
        statusEsperado: StatusOrdem.EM_EXECUCAO,
        versaoEsperada: "7"
      }).valido
    ).toBe(true)
  })
})
