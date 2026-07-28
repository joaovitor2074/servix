import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Prisma } from "../generated/prisma/client.js"
import {
  AmbienteAssinatura,
  ProvedorAssinatura,
  StatusAssinatura,
  StatusEmpresa
} from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  criarEmpresa: vi.fn(),
  hash: vi.fn()
}))

vi.mock("bcryptjs", () => ({ hash: mocks.hash }))
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    empresa: { create: mocks.criarEmpresa }
  }
}))

import { criarEmpresaService } from "./empresa.service.js"

const dados = {
  nome: "Oficina Central",
  slug: "oficina-central",
  telefone: "11999990000",
  email: "contato@oficina.com",
  tipoNegocio: "Assistencia tecnica",
  cpfCnpj: "12345678000195",
  cidade: "Sao Paulo",
  estado: "SP",
  endereco: "Rua Central, 100",
  planoCodigo: "servix-mensal" as const,
  aceitouTermos: true,
  administrador: {
    nome: "Ana Silva",
    email: "ana@oficina.com",
    telefone: "11988880000",
    senha: "senha-segura"
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("SERVIX_BILLING_MODE", "TESTE")
  mocks.hash.mockResolvedValue("hash-seguro")
  mocks.criarEmpresa.mockResolvedValue({
    id: 8,
    nome: dados.nome,
    slug: dados.slug,
    email: dados.email,
    assinatura: {
      checkoutToken: "123e4567-e89b-12d3-a456-426614174000",
      planoCodigo: "servix-mensal",
      planoNome: "Plano Servix",
      valorMensal: new Prisma.Decimal("79.90"),
      ambiente: AmbienteAssinatura.TESTE,
      status: StatusAssinatura.PENDENTE
    }
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("criacao publica da empresa", () => {
  it("usa preco do servidor e cria assinatura isolada em teste", async () => {
    const resultado = await criarEmpresaService(dados)

    expect(mocks.criarEmpresa).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: StatusEmpresa.PENDENTE_ASSINATURA,
        assinatura: {
          create: expect.objectContaining({
            planoCodigo: "servix-mensal",
            valorMensal: "79.90",
            ambiente: AmbienteAssinatura.TESTE,
            provedor: ProvedorAssinatura.SIMULADO,
            status: StatusAssinatura.PENDENTE
          })
        },
        configuracaoPagamento: { create: {} }
      })
    }))
    expect(resultado).toMatchObject({
      empresa: { id: 8, slug: "oficina-central" },
      assinatura: {
        valorMensal: "79.90",
        status: StatusAssinatura.PENDENTE
      }
    })
  })

  it("cria a assinatura inicial no Mercado Pago em producao", async () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "PRODUCAO")
    vi.stubEnv("SERVIX_LEGAL_IDENTITY_READY", "true")
    mocks.criarEmpresa.mockResolvedValueOnce({
      id: 8,
      nome: dados.nome,
      slug: dados.slug,
      email: dados.email,
      assinatura: {
        checkoutToken: "123e4567-e89b-12d3-a456-426614174000",
        planoCodigo: "servix-mensal",
        planoNome: "Plano Servix",
        valorMensal: new Prisma.Decimal("79.90"),
        ambiente: AmbienteAssinatura.PRODUCAO,
        status: StatusAssinatura.PENDENTE
      }
    })

    const resultado = await criarEmpresaService(dados)

    expect(mocks.criarEmpresa).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        assinatura: {
          create: expect.objectContaining({
            ambiente: AmbienteAssinatura.PRODUCAO,
            provedor: ProvedorAssinatura.MERCADO_PAGO_SERVIX,
            status: StatusAssinatura.PENDENTE
          })
        }
      })
    }))
    expect(resultado.assinatura.ambiente).toBe(AmbienteAssinatura.PRODUCAO)
  })

  it("nao cria empresa em producao enquanto a identidade legal estiver pendente", async () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "PRODUCAO")
    vi.stubEnv("SERVIX_LEGAL_IDENTITY_READY", "false")

    await expect(criarEmpresaService(dados)).rejects.toMatchObject({
      statusCode: 503,
      codigo: "IDENTIDADE_LEGAL_NAO_CONFIGURADA"
    })
    expect(mocks.hash).not.toHaveBeenCalled()
    expect(mocks.criarEmpresa).not.toHaveBeenCalled()
  })

  it("falha sem gravar quando o billing esta bloqueado", async () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "BLOQUEADO")

    await expect(criarEmpresaService(dados)).rejects.toMatchObject({
      statusCode: 503,
      codigo: "ASSINATURAS_NAO_CONFIGURADAS"
    })
    expect(mocks.hash).not.toHaveBeenCalled()
    expect(mocks.criarEmpresa).not.toHaveBeenCalled()
  })
})
