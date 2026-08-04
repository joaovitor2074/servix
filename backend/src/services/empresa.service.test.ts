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
      valorMensal: new Prisma.Decimal("24.90"),
      ambiente: AmbienteAssinatura.TESTE,
      status: StatusAssinatura.PENDENTE,
      testeGratisIniciadoEm: new Date("2026-07-31T12:00:00.000Z"),
      testeGratisExpiraEm: new Date("2026-08-05T12:00:00.000Z")
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
        status: StatusEmpresa.ATIVA,
        assinatura: {
          create: expect.objectContaining({
            planoCodigo: "servix-mensal",
            valorMensal: "24.90",
            ambiente: AmbienteAssinatura.TESTE,
            provedor: ProvedorAssinatura.SIMULADO,
            status: StatusAssinatura.PENDENTE,
            emailPagador: dados.administrador.email,
            testeGratisIniciadoEm: expect.any(Date),
            testeGratisExpiraEm: expect.any(Date)
          })
        },
        configuracaoPagamento: { create: {} }
      })
    }))
    expect(resultado).toMatchObject({
      empresa: { id: 8, slug: "oficina-central" },
      assinatura: {
        valorMensal: "24.90",
        status: StatusAssinatura.PENDENTE
      },
      acesso: {
        tipo: "TESTE_GRATUITO",
        ativo: true,
        diasRestantes: 5
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
        valorMensal: new Prisma.Decimal("24.90"),
        ambiente: AmbienteAssinatura.PRODUCAO,
        status: StatusAssinatura.PENDENTE,
        testeGratisIniciadoEm: new Date("2026-07-31T12:00:00.000Z"),
        testeGratisExpiraEm: new Date("2026-08-05T12:00:00.000Z")
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

  it("permite iniciar o teste mesmo com a identidade legal de producao pendente", async () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "PRODUCAO")
    vi.stubEnv("SERVIX_LEGAL_IDENTITY_READY", "false")

    await expect(criarEmpresaService(dados)).resolves.toMatchObject({
      acesso: { tipo: "TESTE_GRATUITO", diasRestantes: 5 }
    })
    expect(mocks.criarEmpresa).toHaveBeenCalledOnce()
  })

  it("permite iniciar o teste mesmo quando o billing esta bloqueado", async () => {
    vi.stubEnv("SERVIX_BILLING_MODE", "BLOQUEADO")

    await expect(criarEmpresaService(dados)).resolves.toMatchObject({
      acesso: { tipo: "TESTE_GRATUITO", diasRestantes: 5 }
    })
    expect(mocks.criarEmpresa).toHaveBeenCalledOnce()
  })
})
