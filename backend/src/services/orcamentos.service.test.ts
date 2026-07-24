import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  FormaPagamento,
  StatusCobranca,
  StatusOrcamento,
  StatusOrdem,
  TipoItemOrcamento
} from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  transacao: vi.fn(),
  buscarCliente: vi.fn(),
  atualizarEmpresa: vi.fn(),
  buscarOrcamento: vi.fn(),
  criarOrcamento: vi.fn(),
  atualizarOrcamento: vi.fn(),
  criarHistoricoOrcamento: vi.fn(),
  removerItens: vi.fn(),
  criarItens: vi.fn(),
  criarOrdem: vi.fn(),
  listarCobrancasPagas: vi.fn(),
  buscarCobrancaPaga: vi.fn(),
  cancelarCobrancasPendentes: vi.fn(),
  materializarCobranca: vi.fn(),
  buscarOrdem: vi.fn(),
  buscarPublico: vi.fn(),
  buscarConfiguracaoPagamento: vi.fn(),
  configuracaoAceitaPix: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    $transaction: prismaMocks.transacao,
    orcamento: {
      findUnique: prismaMocks.buscarPublico
    },
    ordemServico: {
      findUnique: prismaMocks.buscarOrdem
    }
  }
}))

vi.mock("./cobrancas.service.js", () => ({
  cancelarCobrancasPendentesTx: prismaMocks.cancelarCobrancasPendentes,
  configuracaoPagamentoAceitaPix: prismaMocks.configuracaoAceitaPix,
  materializarPagamentoDaCobrancaTx: prismaMocks.materializarCobranca
}))

import {
  alterarStatusOrcamentoService,
  aprovarOrcamentoPublicoService,
  buscarOrcamentoPublicoService,
  calcularTotaisOrcamento,
  criarOrcamentoService,
  transformarOrcamentoEmOrdemService
} from "./orcamentos.service.js"

const txMock = {
  cliente: {
    findUnique: prismaMocks.buscarCliente
  },
  empresa: {
    update: prismaMocks.atualizarEmpresa
  },
  orcamento: {
    findUnique: prismaMocks.buscarOrcamento,
    create: prismaMocks.criarOrcamento,
    updateMany: prismaMocks.atualizarOrcamento
  },
  itemOrcamento: {
    deleteMany: prismaMocks.removerItens,
    createMany: prismaMocks.criarItens
  },
  historicoStatusOrcamento: {
    create: prismaMocks.criarHistoricoOrcamento
  },
  ordemServico: {
    create: prismaMocks.criarOrdem
  },
  cobranca: {
    findMany: prismaMocks.listarCobrancasPagas,
    findFirst: prismaMocks.buscarCobrancaPaga
  },
  configuracaoPagamento: {
    findUnique: prismaMocks.buscarConfiguracaoPagamento
  }
}

const itens = [
  {
    descricao: "Diagnostico",
    quantidade: 2,
    valorUnitario: 10.25,
    tipo: TipoItemOrcamento.SERVICO
  },
  {
    descricao: "Conector",
    quantidade: 1,
    valorUnitario: 30,
    tipo: TipoItemOrcamento.PECA
  }
]

const orcamentoAprovado = {
  id: 17,
  empresaId: 8,
  clienteId: 4,
  numero: 12,
  equipamento: "Notebook",
  descricaoProblema: "Nao liga",
  status: StatusOrcamento.APROVADO,
  versao: 4,
  validade: null,
  total: 50.5,
  formaPagamentoEscolhida: FormaPagamento.CARTAO_DEBITO,
  itens,
  ordem: null
}

beforeEach(() => {
  vi.resetAllMocks()
  prismaMocks.transacao.mockImplementation(
    async (executar: (tx: typeof txMock) => Promise<unknown>) =>
      executar(txMock)
  )
  prismaMocks.listarCobrancasPagas.mockResolvedValue([])
  prismaMocks.buscarCobrancaPaga.mockResolvedValue(null)
  prismaMocks.cancelarCobrancasPendentes.mockResolvedValue({ count: 0 })
  prismaMocks.configuracaoAceitaPix.mockReturnValue(true)
  prismaMocks.atualizarEmpresa.mockResolvedValue({
    proximoNumeroOrcamento: 13,
    proximoNumeroOrdem: 7
  })
})

