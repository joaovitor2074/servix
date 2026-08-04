import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  StatusOrdem,
  StatusRegistroPagamento
} from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  executarTransacao: vi.fn(),
  bloquearPagamento: vi.fn(),
  atualizarCondicionalmente: vi.fn(),
  buscarOrdemNaTransacao: vi.fn(),
  criarHistorico: vi.fn(),
  agruparPagamentos: vi.fn(),
  cancelarCobrancas: vi.fn(),
  buscarCobrancaPaga: vi.fn(),
  criarGarantia: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    $transaction: prismaMocks.executarTransacao
  }
}))

import {
  alterarStatusOrdemService,
  atualizarOrdemService,
  removerOrdemService
} from "./ordens.service.js"

const txMock = {
  $queryRaw: prismaMocks.bloquearPagamento,
  ordemServico: {
    updateMany: prismaMocks.atualizarCondicionalmente,
    findUnique: prismaMocks.buscarOrdemNaTransacao
  },
  historicoStatusOrdem: {
    create: prismaMocks.criarHistorico
  },
  pagamento: {
    groupBy: prismaMocks.agruparPagamentos
  },
  cobranca: {
    updateMany: prismaMocks.cancelarCobrancas,
    findFirst: prismaMocks.buscarCobrancaPaga
  },
  garantiaServico: {
    upsert: prismaMocks.criarGarantia
  }
}

const ordemBase = {
  id: 17,
  empresaId: 8,
  clienteId: 4,
  orcamentoId: 12,
  equipamento: "Notebook",
  problemaRelatado: "Não liga",
  valor: "100.00",
  status: StatusOrdem.EM_ANALISE,
  versao: 5,
  cliente: {
    id: 4,
    nome: "Cliente Teste",
    telefone: "11999999999"
  }
}

const ordemRecebida = {
  ...ordemBase,
  status: StatusOrdem.RECEBIDO,
  versao: 4
}

beforeEach(() => {
  vi.resetAllMocks()
  prismaMocks.executarTransacao.mockImplementation(
    async (
      executar: (transacao: typeof txMock) => Promise<unknown>
    ) => executar(txMock)
  )
  prismaMocks.agruparPagamentos.mockResolvedValue([])
  prismaMocks.bloquearPagamento.mockResolvedValue([])
  prismaMocks.cancelarCobrancas.mockResolvedValue({ count: 0 })
  prismaMocks.buscarCobrancaPaga.mockResolvedValue(null)
  prismaMocks.criarGarantia.mockResolvedValue({ id: 1 })
})

