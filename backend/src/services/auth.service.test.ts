import { beforeEach, describe, expect, it, vi } from "vitest"

import { StatusEmpresa } from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    usuario: { findFirst: mocks.findFirst }
  }
}))

import {
  autenticarUsuarioService,
  buscarUsuarioAutenticadoService
} from "./auth.service.js"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findFirst.mockResolvedValue(null)
})

describe("bloqueio de acesso por assinatura", () => {
  it("nao autentica empresa que ainda nao foi ativada", async () => {
    await autenticarUsuarioService({
      empresaSlug: "oficina-central",
      email: "admin@oficina.com",
      senha: "senha-segura"
    })

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        empresa: {
          slug: "oficina-central",
          status: StatusEmpresa.ATIVA
        }
      })
    }))
  })

  it("revalida o status da empresa em sessoes existentes", async () => {
    await buscarUsuarioAutenticadoService(3, 8)

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: 3,
        empresaId: 8,
        empresa: { status: StatusEmpresa.ATIVA }
      })
    }))
  })
})
