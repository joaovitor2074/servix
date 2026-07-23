import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Prisma } from "../generated/prisma/client.js"
import {
  AmbientePagamento,
  ProvedorPagamento,
  StatusCobranca,
  StatusConfiguracaoPagamento,
  StatusOrcamento
} from "../generated/prisma/enums.js"
import { ErroMercadoPagoGateway } from "../gateways/mercado-pago.gateway.js"

const mocks = vi.hoisted(() => ({
  transacao: vi.fn(),
  queryRaw: vi.fn(),
  cobrancaFindUnique: vi.fn(),
  cobrancaFindMany: vi.fn(),
  cobrancaCreate: vi.fn(),
  cobrancaUpdateMany: vi.fn(),
  cobrancaFindUniqueOrThrow: vi.fn(),
  cobrancaFindFirstTx: vi.fn(),
  cobrancaFindFirstPublica: vi.fn(),
  cobrancaCount: vi.fn(),
  orcamentoFindUniquePublico: vi.fn(),
  configuracaoFindUnique: vi.fn(),
  orcamentoFindUnique: vi.fn(),
  orcamentoUpdateMany: vi.fn(),
  pagamentoAggregate: vi.fn(),
  pagamentoCreateMany: vi.fn(),
  pagamentoFindFirst: vi.fn(),
  ordemFindUnique: vi.fn(),
  ordemUpdateMany: vi.fn(),
  gatewayCriar: vi.fn(),
  gatewayConsultar: vi.fn(),
  obterGateway: vi.fn(),
  sequencia: [] as string[]
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    $transaction: mocks.transacao,
    cobranca: {
      updateMany: mocks.cobrancaUpdateMany,
      findUnique: mocks.cobrancaFindUnique,
      findMany: mocks.cobrancaFindMany,
      findUniqueOrThrow: mocks.cobrancaFindUniqueOrThrow,
      findFirst: mocks.cobrancaFindFirstPublica,
      count: mocks.cobrancaCount
    },
    orcamento: {
      findUnique: mocks.orcamentoFindUniquePublico
    }
  }
}))

vi.mock("../gateways/gateway-pagamento.factory.js", () => ({
  obterGatewayPagamento: mocks.obterGateway,
  resolverGatewayPagamento: mocks.obterGateway
}))

import {
  buscarCobrancaService,
  buscarCobrancaPublicaService,
  confirmarCobrancaSimuladaService,
  configuracaoPagamentoAceitaPix,
  criarCobrancaPublicaService,
  criarCobrancaService,
  expirarCobrancasVencidasService,
  listarCobrancasService,
  materializarPagamentoDaCobrancaTx,
  sincronizarCobrancaMercadoPagoService
} from "./cobrancas.service.js"

const tx = {
  $queryRaw: mocks.queryRaw,
  cobranca: {
    findUnique: mocks.cobrancaFindUnique,
    findMany: mocks.cobrancaFindMany,
    create: mocks.cobrancaCreate,
    updateMany: mocks.cobrancaUpdateMany,
    findUniqueOrThrow: mocks.cobrancaFindUniqueOrThrow,
    findFirst: mocks.cobrancaFindFirstTx
  },
  configuracaoPagamento: {
    findUnique: mocks.configuracaoFindUnique
  },
  orcamento: {
    findUnique: mocks.orcamentoFindUnique,
    updateMany: mocks.orcamentoUpdateMany
  },
  pagamento: {
    aggregate: mocks.pagamentoAggregate,
    createMany: mocks.pagamentoCreateMany,
    findFirst: mocks.pagamentoFindFirst
  },
  ordemServico: {
    findUnique: mocks.ordemFindUnique,
    updateMany: mocks.ordemUpdateMany
  }
}

const cobrancaBase = {
  id: 31,
  empresaId: 8,
  ordemId: null,
  orcamentoId: 17,
  provedor: ProvedorPagamento.SIMULADO,
  ambiente: AmbientePagamento.TESTE,
  formaPagamento: "PIX",
  status: StatusCobranca.PENDENTE,
  valor: new Prisma.Decimal("100.00"),
  chaveIdempotencia: "orcamento-17-abc",
  identificadorExterno: null,
  codigoPix: null,
  qrCodeBase64: null,
  expiraEm: null,
  pagaEm: null,
  canceladaEm: null,
  estornadaEm: null,
  criadoEm: new Date("2026-07-22T12:00:00.000Z"),
  atualizadoEm: new Date("2026-07-22T12:00:00.000Z"),
  pagamento: null
}