describe("alterarStatusOrdemService", () => {
  it("atualiza por empresa, status e versão e registra o histórico", async () => {
    prismaMocks.atualizarCondicionalmente.mockResolvedValue({ count: 1 })
    prismaMocks.criarHistorico.mockResolvedValue({ id: 31 })
    prismaMocks.buscarOrdemNaTransacao
      .mockResolvedValueOnce(ordemRecebida)
      .mockResolvedValueOnce(ordemBase)

    const resultado = await alterarStatusOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4,
      status: StatusOrdem.EM_ANALISE,
      mensagemPublica: "Equipamento em análise."
    })

    expect(prismaMocks.atualizarCondicionalmente).toHaveBeenCalledWith({
      where: {
        id: 17,
        empresaId: 8,
        status: StatusOrdem.RECEBIDO,
        versao: 4
      },
      data: {
        status: StatusOrdem.EM_ANALISE,
        versao: { increment: 1 }
      }
    })
    expect(prismaMocks.criarHistorico).toHaveBeenCalledOnce()
    expect(prismaMocks.criarHistorico).toHaveBeenCalledWith({
      data: {
        ordemId: 17,
        empresaId: 8,
        statusAnterior: StatusOrdem.RECEBIDO,
        status: StatusOrdem.EM_ANALISE,
        mensagemPublica: "Equipamento em análise.",
        alteradoPorId: 23
      }
    })
    expect(resultado).toEqual({
      sucesso: true,
      ordem: ordemBase
    })
  })

  it("retorna conflito quando o compare-and-swap perde e não cria histórico", async () => {
    prismaMocks.atualizarCondicionalmente.mockResolvedValue({ count: 0 })
    prismaMocks.buscarOrdemNaTransacao
      .mockResolvedValueOnce(ordemRecebida)
      .mockResolvedValueOnce({
        status: StatusOrdem.EM_ANALISE,
        versao: 5
      })

    const resultado = await alterarStatusOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4,
      status: StatusOrdem.EM_ANALISE
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "conflito_atualizacao",
      statusEsperado: StatusOrdem.RECEBIDO,
      statusAtual: StatusOrdem.EM_ANALISE,
      versaoEsperada: 4,
      versaoAtual: 5
    })
    expect(prismaMocks.criarHistorico).not.toHaveBeenCalled()
  })

  it("recusa uma transição inválida a partir do snapshot atual", async () => {
    prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce(ordemRecebida)

    const resultado = await alterarStatusOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4,
      status: StatusOrdem.ENTREGUE
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "transicao_status_invalida",
      statusAtual: StatusOrdem.RECEBIDO,
      statusSolicitado: StatusOrdem.ENTREGUE,
      statusPermitidos: [
        StatusOrdem.EM_ANALISE,
        StatusOrdem.CANCELADO
      ]
    })
    expect(prismaMocks.executarTransacao).toHaveBeenCalledOnce()
    expect(prismaMocks.buscarOrdemNaTransacao).toHaveBeenCalledOnce()
    expect(prismaMocks.atualizarCondicionalmente).not.toHaveBeenCalled()
    expect(prismaMocks.criarHistorico).not.toHaveBeenCalled()
  })

  it("prioriza o conflito do snapshot desatualizado sobre a transição inválida", async () => {
    prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce(ordemBase)

    const resultado = await alterarStatusOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4,
      status: StatusOrdem.ENTREGUE
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "conflito_atualizacao",
      statusEsperado: StatusOrdem.RECEBIDO,
      statusAtual: StatusOrdem.EM_ANALISE,
      versaoEsperada: 4,
      versaoAtual: 5
    })
    expect(prismaMocks.atualizarCondicionalmente).not.toHaveBeenCalled()
    expect(prismaMocks.criarHistorico).not.toHaveBeenCalled()
  })

  it("bloqueia a entrega sem pagamento e não cria histórico", async () => {
    const ordemPronta = {
      ...ordemBase,
      status: StatusOrdem.PRONTO,
      versao: 7
    }
    prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce(ordemPronta)

    const resultado = await alterarStatusOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      status: StatusOrdem.ENTREGUE
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "pagamento_insuficiente",
      resumo: {
        status: "PENDENTE",
        valorTotal: "100.00",
        totalPago: "0.00",
        totalEstornado: "0.00",
        saldo: "100.00"
      }
    })
    expect(prismaMocks.atualizarCondicionalmente).not.toHaveBeenCalled()
    expect(prismaMocks.criarHistorico).not.toHaveBeenCalled()
  })

  it("permite entregar quando o pagamento está quitado", async () => {
    const ordemPronta = {
      ...ordemBase,
      status: StatusOrdem.PRONTO,
      versao: 7
    }
    const ordemEntregue = {
      ...ordemPronta,
      status: StatusOrdem.ENTREGUE,
      versao: 8
    }
    prismaMocks.buscarOrdemNaTransacao
      .mockResolvedValueOnce(ordemPronta)
      .mockResolvedValueOnce(ordemEntregue)
    prismaMocks.agruparPagamentos.mockResolvedValueOnce([{
      status: StatusRegistroPagamento.CONFIRMADO,
      _sum: { valor: "100.00" }
    }])
    prismaMocks.atualizarCondicionalmente.mockResolvedValue({ count: 1 })
    prismaMocks.criarHistorico.mockResolvedValue({ id: 32 })

    const resultado = await alterarStatusOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      status: StatusOrdem.ENTREGUE
    })

    expect(resultado).toEqual({ sucesso: true, ordem: ordemEntregue })
    expect(prismaMocks.cancelarCobrancas).toHaveBeenCalledWith({
      where: {
        empresaId: 8,
        status: "PENDENTE",
        OR: [
          { ordemId: 17 },
          { orcamentoId: 12 }
        ]
      },
      data: {
        status: "CANCELADA",
        canceladaEm: expect.any(Date)
      }
    })
    expect(
      prismaMocks.cancelarCobrancas.mock.invocationCallOrder[0]
    ).toBeLessThan(
      prismaMocks.atualizarCondicionalmente.mock.invocationCallOrder[0]!
    )
    expect(prismaMocks.atualizarCondicionalmente).toHaveBeenCalledOnce()
    expect(prismaMocks.criarHistorico).toHaveBeenCalledWith({
      data: {
        ordemId: 17,
        empresaId: 8,
        statusAnterior: StatusOrdem.PRONTO,
        status: StatusOrdem.ENTREGUE,
        alteradoPorId: 23
      }
    })
    expect(prismaMocks.criarGarantia).toHaveBeenCalledOnce()
  })

  it("bloqueia status terminal com cobranca paga ainda nao conciliada", async () => {
    const ordemPronta = {
      ...ordemBase,
      status: StatusOrdem.PRONTO,
      versao: 7
    }
    prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce(ordemPronta)
    prismaMocks.agruparPagamentos.mockResolvedValueOnce([{
      status: StatusRegistroPagamento.CONFIRMADO,
      _sum: { valor: "100.00" }
    }])
    prismaMocks.buscarCobrancaPaga.mockResolvedValue({ id: 31 })

    const resultado = await alterarStatusOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      status: StatusOrdem.ENTREGUE
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "cobranca_em_conciliacao"
    })
    expect(prismaMocks.atualizarCondicionalmente).not.toHaveBeenCalled()
  })

  it("mantém o mesmo estado sem incrementar versão nem criar histórico", async () => {
    prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce(ordemRecebida)

    const resultado = await alterarStatusOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4,
      status: StatusOrdem.RECEBIDO
    })

    expect(resultado).toEqual({
      sucesso: true,
      ordem: ordemRecebida
    })
    expect(prismaMocks.buscarOrdemNaTransacao).toHaveBeenCalledOnce()
    expect(prismaMocks.atualizarCondicionalmente).not.toHaveBeenCalled()
    expect(prismaMocks.criarHistorico).not.toHaveBeenCalled()
  })

  it("permite somente um vencedor em duas alterações simultâneas", async () => {
    const estado = {
      status: StatusOrdem.RECEBIDO,
      versao: 4
    }

    prismaMocks.atualizarCondicionalmente.mockImplementation(
      async ({ where, data }) => {
        if (
          estado.status !== where.status ||
          estado.versao !== where.versao
        ) {
          return { count: 0 }
        }

        estado.status = data.status
        estado.versao += 1
        return { count: 1 }
      }
    )
    prismaMocks.buscarOrdemNaTransacao.mockImplementation(
      async ({ select }) => {
        const snapshot = {
          ...ordemBase,
          status: estado.status,
          versao: estado.versao
        }

        return select
          ? { status: snapshot.status, versao: snapshot.versao }
          : snapshot
      }
    )
    prismaMocks.criarHistorico.mockResolvedValue({ id: 31 })

    const resultados = await Promise.all([
      alterarStatusOrdemService(17, 8, 23, {
        statusEsperado: StatusOrdem.RECEBIDO,
        versaoEsperada: 4,
        status: StatusOrdem.EM_ANALISE
      }),
      alterarStatusOrdemService(17, 8, 24, {
        statusEsperado: StatusOrdem.RECEBIDO,
        versaoEsperada: 4,
        status: StatusOrdem.CANCELADO
      })
    ])

    const sucessos = resultados.filter(resultado => resultado.sucesso)
    const conflitos = resultados.filter(
      resultado =>
        !resultado.sucesso &&
        resultado.motivo === "conflito_atualizacao"
    )

    expect(sucessos).toHaveLength(1)
    expect(conflitos).toHaveLength(1)
    expect(prismaMocks.atualizarCondicionalmente).toHaveBeenCalledTimes(2)
    expect(prismaMocks.criarHistorico).toHaveBeenCalledTimes(1)
    expect(estado.versao).toBe(5)
  })
})

