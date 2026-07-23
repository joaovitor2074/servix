import type { NextFunction, Request, Response } from "express"
import { beforeEach, describe, expect, it, vi } from "vitest"

const serviceMocks = vi.hoisted(() => ({
  buscar: vi.fn()
}))

vi.mock("../services/ordens-publicas.service.js", () => ({
  buscarOrdemPublicaService: serviceMocks.buscar
}))

import { buscarOrdemPublicaController } from "./ordens-publicas.controllers.js"

function criarResponse() {
  const json = vi.fn()
  const setHeader = vi.fn()
  const status = vi.fn().mockReturnValue({ json })

  return {
    response: { status, setHeader } as unknown as Response,
    status,
    json,
    setHeader
  }
}

describe("controller público de acompanhamento", () => {
  const next = vi.fn() as NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna o DTO com no-store e não exige autenticação", async () => {
    const ordem = {
      numero: 41,
      equipamento: "Notebook",
      status: "EM_ANALISE"
    }
    serviceMocks.buscar.mockResolvedValue(ordem)
    const req = {
      params: { token: " 12345678-1234-1234-1234-123456789012 " }
    } as unknown as Request
    const { response, status, json, setHeader } = criarResponse()

    await buscarOrdemPublicaController(req, response, next)

    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store")
    expect(serviceMocks.buscar).toHaveBeenCalledWith(
      "12345678-1234-1234-1234-123456789012"
    )
    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith(ordem)
    expect(next).not.toHaveBeenCalled()
  })

  it("responde 404 genérico para token válido inexistente", async () => {
    serviceMocks.buscar.mockResolvedValue(null)
    const req = {
      params: { token: "12345678-1234-1234-1234-123456789012" }
    } as unknown as Request
    const { response, status, json, setHeader } = criarResponse()

    await buscarOrdemPublicaController(req, response, next)

    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store")
    expect(status).toHaveBeenCalledWith(404)
    expect(json).toHaveBeenCalledWith({
      erro: "Acompanhamento não encontrado",
      codigo: "ACOMPANHAMENTO_NAO_ENCONTRADO"
    })
  })

  it("rejeita token curto sem consultar o banco", async () => {
    const req = {
      params: { token: "previsivel" }
    } as unknown as Request
    const { response, status, json } = criarResponse()

    await buscarOrdemPublicaController(req, response, next)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({
      erro: "Token inválido",
      codigo: "TOKEN_ACOMPANHAMENTO_INVALIDO"
    })
    expect(serviceMocks.buscar).not.toHaveBeenCalled()
  })
})