const orcamentoAprovadoSemOrdem = {
  id: 17,
  status: StatusOrcamento.APROVADO,
  versao: 4,
  ordem: null
}

const orcamentoAprovadoComOrdem = {
  id: 17,
  status: StatusOrcamento.CONVERTIDO,
  versao: 5,
  ordem: {
    id: 22,
    status: "PRONTO"
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sequencia.length = 0
  mocks.cobrancaUpdateMany.mockResolvedValue({ count: 0 })
  mocks.queryRaw.mockResolvedValue([])
  mocks.cobrancaFindFirstTx.mockResolvedValue(null)
  mocks.orcamentoUpdateMany.mockResolvedValue({ count: 1 })
  mocks.ordemFindUnique.mockResolvedValue({
    valor: new Prisma.Decimal("100.00"),
    versao: 1,
    status: "PRONTO"
  })
  mocks.ordemUpdateMany.mockResolvedValue({ count: 1 })
  mocks.pagamentoAggregate.mockResolvedValue({ _sum: { valor: null } })
  mocks.transacao.mockImplementation(async callback => {
    mocks.sequencia.push("transacao-inicio")
    const resultado = await callback(tx)
    mocks.sequencia.push("transacao-fim")
    return resultado
  })
  mocks.obterGateway.mockReturnValue({
    provedor: ProvedorPagamento.SIMULADO,
    criarCobranca: mocks.gatewayCriar,
    consultarCobranca: mocks.gatewayConsultar
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("disponibilidade segura do Pix", () => {
  it("nao anuncia Mercado Pago sem modo financeiro explicito", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("SERVIX_CUSTOMER_PAYMENTS_MP_MODE", "")
    mocks.obterGateway.mockReturnValue(null)

    expect(configuracaoPagamentoAceitaPix({
      provedor: ProvedorPagamento.MERCADO_PAGO,
      ambiente: AmbientePagamento.TESTE,
      status: StatusConfiguracaoPagamento.ATIVA,
      ativo: true,
      pixHabilitado: true
    }, 8)).toBe(false)
  })

  it("anuncia sandbox explicitamente habilitado em producao tecnica", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("SERVIX_CUSTOMER_PAYMENTS_MP_MODE", "TESTE")
    mocks.obterGateway.mockReturnValue(null)

    expect(configuracaoPagamentoAceitaPix({
      provedor: ProvedorPagamento.MERCADO_PAGO,
      ambiente: AmbientePagamento.TESTE,
      status: StatusConfiguracaoPagamento.ATIVA,
      ativo: true,
      pixHabilitado: true
    }, 8)).toBe(true)
  })
})

describe("consulta interna de cobrancas", () => {
  it("isola por empresa, filtra por orcamento e nao seleciona a chave", async () => {
    mocks.cobrancaFindMany.mockResolvedValue([{ ...cobrancaBase }])
    mocks.cobrancaCount.mockResolvedValue(1)

    const resultado = await listarCobrancasService(8, {
      orcamentoId: 17,
      pagina: 1,
      limite: 20
    })

    expect(mocks.cobrancaFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          empresaId: 8,
          orcamentoId: 17
        },
        select: expect.objectContaining({
          chaveIdempotencia: false
        })
      })
    )
    expect(mocks.cobrancaCount).toHaveBeenCalledWith({
      where: {
        empresaId: 8,
        orcamentoId: 17
      }
    })
    expect(resultado.paginacao).toEqual({
      pagina: 1,
      limite: 20,
      total: 1,
      totalPaginas: 1
    })
  })

  it("busca o detalhe apenas pela chave composta da empresa", async () => {
    mocks.cobrancaFindUnique.mockResolvedValue(cobrancaBase)

    await buscarCobrancaService(31, 8)

    expect(mocks.cobrancaFindUnique).toHaveBeenCalledWith({
      where: {
        id_empresaId: { id: 31, empresaId: 8 }
      },
      select: expect.objectContaining({
        chaveIdempotencia: false
      })
    })
  })
})

