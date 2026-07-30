import { beforeEach, describe, expect, it, vi } from "vitest"

import { PapelUsuario } from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  hash: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
  transaction: vi.fn()
}))

vi.mock("bcryptjs", () => ({ hash: mocks.hash }))
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    usuario: {
      create: mocks.create,
      findFirst: mocks.findFirst,
      update: mocks.update,
      count: mocks.count
    },
    $transaction: mocks.transaction
  }
}))

import {
  atualizarUsuarioService,
  criarUsuarioService,
  redefinirSenhaUsuarioService
} from "./usuario.service.js"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hash.mockResolvedValue("hash-seguro")
  mocks.transaction.mockImplementation(async (operacao: unknown) => {
    if (typeof operacao !== "function") return operacao
    return operacao({
      usuario: {
        findFirst: mocks.findFirst,
        update: mocks.update,
        count: mocks.count
      }
    })
  })
})

describe("gerenciamento administrativo de usuários", () => {
  it("cria usuário da empresa sem devolver o hash da senha", async () => {
    mocks.create.mockResolvedValue({
      id: 22,
      nome: "Técnico",
      email: "tecnico@empresa.com",
      telefone: null,
      papel: PapelUsuario.TECNICO,
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    })

    const resultado = await criarUsuarioService(7, {
      nome: "Técnico",
      email: "tecnico@empresa.com",
      telefone: null,
      papel: PapelUsuario.TECNICO,
      senha: "senha-segura"
    })

    expect(resultado.sucesso).toBe(true)
    expect(mocks.hash).toHaveBeenCalledWith("senha-segura", 12)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ empresaId: 7, senhaHash: "hash-seguro" })
    }))
    if (resultado.sucesso) expect(resultado.usuario).not.toHaveProperty("senhaHash")
  })

  it("impede que o administrador remova o próprio papel", async () => {
    mocks.findFirst.mockResolvedValue({ papel: PapelUsuario.ADMIN, ativo: true })

    const resultado = await atualizarUsuarioService(
      10,
      { papel: PapelUsuario.ATENDENTE },
      7,
      10
    )

    expect(resultado).toEqual({ sucesso: false, motivo: "propria_conta" })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("redefine a senha somente após localizar o usuário na empresa", async () => {
    mocks.findFirst.mockResolvedValue({ id: 22 })
    mocks.update.mockResolvedValue({ id: 22 })

    const resultado = await redefinirSenhaUsuarioService(
      22,
      7,
      { senha: "nova-senha-segura" }
    )

    expect(resultado.sucesso).toBe(true)
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: 22, empresaId: 7 },
      select: { id: true }
    })
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 22, empresaId: 7 },
      data: { senhaHash: "hash-seguro" }
    }))
  })
})
