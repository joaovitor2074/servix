import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  FormaPagamento,
  StatusCobranca,
  StatusOrcamento,
  StatusOrdem,
  StatusRegistroPagamento
} from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  contarClientes: vi.fn(),
  contarCobrancas: vi.fn(),
  agruparOrdens: vi.fn(),
  listarOrdens: vi.fn(),
  listarCobrancas: vi.fn(),
  agruparOrcamentos: vi.fn(),
  executarTransacao: vi.fn()
}))

const cobrancaServiceMocks = vi.hoisted(() => ({
  expirarVencidas: vi.fn()
}))

vi.mock("./cobrancas.service.js", () => ({
  expirarCobrancasVencidasService: cobrancaServiceMocks.expirarVencidas
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    cliente: {
      count: prismaMocks.contarClientes
    },
    ordemServico: {
      groupBy: prismaMocks.agruparOrdens,
      findMany: prismaMocks.listarOrdens
    },
    orcamento: {
      groupBy: prismaMocks.agruparOrcamentos
    },
    cobranca: {
      count: prismaMocks.contarCobrancas,
      findMany: prismaMocks.listarCobrancas
    },
    $transaction: prismaMocks.executarTransacao
  }
}))

import { buscarResumoDashboardService } from "./dashboard.service.js"

describe("buscarResumoDashboardService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cobrancaServiceMocks.expirarVencidas.mockResolvedValue(0)
  })

  it("monta indicadores e filas operacionais isolados por empresa", async () => {
    const criadoEm = new Date("2026-07-18T12:00:00.000Z")
    const atualizadoEm = new Date("2026-07-21T12:00:00.000Z")
    const cliente = { id: 3, nome: "Cliente Teste" }
    const ordemBase = {
      equipamento: "Notebook",
      criadoEm,
      atualizadoEm,
      previsaoDeEntrega: null,
      cliente
    }
    const ordensRecentes = [
      {
        id: 7,
        equipamento: "Notebook",
        status: StatusOrdem.EM_EXECUCAO,
        criadoEm,
        cliente
      }
    ]
    const ordensEmAberto = [
      {
        ...ordemBase,
        id: 7,
        status: StatusOrdem.EM_EXECUCAO
      }
    ]
    const ordensComPendencia = [
      {
        ...ordemBase,
        id: 8,
        status: StatusOrdem.AGUARDANDO_PECA,
        valor: "120.00",
        pagamentos: []
      },
      {
        ...ordemBase,
        id: 9,
        status: StatusOrdem.PRONTO,
        valor: "300.00",
        pagamentos: [
          {
            valor: "100.00",
            status: StatusRegistroPagamento.CONFIRMADO
          }
        ]
      },
      {
        ...ordemBase,
        id: 10,
        status: StatusOrdem.PRONTO,
        valor: "150.00",
        pagamentos: [
          {
            valor: "150.00",
            status: StatusRegistroPagamento.CONFIRMADO
          }
        ]
      }
    ]
    const cobrancasPendentes = [
      {
        id: 21,
        valor: "300.00",
        formaPagamento: FormaPagamento.PIX,
        status: StatusCobranca.PENDENTE,
        criadoEm,
        expiraEm: new Date("2026-07-22T15:00:00.000Z"),
        orcamento: {
          id: 15,
          numero: 20260015,
          equipamento: "Notebook",
          cliente
        },
        ordem: {
          id: 9,
          status: StatusOrdem.PRONTO
        }
      }
    ]

    prismaMocks.executarTransacao.mockResolvedValue([
      4,
      [
        { status: StatusOrdem.RECEBIDO, _count: { _all: 2 } },
        { status: StatusOrdem.EM_EXECUCAO, _count: { _all: 1 } },
        { status: StatusOrdem.AGUARDANDO_PECA, _count: { _all: 1 } },
        { status: StatusOrdem.PRONTO, _count: { _all: 2 } },
        { status: StatusOrdem.ENTREGUE, _count: { _all: 4 } },
        { status: StatusOrdem.CANCELADO, _count: { _all: 1 } }
      ],
      ordensRecentes,
      ordensEmAberto,
      ordensComPendencia,
      [
        { status: StatusOrcamento.ENVIADO, _count: { _all: 3 } },
        { status: StatusOrcamento.APROVADO, _count: { _all: 2 } }
      ],
      1,
      cobrancasPendentes
    ])

    const resumo = await buscarResumoDashboardService(12)

    expect(cobrancaServiceMocks.expirarVencidas).toHaveBeenCalledWith(12)
    expect(prismaMocks.contarClientes).toHaveBeenCalledWith({
      where: { empresaId: 12 }
    })
    expect(prismaMocks.agruparOrdens).toHaveBeenCalledWith(
      expect.objectContaining({ where: { empresaId: 12 } })
    )
    expect(prismaMocks.listarOrdens).toHaveBeenCalledTimes(3)
    expect(prismaMocks.listarOrdens).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ empresaId: 12 }),
        take: 8
      })
    )
    expect(prismaMocks.listarOrdens).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: expect.objectContaining({ empresaId: 12 }),
        take: 8,
        select: expect.objectContaining({ pagamentos: expect.any(Object) })
      })
    )
    expect(prismaMocks.agruparOrcamentos).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ empresaId: 12 })
      })
    )
    expect(prismaMocks.contarCobrancas).toHaveBeenCalledWith({
      where: {
        empresaId: 12,
        status: StatusCobranca.PENDENTE
      }
    })
    expect(prismaMocks.listarCobrancas).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          empresaId: 12,
          status: StatusCobranca.PENDENTE
        },
        take: 8
      })
    )

    expect(resumo.clientes.total).toBe(4)
    expect(resumo.ordens.total).toBe(11)
    expect(resumo.ordens.abertas).toBe(6)
    expect(resumo.ordens.aguardandoPeca).toBe(1)
    expect(resumo.ordens.prontasParaFinalizar).toBe(2)
    expect(resumo.ordens.porStatus.EM_ANALISE).toBe(0)
    expect(resumo.ordens.recentes).toEqual(ordensRecentes)
    expect(resumo.ordens.emAberto).toEqual(ordensEmAberto)
    expect(resumo.orcamentos).toEqual({
      aguardandoCliente: 3,
      aprovadosParaOrdem: 2
    })
    expect(resumo.cobrancas).toEqual({
      pendentes: 1,
      listaPendentes: cobrancasPendentes
    })

    expect(resumo.ordens.pendencias).toEqual([
      expect.objectContaining({
        id: 8,
        tipo: "AGUARDANDO_PECA",
        pagamento: null
      }),
      expect.objectContaining({
        id: 9,
        tipo: "AGUARDANDO_PAGAMENTO",
        pagamento: expect.objectContaining({
          status: "PARCIAL",
          totalPago: "100.00",
          saldo: "200.00"
        })
      }),
      expect.objectContaining({
        id: 10,
        tipo: "AGUARDANDO_ENTREGA",
        pagamento: expect.objectContaining({
          status: "PAGO",
          saldo: "0.00"
        })
      })
    ])
  })

  it("retorna zero e listas vazias quando a empresa ainda nao tem operacao", async () => {
    prismaMocks.executarTransacao.mockResolvedValue([
      0,
      [],
      [],
      [],
      [],
      [],
      0,
      []
    ])

    const resumo = await buscarResumoDashboardService(99)

    expect(resumo).toEqual({
      clientes: { total: 0 },
      ordens: {
        total: 0,
        abertas: 0,
        aguardandoPeca: 0,
        prontasParaFinalizar: 0,
        recentes: [],
        emAberto: [],
        pendencias: [],
        porStatus: expect.objectContaining({
          RECEBIDO: 0,
          EM_ANALISE: 0,
          EM_EXECUCAO: 0,
          AGUARDANDO_PECA: 0,
          PRONTO: 0,
          ENTREGUE: 0,
          CANCELADO: 0
        })
      },
      orcamentos: {
        aguardandoCliente: 0,
        aprovadosParaOrdem: 0
      },
      cobrancas: {
        pendentes: 0,
        listaPendentes: []
      }
    })
  })
})