describe("calculo e criacao de orcamento", () => {
  it("calcula itens, subtotal e total com Decimal", () => {
    const resultado = calcularTotaisOrcamento(itens, 0.5)

    expect(resultado.sucesso).toBe(true)
    if (resultado.sucesso) {
      expect(resultado.itens[0].valorTotal.toString()).toBe("20.5")
      expect(resultado.subtotal.toString()).toBe("50.5")
      expect(resultado.desconto.toString()).toBe("0.5")
      expect(resultado.total.toString()).toBe("50")
    }
  })

  it("recusa desconto acima do subtotal", () => {
    const resultado = calcularTotaisOrcamento(itens, 60)

    expect(resultado).toMatchObject({
      sucesso: false,
      motivo: "desconto_maior_que_subtotal"
    })
  })

  it("recusa produto ou soma que nao cabe em Decimal(12,2)", () => {
    const resultado = calcularTotaisOrcamento(
      [{
        descricao: "Item muito caro",
        quantidade: 2,
        valorUnitario: 9_999_999_999,
        tipo: TipoItemOrcamento.PECA
      }],
      0
    )

    expect(resultado).toMatchObject({
      sucesso: false,
      motivo: "valor_excede_limite",
      campo: "itens.valorTotal"
    })
  })

  it("reserva numero e cria itens e historico na mesma transacao", async () => {
    prismaMocks.buscarCliente.mockResolvedValue({ id: 4 })
    prismaMocks.atualizarEmpresa.mockResolvedValue({
      proximoNumeroOrcamento: 13
    })
    prismaMocks.criarOrcamento.mockResolvedValue({ id: 17 })

    const resultado = await criarOrcamentoService(8, 23, {
      clienteId: 4,
      equipamento: "Notebook",
      descricaoProblema: "Nao liga",
      itens,
      desconto: 0.5
    })

    expect(resultado).toEqual({
      sucesso: true,
      orcamento: { id: 17 }
    })
    const dados = prismaMocks.criarOrcamento.mock.calls[0][0].data
    expect(dados.numero).toBe(12)
    expect(dados.subtotal.toString()).toBe("50.5")
    expect(dados.total.toString()).toBe("50")
    expect(dados.itens.create).toHaveLength(2)
    expect(dados.historico.create).toEqual({
      status: StatusOrcamento.RASCUNHO,
      versaoResultante: 1,
      alteradoPorId: 23
    })
  })
})

