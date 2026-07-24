import { beforeEach, describe, expect, it, vi } from "vitest"

import { Prisma } from "../generated/prisma/client.js"
import {
  FormaPagamento,
  OrigemPagamento,
  StatusOrdem,
  StatusRegistroPagamento
} from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  executarTransacao: vi.fn(),
  bloquearPagamento: vi.fn(),
  buscarOrdem: vi.fn(),
  buscarOrdemNaTransacao: vi.fn(),
  atualizarOrdem: vi.fn(),
  agruparPagamentos: vi.fn(),
  criarPagamento: vi.fn(),
  buscarPagamento: vi.fn(),
  atualizarPagamento: vi.fn(),
  cancelarCobrancas: vi.fn(),
  buscarCobrancaPaga: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    ordemServico: {
      findUnique: prismaMocks.buscarOrdem
    },
    $transaction: prismaMocks.executarTransacao
  }
}))

import {
  StatusResumoPagamento,
  calcularResumoPagamento,
  estornarPagamentoService,
  listarPagamentosService,
  pagamentoEstaQuitado,
  registrarPagamentoService
} from "./pagamentos.service.js"

const txMock = {
  $queryRaw: prismaMocks.bloquearPagamento,
  ordemServico: {
    findUnique: prismaMocks.buscarOrdemNaTransacao,
    updateMany: prismaMocks.atualizarOrdem
  },
  pagamento: {
    groupBy: prismaMocks.agruparPagamentos,
    create: prismaMocks.criarPagamento,
    findFirst: prismaMocks.buscarPagamento,
    update: prismaMocks.atualizarPagamento
  },
  cobranca: {
    updateMany: prismaMocks.cancelarCobrancas,
    findFirst: prismaMocks.buscarCobrancaPaga
  }
}

const ordemBase = {
  id: 17,
  orcamentoId: 12,
  valor: new Prisma.Decimal("100.00"),
  status: StatusOrdem.PRONTO,
  versao: 7
}

const pagamentoBase = {
  id: 21,
  ordemId: 17,
  valor: new Prisma.Decimal("40.00"),
  formaPagamento: FormaPagamento.PIX,
  status: StatusRegistroPagamento.CONFIRMADO,
  origem: OrigemPagamento.MANUAL,
  observacao: null,
  pagoEm: new Date("2026-07-22T12:00:00.000Z"),
  estornadoEm: null,
  motivoEstorno: null,
  criadoEm: new Date("2026-07-22T12:00:00.000Z"),
  registradoPor: {
    id: 23,
    nome: "Atendente",
    papel: "ATENDENTE"
  },
  estornadoPor: null
}

beforeEach(() => {
  vi.resetAllMocks()
  prismaMocks.executarTransacao.mockImplementation(
    async (
      executar: (transacao: typeof txMock) => Promise<unknown>
    ) => executar(txMock)
  )
  prismaMocks.cancelarCobrancas.mockResolvedValue({ count: 0 })
  prismaMocks.bloquearPagamento.mockResolvedValue([])
  prismaMocks.buscarCobrancaPaga.mockResolvedValue(null)
})

describe("resumo de pagamentos", () => {
  it.each([
    ["0.00", "0.00", "0.00", StatusResumoPagamento.PAGO, "0.00"],
    ["100.00", "0.00", "0.00", StatusResumoPagamento.PENDENTE, "100.00"],
    ["100.00", "40.00", "0.00", StatusResumoPagamento.PARCIAL, "60.00"],
    ["100.00", "100.00", "0.00", StatusResumoPagamento.PAGO, "0.00"],
    ["100.00", "0.00", "40.00", StatusResumoPagamento.ESTORNADO, "100.00"]
  ])(
    "deriva %s / %s / %s como %s",
    (valorTotal, totalPago, totalEstornado, status, saldo) => {
      const resumo = calcularResumoPagamento(
        valorTotal,
        totalPago,
        totalEstornado
      )

      expect(resumo).toEqual({
        status,
        valorTotal,
        totalPago,
        totalEstornado,
        saldo
      })
      expect(pagamentoEstaQuitado(resumo)).toBe(
        status === StatusResumoPagamento.PAGO
      )
    }
  )
})