describe("criacao de cobranca", () => {
  it("calcula o saldo e mantem a conexao bloqueada durante o gateway", async () => {
    mocks.cobrancaFindUnique.mockResolvedValue(null)
    mocks.configuracaoFindUnique.mockResolvedValue({
      provedor: ProvedorPagamento.SIMULADO,
      ambiente: AmbientePagamento.TESTE,
      ativo: true,
      pixHabilitado: true,
      status: StatusConfiguracaoPagamento.ATIVA
    })
    mocks.orcamentoFindUnique.mockResolvedValue({
      id: 17,
      numero: 12,
      total: new Prisma.Decimal("100.00"),
      status: StatusOrcamento.APROVADO,
      versao: 4,
      ordem: null
    })
    mocks.cobrancaFindMany.mockResolvedValue([])
    mocks.cobrancaCreate.mockResolvedValue(cobrancaBase)
    mocks.gatewayCriar.mockImplementation(async () => {
      mocks.sequencia.push("gateway")
      return {
        identificadorExterno: "sim_externo",
        codigoPix: "PIX_SIMULADO|sim_externo|100.00",
        expiraEm: new Date("2026-07-22T13:00:00.000Z")
      }
    })
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 1 })
    mocks.cobrancaFindUniqueOrThrow.mockResolvedValue({
      ...cobrancaBase,
      identificadorExterno: "sim_externo",
      codigoPix: "PIX_SIMULADO|sim_externo|100.00"
    })

    const resultado = await criarCobrancaService(8, {
      orcamentoId: 17,
      chaveIdempotencia: "orcamento-17-abc"
    })

    expect(mocks.sequencia).toEqual([
      "transacao-inicio",
      "transacao-fim",
      "transacao-inicio",
      "gateway",
      "transacao-fim"
    ])
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2)
    expect(mocks.cobrancaCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        empresaId: 8,
        orcamentoId: 17,
        valor: new Prisma.Decimal("100.00"),
        expiraEm: expect.any(Date)
      })
    }))
    expect(mocks.gatewayCriar).toHaveBeenCalledWith(expect.objectContaining({
      empresaId: 8,
      valor: "100.00"
    }))
    expect(resultado).toMatchObject({ sucesso: true, reutilizada: false })
  })

  it("repete a preparacao e converge quando a mesma chave disputa a unicidade", async () => {
    mocks.transacao
      .mockRejectedValueOnce({ code: "P2002" })
      .mockImplementationOnce(async callback => callback(tx))
    mocks.cobrancaFindUnique.mockResolvedValue({
      ...cobrancaBase,
      identificadorExterno: "sim_externo",
      codigoPix: "PIX_SIMULADO|sim_externo|100.00"
    })

    const resultado = await criarCobrancaService(8, {
      orcamentoId: 17,
      chaveIdempotencia: "orcamento-17-abc"
    })

    expect(mocks.transacao).toHaveBeenCalledTimes(2)
    expect(mocks.gatewayCriar).not.toHaveBeenCalled()
    expect(resultado).toMatchObject({
      sucesso: true,
      reutilizada: true,
      cobranca: { id: 31 }
    })
  })

  it("a mesma chave devolve a cobranca expirada sem acionar o gateway", async () => {
    mocks.cobrancaFindUnique.mockResolvedValue({
      ...cobrancaBase,
      status: StatusCobranca.EXPIRADA,
      expiraEm: new Date("2026-07-22T11:00:00.000Z")
    })

    const resultado = await criarCobrancaService(8, {
      orcamentoId: 17,
      chaveIdempotencia: "orcamento-17-abc"
    })

    expect(mocks.gatewayCriar).not.toHaveBeenCalled()
    expect(resultado).toMatchObject({
      sucesso: true,
      reutilizada: true,
      cobranca: {
        id: 31,
        status: StatusCobranca.EXPIRADA
      }
    })
  })

  it("expira pendencias vencidas por CAS antes das leituras", async () => {
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 2 })

    const total = await expirarCobrancasVencidasService(8)

    expect(total).toBe(2)
    expect(mocks.cobrancaUpdateMany).toHaveBeenCalledWith({
      where: {
        empresaId: 8,
        status: StatusCobranca.PENDENTE,
        expiraEm: { lte: expect.any(Date) }
      },
      data: { status: StatusCobranca.EXPIRADA }
    })
  })

  it("uma nova chave pode criar outra cobranca depois da expiracao", async () => {
    mocks.cobrancaFindUnique.mockResolvedValue(null)
    mocks.configuracaoFindUnique.mockResolvedValue({
      provedor: ProvedorPagamento.SIMULADO,
      ambiente: AmbientePagamento.TESTE,
      ativo: true,
      pixHabilitado: true,
      status: StatusConfiguracaoPagamento.ATIVA
    })
    mocks.orcamentoFindUnique.mockResolvedValue({
      id: 17,
      numero: 12,
      total: new Prisma.Decimal("100.00"),
      status: StatusOrcamento.APROVADO,
      versao: 4,
      ordem: null
    })
    mocks.cobrancaFindMany.mockResolvedValue([])
    mocks.cobrancaCreate.mockResolvedValue({
      ...cobrancaBase,
      chaveIdempotencia: "orcamento-17-nova"
    })
    mocks.gatewayCriar.mockResolvedValue({
      identificadorExterno: "sim_novo",
      codigoPix: "PIX_SIMULADO|sim_novo|100.00",
      expiraEm: new Date("2026-07-22T14:00:00.000Z")
    })
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 1 })
    mocks.cobrancaFindUniqueOrThrow.mockResolvedValue({
      ...cobrancaBase,
      chaveIdempotencia: "orcamento-17-nova",
      identificadorExterno: "sim_novo",
      codigoPix: "PIX_SIMULADO|sim_novo|100.00"
    })

    const resultado = await criarCobrancaService(8, {
      orcamentoId: 17,
      chaveIdempotencia: "orcamento-17-nova"
    })

    expect(mocks.cobrancaUpdateMany).toHaveBeenCalledWith({
      where: {
        empresaId: 8,
        orcamentoId: 17,
        status: StatusCobranca.PENDENTE,
        expiraEm: { lte: expect.any(Date) }
      },
      data: { status: StatusCobranca.EXPIRADA }
    })
    expect(resultado).toMatchObject({ sucesso: true, reutilizada: false })
  })

  it("retoma a pendencia original quando o gateway falha antes de responder", async () => {
    const incompleta = {
      ...cobrancaBase,
      chaveIdempotencia: "chave-original-123"
    }
    const completa = {
      ...incompleta,
      identificadorExterno: "sim_recuperado",
      codigoPix: "PIX_SIMULADO|sim_recuperado|100.00",
      expiraEm: new Date("2026-07-22T15:00:00.000Z")
    }
    mocks.cobrancaFindUnique.mockResolvedValue(null)
    mocks.configuracaoFindUnique.mockResolvedValue({
      provedor: ProvedorPagamento.SIMULADO,
      ambiente: AmbientePagamento.TESTE,
      ativo: true,
      pixHabilitado: true,
      status: StatusConfiguracaoPagamento.ATIVA
    })
    mocks.orcamentoFindUnique.mockResolvedValue({
      id: 17,
      numero: 12,
      total: new Prisma.Decimal("100.00"),
      status: StatusOrcamento.APROVADO,
      versao: 4,
      ordem: null
    })
    mocks.cobrancaFindFirstTx
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(incompleta)
    mocks.cobrancaFindMany.mockResolvedValue([])
    mocks.cobrancaCreate.mockResolvedValue(incompleta)
    mocks.gatewayCriar
      .mockRejectedValueOnce(new Error("gateway indisponivel"))
      .mockResolvedValueOnce({
        identificadorExterno: "sim_recuperado",
        codigoPix: "PIX_SIMULADO|sim_recuperado|100.00",
        expiraEm: completa.expiraEm
      })
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 1 })
    mocks.cobrancaFindUniqueOrThrow.mockResolvedValue(completa)

    await expect(criarCobrancaService(8, {
      orcamentoId: 17,
      chaveIdempotencia: "chave-original-123"
    })).rejects.toThrow("gateway indisponivel")

    const recuperada = await criarCobrancaService(8, {
      orcamentoId: 17,
      chaveIdempotencia: "outra-chave-456"
    })

    expect(mocks.cobrancaCreate).toHaveBeenCalledTimes(1)
    expect(mocks.orcamentoUpdateMany).toHaveBeenCalledTimes(1)
    expect(mocks.gatewayCriar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        chaveIdempotencia: "chave-original-123",
        cobrancaLocalId: 31
      })
    )
    expect(recuperada).toMatchObject({
      sucesso: true,
      reutilizada: true,
      cobranca: {
        id: 31,
        codigoPix: completa.codigoPix
      }
    })
  })

  it("serializa uma nova cobranca com a versao da OS", async () => {
    mocks.cobrancaFindUnique.mockResolvedValue(null)
    mocks.configuracaoFindUnique.mockResolvedValue({
      provedor: ProvedorPagamento.SIMULADO,
      ambiente: AmbientePagamento.TESTE,
      ativo: true,
      pixHabilitado: true,
      status: StatusConfiguracaoPagamento.ATIVA
    })
    mocks.orcamentoFindUnique.mockResolvedValue({
      id: 17,
      numero: 12,
      total: new Prisma.Decimal("100.00"),
      status: StatusOrcamento.CONVERTIDO,
      versao: 5,
      ordem: {
        id: 22,
        status: "PRONTO",
        versao: 7
      }
    })
    mocks.pagamentoAggregate.mockResolvedValue({ _sum: { valor: null } })
    mocks.cobrancaFindMany.mockResolvedValue([])
    mocks.cobrancaCreate.mockResolvedValue({ ...cobrancaBase, ordemId: 22 })
    mocks.gatewayCriar.mockResolvedValue({
      identificadorExterno: "sim_os",
      codigoPix: "PIX_SIMULADO|sim_os|100.00",
      expiraEm: new Date("2026-07-22T15:00:00.000Z")
    })
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 1 })
    mocks.cobrancaFindUniqueOrThrow.mockResolvedValue({
      ...cobrancaBase,
      ordemId: 22,
      identificadorExterno: "sim_os",
      codigoPix: "PIX_SIMULADO|sim_os|100.00"
    })

    await criarCobrancaService(8, {
      orcamentoId: 17,
      ordemId: 22,
      chaveIdempotencia: "ordem-22-chave"
    })

    expect(mocks.ordemUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 22,
        empresaId: 8,
        status: "PRONTO",
        versao: 7
      },
      data: { versao: { increment: 1 } }
    })
  })
})

