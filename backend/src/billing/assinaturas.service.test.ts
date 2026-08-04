import { readFileSync } from "node:fs"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { env } from "../config/env.js"
import { Prisma } from "../generated/prisma/client.js"
import {
  AmbienteAssinatura,
  ProvedorAssinatura,
  StatusAssinatura,
  StatusEmpresa
} from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  atualizarAssinatura: vi.fn(),
  atualizarEmpresa: vi.fn()
}))

vi.mock("../lib/prisma.js", () => {
  const tx = {
    assinaturaEmpresa: {
      findUnique: prismaMocks.findUnique,
      findUniqueOrThrow: prismaMocks.findUniqueOrThrow,
      updateMany: prismaMocks.atualizarAssinatura
    },
    empresa: {
      updateMany: prismaMocks.atualizarEmpresa
    }
  }

  return {
    prisma: {
      ...tx,
      $transaction: vi.fn(async callback => callback(tx))
    }
  }
})

import {
  confirmarAssinaturaTesteService,
  listarPlanosServixService
} from "./assinaturas.service.js"

const token = "123e4567-e89b-12d3-a456-426614174000"
const pendente = {
  checkoutToken: token,
  planoCodigo: "servix-mensal",
  planoNome: "Plano Servix",
  valorMensal: new Prisma.Decimal("34.90"),
  ambiente: AmbienteAssinatura.TESTE,
  provedor: ProvedorAssinatura.SIMULADO,
  status: StatusAssinatura.PENDENTE,
  ativadaEm: null,
  criadoEm: new Date("2026-07-23T12:00:00.000Z"),
  empresa: {
    id: 8,
    nome: "Oficina Central",
    slug: "oficina-central",
    email: "contato@oficina.com",
    status: StatusEmpresa.PENDENTE_ASSINATURA
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("SERVIX_BILLING_MODE", "TESTE")
  prismaMocks.findUnique.mockResolvedValue(pendente)
  prismaMocks.atualizarAssinatura.mockResolvedValue({ count: 1 })
  prismaMocks.atualizarEmpresa.mockResolvedValue({ count: 1 })
  prismaMocks.findUniqueOrThrow.mockResolvedValue({
    ...pendente,
    status: StatusAssinatura.ATIVA,
    ativadaEm: new Date("2026-07-23T12:05:00.000Z"),
    empresa: { ...pendente.empresa, status: StatusEmpresa.ATIVA }
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("assinaturas do Servix", () => {
  it("mantem plano e preco no servidor", () => {
    const catalogo = listarPlanosServixService()

    expect(catalogo).toMatchObject({
      ambiente: AmbienteAssinatura.TESTE,
      checkoutDisponivel: true,
      versaoTermos: "2026-08-01",
      planos: [{ codigo: "servix-mensal", valorMensal: "34.90" }]
    })
  })

  it("publica PRODUCAO sem liberar checkout antes da confirmacao legal", () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "PRODUCAO")
    vi.stubEnv("SERVIX_LEGAL_IDENTITY_READY", "false")

    expect(listarPlanosServixService()).toMatchObject({
      ambiente: AmbienteAssinatura.PRODUCAO,
      checkoutDisponivel: false
    })
  })

  it("libera o catalogo de PRODUCAO depois da confirmacao legal", () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "PRODUCAO")
    vi.stubEnv("SERVIX_LEGAL_IDENTITY_READY", "true")

    expect(listarPlanosServixService()).toMatchObject({
      ambiente: AmbienteAssinatura.PRODUCAO,
      checkoutDisponivel: true
    })
  })

  it("ativa assinatura simulada e somente depois libera a empresa", async () => {
    const resultado = await confirmarAssinaturaTesteService(token)

    expect(prismaMocks.atualizarAssinatura).toHaveBeenCalledWith({
      where: {
        checkoutToken: token,
        status: StatusAssinatura.PENDENTE,
        ambiente: AmbienteAssinatura.TESTE,
        provedor: ProvedorAssinatura.SIMULADO
      },
      data: {
        status: StatusAssinatura.ATIVA,
        ativadaEm: expect.any(Date)
      }
    })
    expect(prismaMocks.atualizarEmpresa).toHaveBeenCalledWith({
      where: { id: 8, status: StatusEmpresa.PENDENTE_ASSINATURA },
      data: { status: StatusEmpresa.ATIVA }
    })
    expect(resultado).toMatchObject({
      sucesso: true,
      empresa: { status: StatusEmpresa.ATIVA },
      assinatura: { status: StatusAssinatura.ATIVA }
    })
  })

  it("falha fechado em deploy tecnico de producao sem modo explicito", async () => {
    const nodeEnvAnterior = env.nodeEnv
    env.nodeEnv = "production"
    vi.stubEnv("SERVIX_BILLING_MODE", "")

    try {
      const resultado = await confirmarAssinaturaTesteService(token)

      expect(resultado).toEqual({
        sucesso: false,
        motivo: "billing_bloqueado"
      })
      expect(prismaMocks.findUnique).not.toHaveBeenCalled()
    } finally {
      env.nodeEnv = nodeEnvAnterior
    }
  })

  it("nao importa o OAuth nem o gateway dos pagamentos das empresas", () => {
    const fonte = readFileSync(
      new URL("./assinaturas.service.ts", import.meta.url),
      "utf8"
    )

    expect(fonte).not.toMatch(/mercado-pago-oauth|gateway-pagamento\.factory/)
    expect(fonte).not.toMatch(/IntegracaoPagamento|\bCobranca\b|\bPagamento\b/)
  })
})