describe("atualizarOrdemService", () => {
  it("edita campos com CAS e incrementa a versão sem criar histórico", async () => {
    const ordemAtualizada = {
      ...ordemBase,
      diagnostico: "Fonte revisada",
      status: StatusOrdem.RECEBIDO,
      versao: 5
    }
    prismaMocks.atualizarCondicionalmente.mockResolvedValue({ count: 1 })
    prismaMocks.buscarOrdemNaTransacao
      .mockResolvedValueOnce(ordemRecebida)
      .mockResolvedValueOnce(ordemAtualizada)

    const resultado = await atualizarOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4,
      diagnostico: "Fonte revisada"
    })

    expect(prismaMocks.atualizarCondicionalmente).toHaveBeenCalledWith({
      where: {
        id: 17,
        empresaId: 8,
        status: StatusOrdem.RECEBIDO,
        versao: 4
      },
      data: {
        diagnostico: "Fonte revisada",
        versao: { increment: 1 }
      }
    })
    expect(prismaMocks.criarHistorico).not.toHaveBeenCalled()
    expect(resultado).toEqual({
      sucesso: true,
      ordem: ordemAtualizada
    })
  })

  it("registra um histórico quando a edição também muda o status", async () => {
    const ordemAtualizada = {
      ...ordemBase,
      diagnostico: "Fonte de alimentação com defeito"
    }
    prismaMocks.atualizarCondicionalmente.mockResolvedValue({ count: 1 })
    prismaMocks.criarHistorico.mockResolvedValue({ id: 32 })
    prismaMocks.buscarOrdemNaTransacao
      .mockResolvedValueOnce(ordemRecebida)
      .mockResolvedValueOnce(ordemAtualizada)

    const resultado = await atualizarOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4,
      status: StatusOrdem.EM_ANALISE,
      diagnostico: "Fonte de alimentação com defeito"
    })

    expect(prismaMocks.atualizarCondicionalmente).toHaveBeenCalledWith({
      where: {
        id: 17,
        empresaId: 8,
        status: StatusOrdem.RECEBIDO,
        versao: 4
      },
      data: {
        diagnostico: "Fonte de alimentação com defeito",
        status: StatusOrdem.EM_ANALISE,
        versao: { increment: 1 }
      }
    })
    expect(prismaMocks.criarHistorico).toHaveBeenCalledOnce()
    expect(prismaMocks.criarHistorico).toHaveBeenCalledWith({
      data: {
        ordemId: 17,
        empresaId: 8,
        statusAnterior: StatusOrdem.RECEBIDO,
        status: StatusOrdem.EM_ANALISE,
        alteradoPorId: 23
      }
    })
    expect(resultado).toEqual({
      sucesso: true,
      ordem: ordemAtualizada
    })
  })

  it("não grava histórico nem retorna sucesso quando o CAS falha", async () => {
    prismaMocks.atualizarCondicionalmente.mockResolvedValue({ count: 0 })
    prismaMocks.buscarOrdemNaTransacao
      .mockResolvedValueOnce(ordemRecebida)
      .mockResolvedValueOnce({
        status: StatusOrdem.EM_ANALISE,
        versao: 5
      })

    const resultado = await atualizarOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4,
      status: StatusOrdem.EM_ANALISE
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "conflito_atualizacao",
      statusEsperado: StatusOrdem.RECEBIDO,
      statusAtual: StatusOrdem.EM_ANALISE,
      versaoEsperada: 4,
      versaoAtual: 5
    })
    expect(prismaMocks.criarHistorico).not.toHaveBeenCalled()
    expect(prismaMocks.buscarOrdemNaTransacao).toHaveBeenCalledTimes(2)
  })
})

