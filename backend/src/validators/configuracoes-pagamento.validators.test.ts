import { describe, expect, it } from "vitest"

import { ProvedorPagamento } from "../generated/prisma/enums.js"
import { validarAtualizacaoConfiguracaoPagamento } from "./configuracoes-pagamento.validators.js"

describe("validator de configuracao de pagamento", () => {
  it("aceita atualizacao parcial com versao", () => {
    expect(validarAtualizacaoConfiguracaoPagamento({
      versaoEsperada: 2,
      provedor: ProvedorPagamento.SIMULADO
    })).toMatchObject({ valido: true })
  })

  it("rejeita corpo sem alteracao ou sem controle de concorrencia", () => {
    expect(validarAtualizacaoConfiguracaoPagamento({
      versaoEsperada: 2
    }).valido).toBe(false)
    expect(validarAtualizacaoConfiguracaoPagamento({
      pixHabilitado: true
    }).valido).toBe(false)
  })

  it("rejeita campos de credenciais nesta fundacao", () => {
    expect(validarAtualizacaoConfiguracaoPagamento({
      versaoEsperada: 2,
      accessToken: "segredo"
    }).valido).toBe(false)
  })
})

