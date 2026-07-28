import type { NextFunction, Request, Response } from "express"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  FormaPagamento,
  StatusOrdem
} from "../generated/prisma/enums.js"

const serviceMocks = vi.hoisted(() => ({
  listarPagamentosService: vi.fn(),
  registrarPagamentoService: vi.fn(),
  estornarPagamentoService: vi.fn()
}))

vi.mock("../services/pagamentos.service.js", () => serviceMocks)

import {
  estornarPagamentoController,
  listarPagamentosController,
  registrarPagamentoController
} from "./pagamentos.controllers.js"

function criarRequest(
  body: unknown = {},
  params: Record<string, string> = { id: "17" }
): Request {
  return {
    params,
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

const resumoParcial = {
  status: "PARCIAL",
  valorTotal: "100.00",
  totalPago: "40.00",
  totalEstornado: "0.00",
  saldo: "60.00"
}

describe("controllers de pagamentos", () => {
  const next = vi.fn() as NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lista pagamentos da ordem autenticada", async () => {
    serviceMocks.listarPagamentosService.mockResolvedValue({
      sucesso: true,
      pagamentos: [{ id: 21 }],
      resumo: resumoParcial,
      statusOrdem: StatusOrdem.PRONTO,
      versaoOrdem: 8
    })
    const req = criarRequest()
    const { response, status, json } = criarResponse()

    await listarPagamentosController(req, response, next)

    expect(serviceMocks.listarPagamentosService).toHaveBeenCalledWith(17, 8)
    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith({
      pagamentos: [{ id: 21 }],
      resumo: resumoParcial,
      statusOrdem: StatusOrdem.PRONTO,
      versaoOrdem: 8
    })
  })

  it("valida e registra um pagamento", async () => {
    const pagamento = { id: 21 }
    serviceMocks.registrarPagamentoService.mockResolvedValue({
      sucesso: true,
      pagamento,
      resumo: resumoParcial,
      versaoOrdem: 8
    })
    const body = {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      valor: 40,
      formaPagamento: FormaPagamento.DINHEIRO
    }
    const req = criarRequest(body)
    const { response, status, json } = criarResponse()

    await registrarPagamentoController(req, response, next)

    expect(serviceMocks.registrarPagamentoService).toHaveBeenCalledWith(
      17,
      8,
      23,
      body
    )
    expect(status).toHaveBeenCalledWith(201)
    expect(json).toHaveBeenCalledWith({
      pagamento,
      resumo: resumoParcial,
      versaoOrdem: 8
    })
  })

  it("traduz excesso sobre o saldo para 409 com codigo estavel", async () => {
    serviceMocks.registrarPagamentoService.mockResolvedValue({
      sucesso: false,
      motivo: "valor_excede_saldo",
      valorPagamento: "70.00",
      resumo: resumoParcial
    })
    const req = criarRequest({
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      valor: 70,
      formaPagamento: FormaPagamento.DINHEIRO
    })
    const { response, status, json } = criarResponse()

    await registrarPagamentoController(req, response, next)

    expect(status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      erro: "O valor do pagamento excede o saldo da ordem",
      codigo: "PAGAMENTO_EXCEDE_SALDO",
      detalhes: {
        valorPagamento: "70.00",
        ...resumoParcial
      }
    })
  })

  it("mantem o contrato de conflito otimista da ordem", async () => {
    serviceMocks.registrarPagamentoService.mockResolvedValue({
      sucesso: false,
      motivo: "conflito_atualizacao",
      statusEsperado: StatusOrdem.PRONTO,
      statusAtual: StatusOrdem.ENTREGUE,
      versaoEsperada: 7,
      versaoAtual: 8
    })
    const req = criarRequest({
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      valor: 40,
      formaPagamento: FormaPagamento.DINHEIRO
    })
    const { response, status, json } = criarResponse()

    await registrarPagamentoController(req, response, next)

    expect(status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      erro: "A ordem foi alterada por outro usuário. Recarregue os dados antes de continuar.",
      codigo: "ORDEM_ATUALIZACAO_CONFLITANTE",
      detalhes: {
        statusEsperado: StatusOrdem.PRONTO,
        statusAtual: StatusOrdem.ENTREGUE,
        versaoEsperada: 7,
        versaoAtual: 8
      }
    })
  })

  it("traduz cobranca em conciliacao para conflito financeiro", async () => {
    serviceMocks.registrarPagamentoService.mockResolvedValue({
      sucesso: false,
      motivo: "cobranca_em_conciliacao"
    })
    const req = criarRequest({
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      valor: 40,
      formaPagamento: FormaPagamento.DINHEIRO
    })
    const { response, status, json } = criarResponse()

    await registrarPagamentoController(req, response, next)

    expect(status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      erro: "Existe uma cobranca do gateway aguardando conciliacao.",
      codigo: "PAGAMENTO_COBRANCA_EM_CONCILIACAO"
    })
  })

  it("estorna o pagamento da ordem e devolve a nova versao", async () => {
    const resumoEstornado = {
      status: "ESTORNADO",
      valorTotal: "100.00",
      totalPago: "0.00",
      totalEstornado: "40.00",
      saldo: "100.00"
    }
    serviceMocks.estornarPagamentoService.mockResolvedValue({
      sucesso: true,
      pagamento: { id: 21, status: "ESTORNADO" },
      resumo: resumoEstornado,
      versaoOrdem: 9
    })
    const body = {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 8,
      motivo: "cobranca duplicada"
    }
    const req = criarRequest(body, {
      id: "17",
      pagamentoId: "21"
    })
    const { response, status, json } = criarResponse()

    await estornarPagamentoController(req, response, next)

    expect(serviceMocks.estornarPagamentoService).toHaveBeenCalledWith(
      17,
      21,
      8,
      23,
      body
    )
    expect(status).toHaveBeenCalledWith(200)
    expect(json).toHaveBeenCalledWith({
      pagamento: { id: 21, status: "ESTORNADO" },
      resumo: resumoEstornado,
      versaoOrdem: 9
    })
  })

  it("rejeita IDs invalidos antes de chamar o service", async () => {
    const req = criarRequest({}, {
      id: "17",
      pagamentoId: "invalido"
    })
    const { response, status, json } = criarResponse()

    await estornarPagamentoController(req, response, next)

    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ erro: "ID inválido" })
    expect(serviceMocks.estornarPagamentoService).not.toHaveBeenCalled()
  })

  it("orienta estorno no provedor para pagamento de gateway", async () => {
    serviceMocks.estornarPagamentoService.mockResolvedValue({
      sucesso: false,
      motivo: "pagamento_gateway_exige_estorno_gateway"
    })
    const req = criarRequest({
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      motivo: "solicitacao do cliente"
    }, {
      id: "17",
      pagamentoId: "21"
    })
    const { response, status, json } = criarResponse()

    await estornarPagamentoController(req, response, next)

    expect(status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      erro: "Pagamentos confirmados pelo gateway devem ser estornados pelo provedor.",
      codigo: "PAGAMENTO_GATEWAY_EXIGE_ESTORNO_NO_PROVEDOR"
    })
  })
})