describe("concorrencia de status do orcamento", () => {
  it("usa status e versao no CAS e cria um unico historico", async () => {
    const estado = {
      status: StatusOrcamento.RASCUNHO,
      versao: 1
    }

    prismaMocks.buscarOrcamento.mockImplementation(async () => ({
      id: 17,
      empresaId: 8,
      validade: null,
      ...estado
    }))
    prismaMocks.atualizarOrcamento.mockImplementation(
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
    prismaMocks.criarHistoricoOrcamento.mockResolvedValue({ id: 1 })

    const resultados = await Promise.all([
      alterarStatusOrcamentoService(17, 8, 23, {
        statusEsperado: StatusOrcamento.RASCUNHO,
        versaoEsperada: 1,
        status: StatusOrcamento.ENVIADO
      }),
      alterarStatusOrcamentoService(17, 8, 24, {
        statusEsperado: StatusOrcamento.RASCUNHO,
        versaoEsperada: 1,
        status: StatusOrcamento.CANCELADO
      })
    ])

    expect(resultados.filter(resultado => resultado.sucesso)).toHaveLength(1)
    expect(
      resultados.filter(
        resultado =>
          !resultado.sucesso &&
          resultado.motivo === "conflito_atualizacao"
      )
    ).toHaveLength(1)
    expect(prismaMocks.criarHistoricoOrcamento).toHaveBeenCalledTimes(1)
    expect(prismaMocks.atualizarOrcamento).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 17,
          empresaId: 8,
          status: StatusOrcamento.RASCUNHO,
          versao: 1
        }
      })
    )
  })

  it("desfaz o cancelamento quando existe cobranca paga antes da OS", async () => {
    prismaMocks.buscarOrcamento.mockResolvedValue(orcamentoAprovado)
    prismaMocks.cancelarCobrancasPendentes.mockResolvedValue({ count: 1 })
    prismaMocks.buscarCobrancaPaga.mockResolvedValue({ id: 31 })

    const resultado = await alterarStatusOrcamentoService(17, 8, 23, {
      statusEsperado: StatusOrcamento.APROVADO,
      versaoEsperada: 4,
      status: StatusOrcamento.CANCELADO
    })

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "cobranca_paga"
    })
    expect(prismaMocks.cancelarCobrancasPendentes).toHaveBeenCalledWith(
      txMock,
      8,
      { orcamentoId: 17 }
    )
    expect(prismaMocks.buscarCobrancaPaga).toHaveBeenCalledWith({
      where: {
        empresaId: 8,
        orcamentoId: 17,
        status: StatusCobranca.PAGA
      },
      select: { id: true }
    })
    expect(prismaMocks.atualizarOrcamento).not.toHaveBeenCalled()
    expect(prismaMocks.criarHistoricoOrcamento).not.toHaveBeenCalled()
  })
})

describe("transformacao em ordem", () => {
  it("copia dados do orcamento e registra os dois historicos", async () => {
    prismaMocks.buscarOrcamento.mockResolvedValueOnce(orcamentoAprovado)
    prismaMocks.atualizarOrcamento.mockResolvedValue({ count: 1 })
    prismaMocks.criarOrdem.mockResolvedValue({
      id: 91,
      status: StatusOrdem.RECEBIDO
    })
    prismaMocks.criarHistoricoOrcamento.mockResolvedValue({ id: 2 })

    const resultado = await transformarOrcamentoEmOrdemService(
      17,
      8,
      23,
      {
        statusEsperado: StatusOrcamento.APROVADO,
        versaoEsperada: 4
      }
    )

    expect(resultado).toEqual({
      sucesso: true,
      ordem: { id: 91, status: StatusOrdem.RECEBIDO },
      jaExistente: false
    })
    expect(prismaMocks.criarOrdem).toHaveBeenCalledWith({
      data: expect.objectContaining({
        numero: 6,
        empresaId: 8,
        clienteId: 4,
        orcamentoId: 17,
        equipamento: "Notebook",
        problemaRelatado: "Nao liga",
        valor: 50.5,
        formaDePagamento: FormaPagamento.CARTAO_DEBITO,
        status: StatusOrdem.RECEBIDO,
        historico: {
          create: {
            status: StatusOrdem.RECEBIDO,
            mensagemPublica: "Ordem de serviço recebida.",
            alteradoPorId: 23
          }
        }
      }),
      include: expect.any(Object)
    })
    expect(prismaMocks.atualizarEmpresa).toHaveBeenCalledWith({
      where: { id: 8 },
      data: {
        proximoNumeroOrdem: { increment: 1 }
      },
      select: { proximoNumeroOrdem: true }
    })
    expect(prismaMocks.criarHistoricoOrcamento).toHaveBeenCalledWith({
      data: expect.objectContaining({
        statusAnterior: StatusOrcamento.APROVADO,
        status: StatusOrcamento.CONVERTIDO,
        versaoResultante: 5
      })
    })
  })

  it("devolve a ordem existente sem criar outra", async () => {
    const ordem = { id: 91, status: StatusOrdem.RECEBIDO }
    prismaMocks.buscarOrcamento.mockResolvedValueOnce({
      ...orcamentoAprovado,
      status: StatusOrcamento.CONVERTIDO,
      versao: 5,
      ordem
    })

    const resultado = await transformarOrcamentoEmOrdemService(
      17,
      8,
      23,
      {
        statusEsperado: StatusOrcamento.APROVADO,
        versaoEsperada: 4
      }
    )

    expect(resultado).toEqual({
      sucesso: true,
      ordem,
      jaExistente: true
    })
    expect(prismaMocks.atualizarOrcamento).not.toHaveBeenCalled()
    expect(prismaMocks.criarOrdem).not.toHaveBeenCalled()
  })

  it("materializa no ledger a cobranca paga antes da criacao da OS", async () => {
    prismaMocks.buscarOrcamento.mockResolvedValueOnce(orcamentoAprovado)
    prismaMocks.atualizarOrcamento.mockResolvedValue({ count: 1 })
    prismaMocks.criarOrdem.mockResolvedValue({
      id: 91,
      status: StatusOrdem.RECEBIDO
    })
    prismaMocks.listarCobrancasPagas.mockResolvedValue([{ id: 31 }])
    prismaMocks.criarHistoricoOrcamento.mockResolvedValue({ id: 2 })

    await transformarOrcamentoEmOrdemService(17, 8, 23, {
      statusEsperado: StatusOrcamento.APROVADO,
      versaoEsperada: 4
    })

    expect(prismaMocks.listarCobrancasPagas).toHaveBeenCalledWith({
      where: {
        empresaId: 8,
        orcamentoId: 17,
        status: "PAGA"
      },
      select: { id: true }
    })
    expect(prismaMocks.materializarCobranca).toHaveBeenCalledWith(
      txMock,
      31,
      8,
      false
    )
  })
})

