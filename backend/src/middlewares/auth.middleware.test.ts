import type { NextFunction, Request, Response } from "express"
import jsonwebtoken from "jsonwebtoken"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  PapelUsuario,
  StatusEmpresa
} from "../generated/prisma/enums.js"

const prismaMock = vi.hoisted(() => ({
  findUnique: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    usuario: {
      findUnique: prismaMock.findUnique
    }
  }
}))

import { autenticar } from "./auth.middleware.js"

const JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres"

function criarToken() {
  return jsonwebtoken.sign({}, JWT_SECRET, {
    subject: "7",
    expiresIn: "1h",
    issuer: "servix",
    audience: "servix-api"
  })
}

function requisicaoAutenticada(): Request {
  return {
    headers: {
      authorization: `Bearer ${criarToken()}`
    }
  } as Request
}

function respostaMock() {
  const res = {
    status: vi.fn(),
    json: vi.fn()
  }
  res.status.mockReturnValue(res)
  res.json.mockReturnValue(res)
  return res as unknown as Response
}

function usuario(statusEmpresa: StatusEmpresa) {
  return {
    id: 7,
    empresaId: 11,
    papel: PapelUsuario.ADMIN,
    ativo: true,
    empresa: {
      status: statusEmpresa
    }
  }
}

beforeEach(() => {
  process.env.JWT_SECRET = JWT_SECRET
  prismaMock.findUnique.mockReset()
})

describe("autenticação por situação da empresa", () => {
  it("libera o token quando usuário e empresa continuam ativos", async () => {
    prismaMock.findUnique.mockResolvedValueOnce(usuario(StatusEmpresa.ATIVA))
    const req = requisicaoAutenticada()
    const res = respostaMock()
    const next = vi.fn() as NextFunction

    await autenticar(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.auth).toEqual({
      usuarioId: 7,
      empresaId: 11,
      papel: PapelUsuario.ADMIN
    })
    expect(res.status).not.toHaveBeenCalled()
  })

  it("bloqueia imediatamente uma sessão emitida antes da suspensão", async () => {
    prismaMock.findUnique.mockResolvedValueOnce(usuario(StatusEmpresa.SUSPENSA))
    const res = respostaMock()
    const next = vi.fn() as NextFunction

    await autenticar(requisicaoAutenticada(), res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      erro: "Acesso suspenso porque a assinatura da empresa não está ativa.",
      codigo: "EMPRESA_SUSPENSA",
      detalhes: {
        statusEmpresa: StatusEmpresa.SUSPENSA
      }
    })
    expect(next).not.toHaveBeenCalled()
  })

  it("também bloqueia empresa que voltou a aguardar assinatura", async () => {
    prismaMock.findUnique.mockResolvedValueOnce(
      usuario(StatusEmpresa.PENDENTE_ASSINATURA)
    )
    const res = respostaMock()
    const next = vi.fn() as NextFunction

    await autenticar(requisicaoAutenticada(), res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })
})
