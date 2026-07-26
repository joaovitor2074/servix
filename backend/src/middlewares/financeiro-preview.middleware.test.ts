import type { NextFunction, Request, Response } from "express"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  exigirFinanceiroPreviewHabilitado,
  protegerMutacaoFinanceiroPreview
} from "./financeiro-preview.middleware.js"

function respostaMock() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn()
  }
  res.status.mockReturnValue(res)
  res.json.mockReturnValue(res)
  return res as unknown as Response
}

afterEach(() => {
  delete process.env.SERVIX_FINANCEIRO_MODE
  vi.restoreAllMocks()
})
describe("barreira do financeiro preview", () => {
  it("fica fail-closed quando a chave do servidor não está habilitada", () => {
    const next = vi.fn() as NextFunction
    const res = respostaMock()

    exigirFinanceiroPreviewHabilitado({} as Request, res, next)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(next).not.toHaveBeenCalled()
  })

  it("aceita exclusivamente o modo PREVIEW", () => {
    process.env.SERVIX_FINANCEIRO_MODE = "preview"
    const next = vi.fn() as NextFunction

    exigirFinanceiroPreviewHabilitado(
      {} as Request,
      respostaMock(),
      next
    )

    expect(next).toHaveBeenCalledOnce()
  })

  it("GET permanece read-only e não exige confirmação de mutação", () => {
    const req = { method: "GET" } as Request
    const res = respostaMock()
    const next = vi.fn() as NextFunction

    protegerMutacaoFinanceiroPreview(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store")
  })

  it("bloqueia POST sem o header explícito da preview", () => {
    const req = {
      method: "POST",
      get: vi.fn().mockReturnValue(undefined)
    } as unknown as Request
    const res = respostaMock()
    const next = vi.fn() as NextFunction

    protegerMutacaoFinanceiroPreview(req, res, next)

    expect(res.status).toHaveBeenCalledWith(428)
    expect(next).not.toHaveBeenCalled()
  })

  it("libera POST somente com o valor exato do header", () => {
    const req = {
      method: "POST",
      get: vi.fn().mockReturnValue("FINANCEIRO_PREVIEW")
    } as unknown as Request
    const next = vi.fn() as NextFunction

    protegerMutacaoFinanceiroPreview(req, respostaMock(), next)

    expect(next).toHaveBeenCalledOnce()
  })
})