describe("listarPagamentosService", () => {
  it("isola a ordem pela empresa e devolve ledger e resumo", async () => {
    prismaMocks.buscarOrdem.mockResolvedValue({
      valor: ordemBase.valor,
      status: ordemBase.status,
      versao: ordemBase.versao,
      pagamentos: [pagamentoBase]
    })

    const resultado = await listarPagamentosService(17, 8)

    expect(prismaMocks.buscarOrdem).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id_empresaId: {
            id: 17,
            empresaId: 8
          }
        }
      })
    )
    expect(resultado).toEqual({
      sucesso: true,
      pagamentos: [pagamentoBase],
      resumo: {
        status: StatusResumoPagamento.PARCIAL,
        valorTotal: "100.00",
        totalPago: "40.00",
        totalEstornado: "0.00",
        saldo: "60.00"
      },
      statusOrdem: StatusOrdem.PRONTO,
      versaoOrdem: 7
    })
  })

  it("nao consulta pagamentos de outra empresa quando a ordem nao existe", async () => {
    prismaMocks.buscarOrdem.mockResolvedValue(null)

    await expect(listarPagamentosService(17, 99)).resolves.toEqual({
      sucesso: false,
      motivo: "ordem_nao_encontrada"
    })
  })
})

describe("registrarPagamentoService", () => {
  it("faz CAS, incrementa a versao e registra uma parcela", async () => {
    prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce(ordemBase)
    prismaMocks.agruparPagamentos
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          status: StatusRegistroPagamento.CONFIRMADO,
          _sum: { valor: new Prisma.Decimal("40.00") }
        }
      ])
    prismaMocks.atualizarOrdem.mockResolvedValue({ count: 1 })
    prismaMocks.criarPagamento.mockResolvedValue(pagamentoBase)

    const resultado = await registrarPagamentoService(17, 8, 23, {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      valor: 40,
      formaPagamento: FormaPagamento.PIX
    })

    expect(prismaMocks.atualizarOrdem).toHaveBeenCalledWith({
      where: {
        id: 17,
        empresaId: 8,
        status: StatusOrdem.PRONTO,
        versao: 7
      },
      data: {
        versao: { increment: 1 }
      }
    })
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
    ).toBeLessThan(prismaMocks.atualizarOrdem.mock.invocationCallOrder[0]!)
    expect(prismaMocks.criarPagamento).toHaveBeenCalledWith({
      data: {
        empresaId: 8,
        ordemId: 17,
        valor: new Prisma.Decimal("40.00"),
        formaPagamento: FormaPagamento.PIX,
        status: StatusRegistroPagamento.CONFIRMADO,
        origem: OrigemPagamento.MANUAL,
        registradoPorId: 23
      },
      select: expect.any(Object)
    })
    expect(resultado).toEqual({
      sucesso: true,
      pagamento: pagamentoBase,
      resumo: {
        status: StatusResumoPagamento.PARCIAL,
        valorTotal: "100.00",
        totalPago: "40.00",
        totalEstornado: "0.00",
        saldo: "60.00"
      },
      versaoOrdem: 8
    })
  })

  it("rejeita valor superior ao saldo sem mudar versao", async () => {
    prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce(ordemBase)
    prismaMocks.agruparPagamentos.mockResolvedValueOnce([
      {
        status: StatusRegistroPagamento.CONFIRMADO,
        _sum: { valor: new Prisma.Decimal("80.00") }
      }
    ])

    const resultado = await registrarPagamentoService(17, 8, 23, {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      valor: 30,
      formaPagamento: FormaPagamento.DINHEIRO
    })

    expect(resultado).toMatchObject({
      sucesso: false,
      motivo: "valor_excede_saldo",
      valorPagamento: "30.00",
      resumo: {
        saldo: "20.00"
      }
    })
    expect(prismaMocks.atualizarOrdem).not.toHaveBeenCalled()
    expect(prismaMocks.criarPagamento).not.toHaveBeenCalled()
  })

  it("bloqueia pagamento manual enquanto uma cobranca paga aguarda conciliacao", async () => {
    prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce(ordemBase)
    prismaMocks.agruparPagamentos.mockResolvedValueOnce([])
    prismaMocks.buscarCobrancaPaga.mockResolvedValue({ id: 31 })

    const resultado = await registrarPagamentoService(17, 8, 23, {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      valor: 40,
      formaPagamento: FormaPagamento.DINHEIRO
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "cobranca_em_conciliacao"
    })
    expect(prismaMocks.atualizarOrdem).not.toHaveBeenCalled()
    expect(prismaMocks.criarPagamento).not.toHaveBeenCalled()
  })

  it.each([StatusOrdem.ENTREGUE, StatusOrdem.CANCELADO])(
    "bloqueia movimento financeiro quando a ordem esta %s",
    async status => {
      prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce({
        ...ordemBase,
        status
      })

      const resultado = await registrarPagamentoService(17, 8, 23, {
        statusEsperado: status,
        versaoEsperada: 7,
        valor: 40,
        formaPagamento: FormaPagamento.PIX
      })

      expect(resultado).toEqual({
        sucesso: false,
        motivo: "ordem_finalizada",
        statusAtual: status
      })
      expect(prismaMocks.agruparPagamentos).not.toHaveBeenCalled()
      expect(prismaMocks.atualizarOrdem).not.toHaveBeenCalled()
    }
  )

  it("retorna conflito quando o CAS perde e nao cria pagamento", async () => {
    prismaMocks.buscarOrdemNaTransacao
      .mockResolvedValueOnce(ordemBase)
      .mockResolvedValueOnce({
        status: StatusOrdem.PRONTO,
        versao: 8
      })
    prismaMocks.agruparPagamentos.mockResolvedValueOnce([])
    prismaMocks.atualizarOrdem.mockResolvedValue({ count: 0 })

    const resultado = await registrarPagamentoService(17, 8, 23, {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      valor: 40,
      formaPagamento: FormaPagamento.PIX
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "conflito_atualizacao",
      statusEsperado: StatusOrdem.PRONTO,
      statusAtual: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      versaoAtual: 8
    })
    expect(prismaMocks.criarPagamento).not.toHaveBeenCalled()
  })

  it("permite somente um vencedor em dois registros simultaneos", async () => {
    const estado = {
      versao: 7,
      pagamentos: [] as Array<{ valor: Prisma.Decimal }>
    }

    prismaMocks.buscarOrdemNaTransacao.mockImplementation(async () => ({
      ...ordemBase,
      versao: estado.versao
    }))
    prismaMocks.agruparPagamentos.mockImplementation(async () => {
      if (estado.pagamentos.length === 0) return []

      return [{
        status: StatusRegistroPagamento.CONFIRMADO,
        _sum: {
          valor: estado.pagamentos.reduce(
            (total, pagamento) => total.plus(pagamento.valor),
            new Prisma.Decimal(0)
          )
        }
      }]
    })
    prismaMocks.atualizarOrdem.mockImplementation(async ({ where }) => {
      if (estado.versao !== where.versao) return { count: 0 }
      estado.versao += 1
      return { count: 1 }
    })
    prismaMocks.criarPagamento.mockImplementation(async ({ data }) => {
      estado.pagamentos.push({ valor: data.valor })
      return pagamentoBase
    })

    const dados = {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      valor: 40,
      formaPagamento: FormaPagamento.PIX
    } as const
    const resultados = await Promise.all([
      registrarPagamentoService(17, 8, 23, dados),
      registrarPagamentoService(17, 8, 24, dados)
    ])

    expect(resultados.filter(resultado => resultado.sucesso)).toHaveLength(1)
    expect(
      resultados.filter(
        resultado =>
          !resultado.sucesso &&
          resultado.motivo === "conflito_atualizacao"
      )
    ).toHaveLength(1)
    expect(prismaMocks.criarPagamento).toHaveBeenCalledTimes(1)
    expect(estado.versao).toBe(8)
  })
})