describe("aprovacao publica", () => {
  it("exibe somente o resumo publico com cliente e empresa", async () => {
    prismaMocks.configuracaoAceitaPix.mockReturnValue(false)
    prismaMocks.buscarPublico.mockResolvedValue({
      numero: 12,
      formaPagamentoEscolhida: FormaPagamento.NAO_INFORMADA,
      empresa: {
        nome: "Assistencia",
        telefone: null,
        email: null,
        configuracaoPagamento: null
      },
      cliente: { nome: "Cliente" },
      itens: [],
      ordem: null
    })

    const resultado = await buscarOrcamentoPublicoService(
      "12345678-1234-1234-1234-123456789012"
    )

    expect(resultado).toMatchObject({
      formaPagamentoEscolhida: null,
      pixDisponivel: false,
      empresa: {
        nome: "Assistencia",
        telefone: null,
        email: null
      }
    })
    expect(resultado?.empresa).not.toHaveProperty("configuracaoPagamento")
    expect(resultado).not.toHaveProperty("tokenAcompanhamento")
    expect(resultado).not.toHaveProperty("ordem")

    expect(prismaMocks.buscarPublico).toHaveBeenCalledWith({
      where: {
        tokenPublico: "12345678-1234-1234-1234-123456789012"
      },
      select: expect.objectContaining({
        cliente: {
          select: { nome: true }
        },
        empresa: expect.objectContaining({
          select: expect.objectContaining({
            nome: true,
            telefone: true,
            email: true
          })
        }),
        ordem: {
          select: {
            tokenAcompanhamento: true
          }
        }
      })
    })
  })

  it("inclui somente o token de acompanhamento quando já existe OS", async () => {
    prismaMocks.configuracaoAceitaPix.mockReturnValue(false)
    prismaMocks.buscarPublico.mockResolvedValue({
      numero: 12,
      formaPagamentoEscolhida: FormaPagamento.CARTAO_DEBITO,
      empresa: {
        nome: "Assistencia",
        telefone: null,
        email: null,
        configuracaoPagamento: null
      },
      cliente: { nome: "Cliente" },
      itens: [],
      ordem: {
        tokenAcompanhamento: "token-acompanhamento-seguro-123"
      }
    })

    const resultado = await buscarOrcamentoPublicoService(
      "12345678-1234-1234-1234-123456789012"
    )

    expect(resultado).toMatchObject({
      tokenAcompanhamento: "token-acompanhamento-seguro-123"
    })
    expect(resultado).not.toHaveProperty("ordem")
  })

  it("expira atomicamente um orcamento vencido", async () => {
    prismaMocks.buscarOrcamento.mockResolvedValueOnce({
      id: 17,
      empresaId: 8,
      status: StatusOrcamento.ENVIADO,
      versao: 3,
      validade: new Date("2020-01-01T00:00:00.000Z")
    })
    prismaMocks.atualizarOrcamento.mockResolvedValue({ count: 1 })
    prismaMocks.criarHistoricoOrcamento.mockResolvedValue({ id: 3 })

    const resultado = await aprovarOrcamentoPublicoService(
      "12345678-1234-1234-1234-123456789012",
      {
        versaoEsperada: 3,
        formaPagamento: FormaPagamento.DINHEIRO
      }
    )

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "orcamento_expirado",
      statusAtual: StatusOrcamento.EXPIRADO,
      versaoAtual: 4
    })
    expect(prismaMocks.atualizarOrcamento).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusOrcamento.EXPIRADO,
          versao: { increment: 1 }
        })
      })
    )
    expect(prismaMocks.criarHistoricoOrcamento).toHaveBeenCalledOnce()
  })

  it("persiste a forma escolhida no mesmo CAS da aprovacao", async () => {
    const publicoAprovado = {
      numero: 12,
      formaPagamentoEscolhida: FormaPagamento.CARTAO_CREDITO,
      empresa: {
        nome: "Assistencia",
        telefone: null,
        email: null,
        configuracaoPagamento: null
      },
      cliente: { nome: "Cliente" },
      itens: []
    }
    prismaMocks.buscarOrcamento
      .mockResolvedValueOnce({
        id: 17,
        empresaId: 8,
        status: StatusOrcamento.ENVIADO,
        versao: 3,
        validade: null
      })
      .mockResolvedValueOnce(publicoAprovado)
    prismaMocks.atualizarOrcamento.mockResolvedValue({ count: 1 })
    prismaMocks.criarHistoricoOrcamento.mockResolvedValue({ id: 3 })

    const resultado = await aprovarOrcamentoPublicoService(
      "12345678-1234-1234-1234-123456789012",
      {
        versaoEsperada: 3,
        formaPagamento: FormaPagamento.CARTAO_CREDITO
      }
    )

    expect(resultado).toMatchObject({ sucesso: true })
    expect(prismaMocks.atualizarOrcamento).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: StatusOrcamento.ENVIADO,
          versao: 3
        }),
        data: expect.objectContaining({
          status: StatusOrcamento.APROVADO,
          formaPagamentoEscolhida: FormaPagamento.CARTAO_CREDITO,
          versao: { increment: 1 }
        })
      })
    )
  })

  it("recusa Pix indisponivel antes de aprovar", async () => {
    prismaMocks.buscarOrcamento.mockResolvedValueOnce({
      id: 17,
      empresaId: 8,
      status: StatusOrcamento.ENVIADO,
      versao: 3,
      validade: null
    })
    prismaMocks.buscarConfiguracaoPagamento.mockResolvedValue({
      provedor: "MANUAL",
      status: "ATIVA",
      ativo: true,
      pixHabilitado: false
    })
    prismaMocks.configuracaoAceitaPix.mockReturnValue(false)

    const resultado = await aprovarOrcamentoPublicoService(
      "12345678-1234-1234-1234-123456789012",
      {
        versaoEsperada: 3,
        formaPagamento: FormaPagamento.PIX
      }
    )

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "pix_indisponivel"
    })
    expect(prismaMocks.atualizarOrcamento).not.toHaveBeenCalled()
  })
})
