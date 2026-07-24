import type { NextFunction, Request, Response } from "express"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { StatusOrdem } from "../generated/prisma/enums.js"

const serviceMocks = vi.hoisted(() => ({
  alterarStatusOrdemService: vi.fn(),
  atualizarOrdemService: vi.fn(),
  buscarOrdemService: vi.fn(),
  listarHistoricoOrdemService: vi.fn(),
  listarOrdensService: vi.fn(),
  removerOrdemService: vi.fn()
}))

vi.mock("../services/ordens.service.js", () => serviceMocks)

import {
  alterarStatusOrdem,
  atualizarOrdem
} from "./ordens.controllers.js"

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

describe("controllers de ordens", () => {
  const next = vi.fn() as NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("traduz conflito no PATCH geral para HTTP 409 com codigo e detalhes", async () => {
    serviceMocks.atualizarOrdemService.mockResolvedValue({
      sucesso: false,
      motivo: "conflito_atualizacao",
      statusEsperado: StatusOrdem.RECEBIDO,
      statusAtual: StatusOrdem.EM_ANALISE,
      versaoEsperada: 4,
      versaoAtual: 5
    })
    const req = criarRequest({
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4,
      diagnostico: "Fonte com defeito"
    })
    const { response, status, json } = criarResponse()

    await atualizarOrdem(req, response, next)

    expect(status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      erro: "A ordem foi alterada por outro usuário. Recarregue os dados antes de continuar.",
      codigo: "ORDEM_ATUALIZACAO_CONFLITANTE",
      detalhes: {
        statusEsperado: StatusOrdem.RECEBIDO,
        statusAtual: StatusOrdem.EM_ANALISE,
        versaoEsperada: 4,
        versaoAtual: 5
      }
    })
    expect(next).not.toHaveBeenCalled()
  })

  it("traduz cobranca em conciliacao para conflito da ordem", async () => {
    serviceMocks.alterarStatusOrdemService.mockResolvedValue({
      sucesso: false,
      motivo: "cobranca_em_conciliacao"
    })
    const req = criarRequest({
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      status: StatusOrdem.ENTREGUE
    })
    const { response, status, json } = criarResponse()

    await alterarStatusOrdem(req, response, next)

    expect(status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      erro: "Existe uma cobranca do gateway aguardando conciliacao.",
      codigo: "ORDEM_COBRANCA_EM_CONCILIACAO"
    })
  })

  it("mantem codigo distinto para transicao de status invalida", async () => {
    serviceMocks.atualizarOrdemService.mockResolvedValue({
      sucesso: false,
      motivo: "transicao_status_invalida",
      statusAtual: StatusOrdem.RECEBIDO,
      statusSolicitado: StatusOrdem.ENTREGUE,
      statusPermitidos: [
        StatusOrdem.EM_ANALISE,
        StatusOrdem.CANCELADO
      ]
    })
    const req = criarRequest({
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4,
      status: StatusOrdem.ENTREGUE
    })
    const { response, status, json } = criarResponse()

    await atualizarOrdem(req, response, next)

    expect(status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      erro: "Transição de status não permitida",
      codigo: "ORDEM_TRANSICAO_INVALIDA",
      detalhes: {
        statusAtual: StatusOrdem.RECEBIDO,
        statusSolicitado: StatusOrdem.ENTREGUE,
        statusPermitidos: [
          StatusOrdem.EM_ANALISE,
          StatusOrdem.CANCELADO
        ]
      }
    })
    expect(json).not.toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: "ORDEM_ATUALIZACAO_CONFLITANTE"
      })
    )
  })

  it("repassa status e versao esperados pela rota dedicada", async () => {
    const ordem = {
      id: 17,
      status: StatusOrdem.EM_ANALISE,
      versao: 5
    }
    serviceMocks.alterarStatusOrdemService.mockResolvedValue({
      sucesso: true,
      ordem
    })
    const req = criarRequest({
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4,
      status: StatusOrdem.EM_ANALISE
    })
    const { response, status, json } = criarResponse()

    await alterarStatusOrdem(req, response, next)

    expect(serviceMocks.alterarStatusOrdemService).toHaveBeenCalledWith(
      17,
      8,
      23,
      {
        statusEsperado: StatusOrdem.RECEBIDO,
        versaoEsperada: 4,
        status: StatusOrdem.EM_ANALISE
      }
    )
    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith(ordem)
  })

  it("informa que a entrega exige pagamento quitado", async () => {
    serviceMocks.alterarStatusOrdemService.mockResolvedValue({
      sucesso: false,
      motivo: "pagamento_insuficiente",
      resumo: {
        status: "PARCIAL",
        valorTotal: "300.00",
        totalPago: "100.00",
        totalEstornado: "0.00",
        saldo: "200.00"
      }
    })
    const req = criarRequest({
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      status: StatusOrdem.ENTREGUE
    })
    const { response, status, json } = criarResponse()

    await alterarStatusOrdem(req, response, next)

    expect(status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      erro: "O pagamento precisa estar quitado antes da entrega.",
      codigo: "ORDEM_PAGAMENTO_INSUFICIENTE",
      detalhes: {
        status: "PARCIAL",
        valorTotal: "300.00",
        totalPago: "100.00",
        totalEstornado: "0.00",
        saldo: "200.00"
      }
    })
  })
})