describe("estornarPagamentoService", () => {
  it("estorna com autor e motivo depois de vencer o CAS", async () => {
    const pagamentoEstornado = {
      ...pagamentoBase,
      status: StatusRegistroPagamento.ESTORNADO,
      estornadoEm: new Date("2026-07-22T13:00:00.000Z"),
      motivoEstorno: "cobranca duplicada",
      estornadoPor: {
        id: 24,
        nome: "Administrador",
        papel: "ADMIN"
      }
    }
    prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce(ordemBase)
    prismaMocks.buscarPagamento.mockResolvedValue({
      id: 21,
      status: StatusRegistroPagamento.CONFIRMADO,
      origem: OrigemPagamento.MANUAL
    })
    prismaMocks.atualizarOrdem.mockResolvedValue({ count: 1 })
    prismaMocks.atualizarPagamento.mockResolvedValue(pagamentoEstornado)
    prismaMocks.agruparPagamentos.mockResolvedValueOnce([
      {
        status: StatusRegistroPagamento.ESTORNADO,
        _sum: { valor: new Prisma.Decimal("40.00") }
      }
    ])

    const resultado = await estornarPagamentoService(17, 21, 8, 24, {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      motivo: "cobranca duplicada"
    })

    expect(prismaMocks.atualizarPagamento).toHaveBeenCalledWith({
      where: {
        id_empresaId: {
          id: 21,
          empresaId: 8
        }
      },
      data: {
        status: StatusRegistroPagamento.ESTORNADO,
        estornadoEm: expect.any(Date),
        estornadoPorId: 24,
        motivoEstorno: "cobranca duplicada"
      },
      select: expect.any(Object)
    })
    expect(resultado).toEqual({
      sucesso: true,
      pagamento: pagamentoEstornado,
      resumo: {
        status: StatusResumoPagamento.ESTORNADO,
        valorTotal: "100.00",
        totalPago: "0.00",
        totalEstornado: "40.00",
        saldo: "100.00"
      },
      versaoOrdem: 8
    })
  })

  it("nao incrementa versao quando o pagamento ja foi estornado", async () => {
    prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce(ordemBase)
    prismaMocks.buscarPagamento.mockResolvedValue({
      id: 21,
      status: StatusRegistroPagamento.ESTORNADO,
      origem: OrigemPagamento.MANUAL
    })

    const resultado = await estornarPagamentoService(17, 21, 8, 24, {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      motivo: "cobranca duplicada"
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "pagamento_ja_estornado"
    })
    expect(prismaMocks.atualizarOrdem).not.toHaveBeenCalled()
    expect(prismaMocks.atualizarPagamento).not.toHaveBeenCalled()
  })

  it("bloqueia estorno local de pagamento confirmado pelo gateway", async () => {
    prismaMocks.buscarOrdemNaTransacao.mockResolvedValueOnce(ordemBase)
    prismaMocks.buscarPagamento.mockResolvedValue({
      id: 21,
      status: StatusRegistroPagamento.CONFIRMADO,
      origem: OrigemPagamento.GATEWAY
    })

    const resultado = await estornarPagamentoService(17, 21, 8, 24, {
      statusEsperado: StatusOrdem.PRONTO,
      versaoEsperada: 7,
      motivo: "solicitacao do cliente"
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "pagamento_gateway_exige_estorno_gateway"
    })
    expect(prismaMocks.buscarPagamento).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          status: true,
          origem: true
        }
      })
    )
    expect(prismaMocks.atualizarOrdem).not.toHaveBeenCalled()
    expect(prismaMocks.atualizarPagamento).not.toHaveBeenCalled()
  })
})
