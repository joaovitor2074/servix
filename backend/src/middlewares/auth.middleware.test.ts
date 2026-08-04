import type { NextFunction, Request, Response } from "express"
import jsonwebtoken from "jsonwebtoken"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  PapelUsuario,
  StatusEmpresa
} from "../generated/prisma/enums.js"

const prismaMock = vi.hoisted(() => ({
  findUnique: vi.fn(),
  sincronizarAcesso: vi.fn()
}))
vi.mock("../services/acesso-empresa.service.js", () => ({
  sincronizarAcessoEmpresaService: prismaMock.sincronizarAcesso
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    usuario: {
      findUnique: prismaMock.findUnique
    }
  }
}))

import {
  autenticar,
  autenticarRecuperacaoAssinatura
} from "./auth.middleware.js"

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

function usuario(
  statusEmpresa: StatusEmpresa,
  papel = PapelUsuario.ADMIN
) {
  return {
    id: 7,
    empresaId: 11,
    papel,
    ativo: true,
    empresa: {
      status: statusEmpresa
    }
  }
}

beforeEach(() => {
  process.env.JWT_SECRET = JWT_SECRET
  prismaMock.findUnique.mockReset()
  prismaMock.sincronizarAcesso.mockReset()
})

function acesso(statusEmpresa: StatusEmpresa) {
  return {
    statusEmpresa,
    acesso: {
      tipo: statusEmpresa === StatusEmpresa.ATIVA
        ? "LIBERADO_MANUALMENTE"
        : "BLOQUEADO",
      ativo: statusEmpresa === StatusEmpresa.ATIVA,
      diasRestantes: statusEmpresa === StatusEmpresa.ATIVA ? null : 0,
      expiraEm: null
    }
  }
}

describe("autenticação por situação da empresa", () => {
  it("libera o token quando usuário e empresa continuam ativos", async () => {
    prismaMock.findUnique.mockResolvedValueOnce(usuario(StatusEmpresa.ATIVA))
    prismaMock.sincronizarAcesso.mockResolvedValueOnce(acesso(StatusEmpresa.ATIVA))
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
    prismaMock.sincronizarAcesso.mockResolvedValueOnce(acesso(StatusEmpresa.SUSPENSA))
    const res = respostaMock()
    const next = vi.fn() as NextFunction

    await autenticar(requisicaoAutenticada(), res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      erro: "Acesso suspenso porque a assinatura da empresa não está ativa.",
      codigo: "EMPRESA_SUSPENSA",
      detalhes: expect.objectContaining({
        statusEmpresa: StatusEmpresa.SUSPENSA
      })
    }))
    expect(next).not.toHaveBeenCalled()
  })

  it("também bloqueia empresa que voltou a aguardar assinatura", async () => {
    prismaMock.findUnique.mockResolvedValueOnce(
      usuario(StatusEmpresa.PENDENTE_ASSINATURA)
    )
    prismaMock.sincronizarAcesso.mockResolvedValueOnce(
      acesso(StatusEmpresa.PENDENTE_ASSINATURA)
    )
    const res = respostaMock()
    const next = vi.fn() as NextFunction

    await autenticar(requisicaoAutenticada(), res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it("permite somente ao admin suspenso acessar a recuperacao", async () => {
    prismaMock.findUnique.mockResolvedValueOnce(usuario(StatusEmpresa.SUSPENSA))
    prismaMock.sincronizarAcesso.mockResolvedValueOnce(acesso(StatusEmpresa.SUSPENSA))
    const req = requisicaoAutenticada()
    const res = respostaMock()
    const next = vi.fn() as NextFunction

    await autenticarRecuperacaoAssinatura(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(req.auth.papel).toBe(PapelUsuario.ADMIN)
  })

  it("nega recuperacao a usuario suspenso que nao e admin", async () => {
    prismaMock.findUnique.mockResolvedValueOnce(
      usuario(StatusEmpresa.SUSPENSA, PapelUsuario.ATENDENTE)
    )
    prismaMock.sincronizarAcesso.mockResolvedValueOnce(acesso(StatusEmpresa.SUSPENSA))
    const res = respostaMock()
    const next = vi.fn() as NextFunction

    await autenticarRecuperacaoAssinatura(requisicaoAutenticada(), res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      codigo: "RECUPERACAO_ASSINATURA_NAO_AUTORIZADA"
    }))
    expect(next).not.toHaveBeenCalled()
  })
})
