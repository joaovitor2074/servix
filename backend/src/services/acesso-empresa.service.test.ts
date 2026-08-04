import { describe, expect, it } from "vitest"

import {
  StatusAssinatura,
  StatusEmpresa
} from "../generated/prisma/enums.js"
import { avaliarAcessoEmpresa } from "./acesso-empresa.service.js"

const agora = new Date("2026-07-31T12:00:00.000Z")

function empresa(
  assinatura: {
    status: StatusAssinatura
    testeGratisIniciadoEm: Date | null
    testeGratisExpiraEm: Date | null
    acessoPilotoAte: Date | null
  }
) {
  return { status: StatusEmpresa.ATIVA, assinatura }
}

describe("acesso temporario da empresa", () => {
  it("libera os cinco dias completos sem assinatura ativa", () => {
    const acesso = avaliarAcessoEmpresa(empresa({
      status: StatusAssinatura.PENDENTE,
      testeGratisIniciadoEm: agora,
      testeGratisExpiraEm: new Date("2026-08-05T12:00:00.000Z"),
      acessoPilotoAte: null
    }), agora)

    expect(acesso).toMatchObject({
      tipo: "TESTE_GRATUITO",
      ativo: true,
      diasRestantes: 5
    })
  })

  it("bloqueia no instante exato da expiracao", () => {
    const acesso = avaliarAcessoEmpresa(empresa({
      status: StatusAssinatura.PENDENTE,
      testeGratisIniciadoEm: new Date("2026-07-26T12:00:00.000Z"),
      testeGratisExpiraEm: agora,
      acessoPilotoAte: null
    }), agora)

    expect(acesso).toMatchObject({
      tipo: "BLOQUEADO",
      ativo: false,
      diasRestantes: 0
    })
  })

  it("prioriza uma liberacao piloto valida depois do teste", () => {
    const acesso = avaliarAcessoEmpresa(empresa({
      status: StatusAssinatura.PENDENTE,
      testeGratisIniciadoEm: new Date("2026-07-20T12:00:00.000Z"),
      testeGratisExpiraEm: new Date("2026-07-25T12:00:00.000Z"),
      acessoPilotoAte: new Date("2026-08-30T12:00:00.000Z")
    }), agora)

    expect(acesso).toMatchObject({
      tipo: "PILOTO",
      ativo: true,
      diasRestantes: 30
    })
  })
})
