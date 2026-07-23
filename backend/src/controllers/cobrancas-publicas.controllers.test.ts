import type { NextFunction, Request, Response } from "express"
import { beforeEach, describe, expect, it, vi } from "vitest"

const serviceMocks = vi.hoisted(() => ({
  buscar: vi.fn(),
  criar: vi.fn()
}))

vi.mock("../services/cobrancas.service.js", () => ({
  buscarCobrancaPublicaService: serviceMocks.buscar,
  criarCobrancaPublicaService: serviceMocks.criar
}))

import {
  buscarCobrancaPublicaController,
  criarCobrancaPublicaController
} from "./cobrancas-publicas.controllers.js"

const token = "12345678-1234-1234-1234-123456789012"

function criarResponse() {
  const send = vi.fn()
  const json = vi.fn()
  const setHeader = vi.fn()
  const status = vi.fn().mockReturnValue({ json, send })

  return {
    response: { status, setHeader } as unknown as Response,
    status,
    json,
    send,
    setHeader
  }
}

describe("controllers publicos de cobranca", () => {
  const next = vi.fn() as NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exige Idempotency-Key antes de chamar o service", async () => {
    const req = {
      params: { token },
      get: vi.fn().mockReturnValue(undefined)
    } as unknown as Request
    const { response, status, json } = criarResponse()

    await criarCobrancaPublicaController(req, response, next)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      codigo: "CHAVE_IDEMPOTENCIA_INVALIDA"
    }))
    expect(serviceMocks.criar).not.toHaveBeenCalled()
  })

  it("retorna a cobranca direta e informa repeticao idempotente", async () => {
    const cobranca = {
      id: 31,
      status: "PENDENTE",
      valor: "100.00",
      formaPagamento: "PIX",
      codigoPix: "PIX_PUBLICO",
      expiraEm: "2026-07-22T13:00:00.000Z",
      pagaEm: null
    }
    serviceMocks.criar.mockResolvedValue({
      sucesso: true,
      cobranca,
      reutilizada: true
    })
    const req = {
      params: { token },
      get: vi.fn().mockReturnValue("publica-chave-123")
    } as unknown as Request
    const { response, status, json, setHeader } = criarResponse()

    await criarCobrancaPublicaController(req, response, next)

    expect(serviceMocks.criar).toHaveBeenCalledWith(
      token,
      "publica-chave-123"
    )
    expect(setHeader).toHaveBeenCalledWith("Idempotency-Replayed", "true")
    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith(cobranca)
  })

  it("responde 204 quando ainda nao existe cobranca", async () => {
    serviceMocks.buscar.mockResolvedValue({
      encontrado: true,
      cobranca: null
    })
    const req = { params: { token } } as unknown as Request
    const { response, status, send } = criarResponse()

    await buscarCobrancaPublicaController(req, response, next)

    expect(status).toHaveBeenCalledWith(204)
    expect(send).toHaveBeenCalledOnce()
  })
})