describe("removerOrdemService", () => {
  it("cancela usando o mesmo CAS e registra a transição", async () => {
    const ordemCancelada = {
      ...ordemBase,
      status: StatusOrdem.CANCELADO,
      versao: 5
    }
    prismaMocks.atualizarCondicionalmente.mockResolvedValue({ count: 1 })
    prismaMocks.criarHistorico.mockResolvedValue({ id: 33 })
    prismaMocks.buscarOrdemNaTransacao
      .mockResolvedValueOnce(ordemRecebida)
      .mockResolvedValueOnce(ordemCancelada)

    const resultado = await removerOrdemService(17, 8, 23, {
      statusEsperado: StatusOrdem.RECEBIDO,
      versaoEsperada: 4
    })

    expect(prismaMocks.cancelarCobrancas).toHaveBeenCalledOnce()
    expect(
      prismaMocks.cancelarCobrancas.mock.invocationCallOrder[0]
    ).toBeLessThan(
      prismaMocks.atualizarCondicionalmente.mock.invocationCallOrder[0]!
    )
    expect(prismaMocks.atualizarCondicionalmente).toHaveBeenCalledWith({
      where: {
        id: 17,
        empresaId: 8,
        status: StatusOrdem.RECEBIDO,
        versao: 4
      },
      data: {
        status: StatusOrdem.CANCELADO,
        versao: { increment: 1 }
      }
    })
    expect(prismaMocks.criarHistorico).toHaveBeenCalledWith({
      data: {
        ordemId: 17,
        empresaId: 8,
        statusAnterior: StatusOrdem.RECEBIDO,
        status: StatusOrdem.CANCELADO,
        alteradoPorId: 23
      }
    })
    expect(resultado).toEqual({
      sucesso: true,
      ordem: ordemCancelada
    })
  })
})