describe("cobranca publica", () => {
  it("consulta por token e retorna somente os campos publicos", async () => {
    mocks.orcamentoFindUniquePublico.mockResolvedValue({
      id: 17,
      empresaId: 8
    })
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 1 })
    mocks.cobrancaFindFirstPublica.mockResolvedValue({
      id: 31,
      status: StatusCobranca.EXPIRADA,
      valor: new Prisma.Decimal("100.00"),
      formaPagamento: "PIX",
      codigoPix: "PIX_PUBLICO",
      expiraEm: new Date("2026-07-22T13:00:00.000Z"),
      pagaEm: null
    })

    const resultado = await buscarCobrancaPublicaService(
      "12345678-1234-1234-1234-123456789012"
    )

    expect(resultado).toEqual({
      encontrado: true,
      cobranca: {
        id: 31,
        status: StatusCobranca.EXPIRADA,
        valor: new Prisma.Decimal("100.00"),
        formaPagamento: "PIX",
        codigoPix: "PIX_PUBLICO",
        expiraEm: new Date("2026-07-22T13:00:00.000Z"),
        pagaEm: null
      }
    })
    expect(resultado.cobranca).not.toHaveProperty("chaveIdempotencia")
    expect(resultado.cobranca).not.toHaveProperty("identificadorExterno")
    expect(resultado.cobranca).not.toHaveProperty("empresaId")
  })

  it("recusa gerar Pix quando a forma escolhida nao e Pix", async () => {
    mocks.orcamentoFindUniquePublico.mockResolvedValue({
      id: 17,
      empresaId: 8,
      formaPagamentoEscolhida: "DINHEIRO"
    })

    const resultado = await criarCobrancaPublicaService(
      "12345678-1234-1234-1234-123456789012",
      "publica-chave-123"
    )

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "forma_pagamento_nao_pix"
    })
    expect(mocks.transacao).not.toHaveBeenCalled()
  })
})

