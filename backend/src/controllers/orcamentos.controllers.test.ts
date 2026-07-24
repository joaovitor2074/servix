import type { NextFunction, Request, Response } from "express"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { StatusOrcamento } from "../generated/prisma/enums.js"

const serviceMocks = vi.hoisted(() => ({
  alterarStatusOrcamentoService: vi.fn(),
  aprovarOrcamentoPublicoService: vi.fn(),
  atualizarOrcamentoService: vi.fn(),
  buscarOrcamentoPublicoService: vi.fn(),
  buscarOrcamentoService: vi.fn(),
  criarOrcamentoService: vi.fn(),
  listarOrcamentosService: vi.fn(),
  rejeitarOrcamentoPublicoService: vi.fn(),
  transformarOrcamentoEmOrdemService: vi.fn()
}))

vi.mock("../services/orcamentos.service.js", () => serviceMocks)

import {
  alterarStatusOrcamento,
  transformarOrcamentoEmOrdem
} from "./orcamentos.controllers.js"

function criarRequest(body: unknown): Request {
  return {
    params: { id: "17" },
    body,
    auth: {
      empresaId: 8,
      usuarioId: 23,
      papel: "ADMIN"
    }
  } as unknown as Request
}

function criarResponse() {
  const json = vi.fn()
  const status = vi.fn().mockReturnValue({ json })
  return {
    response: { status } as unknown as Response,
    status,
    json
  }
}

describe("controllers de orcamentos", () => {
  const next = vi.fn() as NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("traduz perda de CAS para 409 com snapshot atual", async () => {
    serviceMocks.alterarStatusOrcamentoService.mockResolvedValue({
      sucesso: false,
      motivo: "conflito_atualizacao",
      statusEsperado: StatusOrcamento.ENVIADO,
      statusAtual: StatusOrcamento.APROVADO,
      versaoEsperada: 3,
      versaoAtual: 4
    })
    const req = criarRequest({
      statusEsperado: StatusOrcamento.ENVIADO,
      versaoEsperada: 3,
      status: StatusOrcamento.CANCELADO
    })
    const { response, status, json } = criarResponse()

    await alterarStatusOrcamento(req, response, next)

    expect(status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      erro: expect.any(String),
      codigo: "ORCAMENTO_ATUALIZACAO_CONFLITANTE",
      detalhes: {
        statusEsperado: StatusOrcamento.ENVIADO,
        statusAtual: StatusOrcamento.APROVADO,
        versaoEsperada: 3,
        versaoAtual: 4
      }
    })
    expect(next).not.toHaveBeenCalled()
  })

  it("bloqueia cancelamento de orçamento que já possui cobrança paga", async () => {
    serviceMocks.alterarStatusOrcamentoService.mockResolvedValue({
      sucesso: false,
      motivo: "cobranca_paga"
    })
    const req = criarRequest({
      statusEsperado: StatusOrcamento.APROVADO,
      versaoEsperada: 4,
      status: StatusOrcamento.CANCELADO
    })
    const { response, status, json } = criarResponse()

    await alterarStatusOrcamento(req, response, next)

    expect(status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      erro: expect.any(String),
      codigo: "ORCAMENTO_POSSUI_COBRANCA_PAGA"
    })
    expect(next).not.toHaveBeenCalled()
  })

  it("retorna 200 quando a transformacao ja havia ocorrido", async () => {
    serviceMocks.transformarOrcamentoEmOrdemService.mockResolvedValue({
      sucesso: true,
      ordem: { id: 91 },
      jaExistente: true
    })
    const req = criarRequest({
      statusEsperado: StatusOrcamento.APROVADO,
      versaoEsperada: 4
    })
    const { response, status, json } = criarResponse()

    await transformarOrcamentoEmOrdem(req, response, next)

    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith({
      ordem: { id: 91 },
      jaExistente: true
    })
  })
})
