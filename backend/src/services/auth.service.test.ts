import { beforeEach, describe, expect, it, vi } from "vitest"

import { StatusEmpresa } from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  sincronizarAcesso: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    usuario: { findFirst: mocks.findFirst }
  }
}))
vi.mock("./acesso-empresa.service.js", () => ({
  sincronizarAcessoEmpresaService: mocks.sincronizarAcesso
}))

import {
  autenticarUsuarioService,
  buscarUsuarioAutenticadoService
} from "./auth.service.js"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findFirst.mockResolvedValue(null)
  mocks.sincronizarAcesso.mockResolvedValue({
    statusEmpresa: StatusEmpresa.ATIVA,
    acesso: {
      tipo: "TESTE_GRATUITO",
      ativo: true,
      diasRestantes: 5,
      expiraEm: new Date("2026-08-05T12:00:00.000Z")
    }
  })
})

describe("bloqueio de acesso por assinatura", () => {
  it("busca a empresa sem esconder o status para permitir recuperacao do admin", async () => {
    await autenticarUsuarioService({
      empresaSlug: "oficina-central",
      email: "admin@oficina.com",
      senha: "senha-segura"
    })

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        empresa: {
          slug: "oficina-central"
        }
      })
    }))
  })

  it("recarrega o status da empresa em sessoes existentes", async () => {
    mocks.findFirst.mockResolvedValueOnce({
      id: 3,
      nome: "Ana",
      email: "ana@oficina.com",
      papel: "ADMIN",
      empresa: {
        id: 8,
        nome: "Oficina",
        slug: "oficina-central",
        status: StatusEmpresa.ATIVA
      }
    })
    await buscarUsuarioAutenticadoService(3, 8)

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 3,
        empresaId: 8
      })
    }))
    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        empresa: { select: expect.objectContaining({ status: true }) }
      })
    }))
    expect(mocks.sincronizarAcesso).toHaveBeenCalledWith(8)
  })
})
