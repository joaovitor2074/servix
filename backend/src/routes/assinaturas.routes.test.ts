import express from "express"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PapelUsuario } from "../generated/prisma/enums.js"

const controllerMocks = vi.hoisted(() => ({
  listarPlanos: vi.fn((_req, res) => res.status(200).json({ planos: [] })),
  webhook: vi.fn((_req, res) => res.sendStatus(200)),
  buscarCheckout: vi.fn((_req, res) => res.status(200).json({})),
  confirmarCheckout: vi.fn((_req, res) => res.status(201).json({})),
  sincronizarCheckout: vi.fn((_req, res) => res.status(200).json({})),
  buscarAtual: vi.fn((_req, res) => res.status(200).json({ assinatura: {} })),
  buscarPainel: vi.fn((_req, res) => res.status(200).json({ assinatura: {} })),
  buscarPortal: vi.fn((_req, res) => res.status(200).json({ assinatura: {} })),
  reativar: vi.fn((_req, res) => res.status(201).json({ checkoutUrl: "https://example.com" })),
  reprocessar: vi.fn((_req, res) => res.status(200).json({ processado: true })),
  sincronizar: vi.fn((_req, res) => res.status(200).json({ assinatura: {} })),
  cancelar: vi.fn((_req, res) => res.status(200).json({ assinatura: {} })),
  iniciar: vi.fn((_req, res) => res.status(201).json({ assinatura: {} }))
}))

vi.mock("../controllers/assinaturas.controllers.js", () => ({
  listarPlanosAssinaturaController: controllerMocks.listarPlanos,
  webhookAssinaturasMercadoPagoController: controllerMocks.webhook,
  buscarCheckoutAssinaturaController: controllerMocks.buscarCheckout,
  confirmarCheckoutAssinaturaController: controllerMocks.confirmarCheckout,
  sincronizarCheckoutAssinaturaController: controllerMocks.sincronizarCheckout,
  buscarAssinaturaAtualController: controllerMocks.buscarAtual,
  buscarPainelAssinaturaController: controllerMocks.buscarPainel,
  buscarPortalAssinaturaController: controllerMocks.buscarPortal,
  reativarAssinaturaController: controllerMocks.reativar,
  reprocessarWebhookAssinaturaController: controllerMocks.reprocessar,
  sincronizarAssinaturaController: controllerMocks.sincronizar,
  cancelarAssinaturaController: controllerMocks.cancelar,
  iniciarAssinaturaController: controllerMocks.iniciar
}))

vi.mock("../middlewares/auth.middleware.js", () => ({
  autenticar: (req, _res, next) => {
    req.auth = {
      usuarioId: 3,
      empresaId: 8,
      papel: req.header("x-test-role") === "ADMIN"
        ? PapelUsuario.ADMIN
        : PapelUsuario.ATENDENTE
    }
    next()
  },
  autenticarRecuperacaoAssinatura: (req, _res, next) => {
    req.auth = {
      usuarioId: 3,
      empresaId: 8,
      papel: PapelUsuario.ADMIN
    }
    next()
  },
  autorizar: (...papeisPermitidos: PapelUsuario[]) =>
    (req, res, next) => {
      if (!papeisPermitidos.includes(req.auth.papel)) {
        return res.status(403).json({ erro: "Sem permissao" })
      }
      return next()
    }
}))

import { assinaturasRoutes } from "./assinaturas.routes.js"

function criarApp() {
  const app = express()
  app.use(express.json())
  app.use("/assinaturas", assinaturasRoutes)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("rotas internas de assinaturas", () => {
  it("permite ao administrador sincronizar e cancelar a propria assinatura", async () => {
    const app = criarApp()

    const sincronizacao = await request(app)
      .post("/assinaturas/sincronizar")
      .set("x-test-role", "ADMIN")
    const cancelamento = await request(app)
      .post("/assinaturas/cancelar")
      .set("x-test-role", "ADMIN")

    expect(sincronizacao.status).toBe(200)
    expect(cancelamento.status).toBe(200)
    expect(controllerMocks.sincronizar).toHaveBeenCalledOnce()
    expect(controllerMocks.cancelar).toHaveBeenCalledOnce()
  })

  it("bloqueia o cancelamento para usuario sem papel de administrador", async () => {
    const app = criarApp()

    const resposta = await request(app).post("/assinaturas/cancelar")

    expect(resposta.status).toBe(403)
    expect(controllerMocks.cancelar).not.toHaveBeenCalled()
  })
})
