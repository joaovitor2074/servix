import { describe, expect, it } from "vitest"

import { StatusOrdem } from "../generated/prisma/enums.js"
import {
  listarStatusPermitidos,
  transicaoStatusEhPermitida
} from "./status-ordem.js"

// Como a máquina de estados é uma regra pura, seus caminhos podem ser testados
// rapidamente sem Express, Prisma ou PostgreSQL.
describe("transições de status da ordem", () => {
  it("permite o fluxo normal e os retornos operacionais", () => {
    expect(
      transicaoStatusEhPermitida(
        StatusOrdem.RECEBIDO,
        StatusOrdem.EM_ANALISE
      )
    ).toBe(true)

    expect(
      transicaoStatusEhPermitida(
        StatusOrdem.AGUARDANDO_PECA,
        StatusOrdem.EM_EXECUCAO
      )
    ).toBe(true)

    expect(
      transicaoStatusEhPermitida(
        StatusOrdem.PRONTO,
        StatusOrdem.EM_EXECUCAO
      )
    ).toBe(true)
  })

  it("considera repetir o status uma operação válida", () => {
    expect(
      transicaoStatusEhPermitida(
        StatusOrdem.EM_EXECUCAO,
        StatusOrdem.EM_EXECUCAO
      )
    ).toBe(true)
  })

  it("impede alterar uma ordem entregue ou cancelada", () => {
    expect(
      transicaoStatusEhPermitida(
        StatusOrdem.ENTREGUE,
        StatusOrdem.RECEBIDO
      )
    ).toBe(false)

    expect(
      transicaoStatusEhPermitida(
        StatusOrdem.CANCELADO,
        StatusOrdem.EM_ANALISE
      )
    ).toBe(false)

    expect(listarStatusPermitidos(StatusOrdem.ENTREGUE)).toEqual([])
    expect(listarStatusPermitidos(StatusOrdem.CANCELADO)).toEqual([])
  })

  it("impede pular etapas do fluxo", () => {
    expect(
      transicaoStatusEhPermitida(
        StatusOrdem.RECEBIDO,
        StatusOrdem.ENTREGUE
      )
    ).toBe(false)
  })
})
