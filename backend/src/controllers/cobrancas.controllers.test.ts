import type { NextFunction, Request, Response } from "express"
import { afterEach, describe, expect, it, vi } from "vitest"

import { permitirSimulacaoForaDeProducao } from "./cobrancas.controllers.js"

function respostaMock() {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))

  return {
    response: { status } as unknown as Response,
    status,
    json
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("controle explicito do gateway simulado", () => {
  it("permite homologacao mesmo com NODE_ENV de producao", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("SERVIX_PAYMENT_SIMULATOR_ENABLED", "true")
    const next = vi.fn() as NextFunction
    const { response, status } = respostaMock()

    permitirSimulacaoForaDeProducao(
      {} as Request,
      response,
      next
    )

    expect(next).toHaveBeenCalledOnce()
    expect(status).not.toHaveBeenCalled()
  })

  it("oculta a rota sem habilitacao explicita", () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("SERVIX_PAYMENT_SIMULATOR_ENABLED", "")
    const next = vi.fn() as NextFunction
    const { response, status, json } = respostaMock()

    permitirSimulacaoForaDeProducao(
      {} as Request,
      response,
      next
    )

    expect(next).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({ erro: "Rota nao encontrada" })
  })
})