describe("sincronizacao Mercado Pago", () => {
  it("confirma processed/accredited e materializa o ledger uma unica vez", async () => {
    const atualizadaEm = new Date("2026-07-23T11:00:00.000Z")
    const pagaEm = new Date("2026-07-23T12:00:05.000Z")
    mocks.cobrancaFindUnique
      .mockResolvedValueOnce({
        id: 31,
        provedor: ProvedorPagamento.MERCADO_PAGO,
        ambiente: AmbientePagamento.TESTE,
        status: StatusCobranca.PENDENTE,
        identificadorExterno: "ORD_TESTE_123",
        mercadoPagoUserId: "241983636",
        valor: new Prisma.Decimal("100.00"),
        atualizadoEm: atualizadaEm
      })
      .mockResolvedValueOnce({
        id: 31,
        status: StatusCobranca.PAGA,
        valor: new Prisma.Decimal("100.00"),
        pagaEm,
        ordemId: 22,
        pagamento: null,
        orcamento: { ordem: { id: 22 } }
      })
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 1 })
    mocks.gatewayConsultar.mockResolvedValue({
      status: "PAGA",
      mercadoPagoUserId: "241983636",
      pagaEm
    })
    mocks.pagamentoFindFirst.mockResolvedValue({ id: 44 })
    mocks.obterGateway.mockReturnValue({
      provedor: ProvedorPagamento.MERCADO_PAGO,
      criarCobranca: mocks.gatewayCriar,
      consultarCobranca: mocks.gatewayConsultar
    })

    const resultado = await sincronizarCobrancaMercadoPagoService(
      31,
      8
    )

    expect(mocks.gatewayConsultar).toHaveBeenCalledWith(
      "ORD_TESTE_123",
      {
        valor: "100.00",
        referenciaExterna: "servix_8_31"
      }
    )
    expect(mocks.cobrancaUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: StatusCobranca.PAGA,
          pagaEm,
          mercadoPagoUserId: "241983636",
          finalizadaNoGatewayEm: expect.any(Date)
        })
      })
    )
    expect(mocks.pagamentoCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({
          cobrancaId: 31,
          origem: "GATEWAY"
        })],
        skipDuplicates: true
      })
    )
    expect(resultado).toEqual({
      sincronizada: true,
      status: StatusCobranca.PAGA
    })
  })

  it("respeita a janela de sincronizacao sem chamar a rede", async () => {
    mocks.cobrancaFindUnique.mockResolvedValue({
      id: 31,
      provedor: ProvedorPagamento.MERCADO_PAGO,
      ambiente: AmbientePagamento.TESTE,
      status: StatusCobranca.PENDENTE,
      identificadorExterno: "ORD_TESTE_123",
      valor: new Prisma.Decimal("100.00"),
      atualizadoEm: new Date()
    })

    const resultado = await sincronizarCobrancaMercadoPagoService(31, 8)

    expect(resultado).toEqual({ sincronizada: false, motivo: "aguarde" })
    expect(mocks.gatewayConsultar).not.toHaveBeenCalled()
    expect(mocks.cobrancaUpdateMany).not.toHaveBeenCalled()
  })

  it("respeita Retry-After antes de consultar novamente", async () => {
    mocks.cobrancaFindUnique.mockResolvedValue({
      id: 31,
      provedor: ProvedorPagamento.MERCADO_PAGO,
      ambiente: AmbientePagamento.TESTE,
      status: StatusCobranca.PENDENTE,
      identificadorExterno: "ORD_TESTE_123",
      valor: new Prisma.Decimal("100.00"),
      sincronizarApos: null,
      atualizadoEm: new Date("2026-07-23T11:00:00.000Z")
    })
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 1 })
    mocks.gatewayConsultar.mockRejectedValue(
      new ErroMercadoPagoGateway("LIMITE_REQUISICOES", 429, 7000)
    )
    mocks.obterGateway.mockReturnValue({
      provedor: ProvedorPagamento.MERCADO_PAGO,
      criarCobranca: mocks.gatewayCriar,
      consultarCobranca: mocks.gatewayConsultar
    })

    const resultado = await sincronizarCobrancaMercadoPagoService(31, 8)

    expect(resultado).toEqual({
      sincronizada: false,
      motivo: "aguarde_provedor"
    })
    expect(mocks.cobrancaUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          sincronizarApos: expect.any(Date)
        }
      })
    )
  })
})

