import { describe, expect, it } from "vitest"

import { StatusOrcamento } from "../generated/prisma/enums.js"
import {
  listarStatusOrcamentoPermitidos,
  orcamentoPodeSerConvertido,
  transicaoStatusOrcamentoEhPermitida
} from "./status-orcamento.js"

describe("maquina de estados do orcamento", () => {
  it("permite o fluxo comercial esperado", () => {
    expect(
      transicaoStatusOrcamentoEhPermitida(
        StatusOrcamento.RASCUNHO,
        StatusOrcamento.ENVIADO
      )
    ).toBe(true)
    expect(
      transicaoStatusOrcamentoEhPermitida(
        StatusOrcamento.ENVIADO,
        StatusOrcamento.APROVADO
      )
    ).toBe(true)
    expect(
      transicaoStatusOrcamentoEhPermitida(
        StatusOrcamento.REJEITADO,
        StatusOrcamento.RASCUNHO
      )
    ).toBe(true)
  })

  it("nao permite converter pelo fluxo generico", () => {
    expect(
      transicaoStatusOrcamentoEhPermitida(
        StatusOrcamento.APROVADO,
        StatusOrcamento.CONVERTIDO
      )
    ).toBe(false)
    expect(orcamentoPodeSerConvertido(StatusOrcamento.APROVADO)).toBe(true)
  })

  it("mantem estados terminais sem saidas", () => {
    expect(
      listarStatusOrcamentoPermitidos(StatusOrcamento.CONVERTIDO)
    ).toEqual([])
    expect(
      listarStatusOrcamentoPermitidos(StatusOrcamento.CANCELADO)
    ).toEqual([])
  })

  it("aceita repetir o estado como no-op idempotente", () => {
    expect(
      transicaoStatusOrcamentoEhPermitida(
        StatusOrcamento.ENVIADO,
        StatusOrcamento.ENVIADO
      )
    ).toBe(true)
  })
})