describe("confirmacao simulada", () => {
  it("nao consulta nem altera cobranca fora da empresa autenticada", async () => {
    mocks.cobrancaFindUnique.mockResolvedValue(null)

    const resultado = await confirmarCobrancaSimuladaService(31, 99)

    expect(mocks.cobrancaFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id_empresaId: { id: 31, empresaId: 99 }
      }
    }))
    expect(mocks.cobrancaUpdateMany).not.toHaveBeenCalled()
    expect(mocks.pagamentoCreateMany).not.toHaveBeenCalled()
    expect(resultado).toEqual({
      sucesso: false,
      motivo: "cobranca_nao_encontrada"
    })
  })

  it("usa CAS e cria uma unica entrada gateway no ledger da OS", async () => {
    const pendente = {
      ...cobrancaBase,
      ordemId: 22,
      orcamento: orcamentoAprovadoComOrdem
    }
    const pagaSemLedger = {
      ...cobrancaBase,
      ordemId: 22,
      status: StatusCobranca.PAGA,
      pagaEm: new Date(),
      pagamento: null,
      orcamento: { ordem: { id: 22 } }
    }
    mocks.cobrancaFindUnique
      .mockResolvedValueOnce(pendente)
      .mockResolvedValueOnce(pagaSemLedger)
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 1 })
    mocks.pagamentoCreateMany.mockResolvedValue({ count: 1 })
    mocks.pagamentoFindFirst.mockResolvedValue({ id: 44 })
    mocks.ordemUpdateMany.mockResolvedValue({ count: 1 })
    mocks.cobrancaFindUniqueOrThrow.mockResolvedValue({
      ...pagaSemLedger,
      pagamento: { id: 44 }
    })

    const resultado = await confirmarCobrancaSimuladaService(31, 8)

    expect(mocks.cobrancaUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 31,
        empresaId: 8,
        status: StatusCobranca.PENDENTE
      }),
      data: expect.objectContaining({
        status: StatusCobranca.PAGA,
        pagaEm: expect.any(Date)
      })
    }))
    expect(mocks.pagamentoCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        empresaId: 8,
        ordemId: 22,
        cobrancaId: 31,
        origem: "GATEWAY"
      })],
      skipDuplicates: true
    }))
    expect(mocks.ordemUpdateMany).toHaveBeenCalledTimes(1)
    expect(resultado).toMatchObject({ sucesso: true, idempotente: false })
  })

  it("concilia somente o saldo restante depois de um pagamento manual", async () => {
    const pendente = {
      ...cobrancaBase,
      ordemId: 22,
      orcamento: orcamentoAprovadoComOrdem
    }
    const pagaSemLedger = {
      ...cobrancaBase,
      ordemId: 22,
      status: StatusCobranca.PAGA,
      pagaEm: new Date(),
      pagamento: null,
      orcamento: orcamentoAprovadoComOrdem
    }
    mocks.cobrancaFindUnique
      .mockResolvedValueOnce(pendente)
      .mockResolvedValueOnce(pagaSemLedger)
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 1 })
    mocks.pagamentoAggregate.mockResolvedValue({
      _sum: { valor: new Prisma.Decimal("40.00") }
    })
    mocks.pagamentoCreateMany.mockResolvedValue({ count: 1 })
    mocks.pagamentoFindFirst.mockResolvedValue({ id: 44 })
    mocks.cobrancaFindUniqueOrThrow.mockResolvedValue(pagaSemLedger)

    const resultado = await confirmarCobrancaSimuladaService(31, 8)

    expect(mocks.pagamentoCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({
          valor: new Prisma.Decimal("60.00"),
          observacao: expect.stringContaining("100.00")
        })]
      })
    )
    expect(resultado).toMatchObject({ sucesso: true })
  })

  it("preserva a cobranca paga sem exceder uma OS ja quitada manualmente", async () => {
    const pagaSemLedger = {
      ...cobrancaBase,
      ordemId: 22,
      status: StatusCobranca.PAGA,
      pagaEm: new Date(),
      pagamento: null,
      orcamento: orcamentoAprovadoComOrdem
    }
    mocks.cobrancaFindUnique.mockResolvedValue(pagaSemLedger)
    mocks.pagamentoAggregate.mockResolvedValue({
      _sum: { valor: new Prisma.Decimal("100.00") }
    })
    mocks.pagamentoFindFirst.mockResolvedValue(null)

    const pagamento = await materializarPagamentoDaCobrancaTx(tx, 31, 8)

    expect(pagamento).toBeNull()
    expect(mocks.pagamentoCreateMany).not.toHaveBeenCalled()
    expect(mocks.ordemUpdateMany).not.toHaveBeenCalled()
  })

  it("expira antes de confirmar quando o vencimento ja passou", async () => {
    const pendenteVencida = {
      ...cobrancaBase,
      expiraEm: new Date("2020-01-01T00:00:00.000Z"),
      orcamento: orcamentoAprovadoSemOrdem
    }
    const expirada = {
      ...pendenteVencida,
      status: StatusCobranca.EXPIRADA
    }
    mocks.cobrancaFindUnique.mockResolvedValue(pendenteVencida)
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 1 })
    mocks.cobrancaFindUniqueOrThrow.mockResolvedValue(expirada)

    const resultado = await confirmarCobrancaSimuladaService(31, 8)

    expect(mocks.cobrancaUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 31,
        empresaId: 8,
        status: StatusCobranca.PENDENTE,
        expiraEm: { lte: expect.any(Date) }
      },
      data: { status: StatusCobranca.EXPIRADA }
    })
    expect(resultado).toEqual({
      sucesso: false,
      motivo: "status_nao_confirmavel",
      statusAtual: StatusCobranca.EXPIRADA
    })
    expect(mocks.pagamentoCreateMany).not.toHaveBeenCalled()
  })

  it("na corrida com expiracao nao responde sucesso para status EXPIRADA", async () => {
    const pendente = {
      ...cobrancaBase,
      expiraEm: new Date("2099-01-01T00:00:00.000Z"),
      orcamento: orcamentoAprovadoSemOrdem
    }
    const expirada = {
      ...pendente,
      status: StatusCobranca.EXPIRADA
    }
    mocks.cobrancaFindUnique.mockResolvedValue(pendente)
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 0 })
    mocks.cobrancaFindUniqueOrThrow.mockResolvedValue(expirada)

    const resultado = await confirmarCobrancaSimuladaService(31, 8)

    expect(resultado).toEqual({
      sucesso: false,
      motivo: "status_nao_confirmavel",
      statusAtual: StatusCobranca.EXPIRADA
    })
    expect(mocks.pagamentoCreateMany).not.toHaveBeenCalled()
  })

  it("na repeticao nao duplica pagamento nem versao da ordem", async () => {
    const paga = {
      ...cobrancaBase,
      ordemId: 22,
      status: StatusCobranca.PAGA,
      pagaEm: new Date(),
      pagamento: { id: 44 },
      orcamento: { ordem: { id: 22 } }
    }
    mocks.cobrancaFindUnique.mockResolvedValue(paga)
    mocks.cobrancaFindUniqueOrThrow.mockResolvedValue(paga)

    const resultado = await confirmarCobrancaSimuladaService(31, 8)

    expect(mocks.pagamentoCreateMany).not.toHaveBeenCalled()
    expect(mocks.ordemUpdateMany).not.toHaveBeenCalled()
    expect(resultado).toMatchObject({ sucesso: true, idempotente: true })
  })

  it("marca como paga antes da OS sem inventar entrada no ledger", async () => {
    const pendente = {
      ...cobrancaBase,
      orcamento: orcamentoAprovadoSemOrdem
    }
    const paga = {
      ...cobrancaBase,
      status: StatusCobranca.PAGA,
      pagaEm: new Date(),
      orcamento: orcamentoAprovadoSemOrdem
    }
    mocks.cobrancaFindUnique
      .mockResolvedValueOnce(pendente)
      .mockResolvedValueOnce(paga)
    mocks.cobrancaUpdateMany.mockResolvedValue({ count: 1 })
    mocks.cobrancaFindUniqueOrThrow.mockResolvedValue(paga)

    const resultado = await confirmarCobrancaSimuladaService(31, 8)

    expect(mocks.pagamentoCreateMany).not.toHaveBeenCalled()
    expect(resultado).toMatchObject({ sucesso: true })
  })
})
