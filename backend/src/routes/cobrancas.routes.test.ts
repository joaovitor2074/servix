import express from "express"
import request from "supertest"
import { describe, expect, it, vi } from "vitest"

import { PapelUsuario } from "../generated/prisma/enums.js"

const controllerMocks = vi.hoisted(() => ({
  listar: vi.fn((_req, res) => res.status(200).json({ cobrancas: [] })),
  buscar: vi.fn((_req, res) => res.status(200).json({ id: 1 })),
  criar: vi.fn((_req, res) => res.status(201).json({ id: 1 })),
  confirmar: vi.fn((_req, res) => res.status(200).json({ id: 1 })),
  permitirSimulacao: vi.fn((_req, _res, next) => next())
}))

vi.mock("../controllers/cobrancas.controllers.js", () => ({
  listarCobrancasController: controllerMocks.listar,
  buscarCobrancaController: controllerMocks.buscar,
  criarCobrancaController: controllerMocks.criar,
  confirmarCobrancaSimuladaController: controllerMocks.confirmar,
  permitirSimulacaoForaDeProducao: controllerMocks.permitirSimulacao
}))

import cobrancasRoutes from "./cobrancas.routes.js"

function criarApp(papel: PapelUsuario) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.auth = {
      usuarioId: 3,
      empresaId: 8,
      papel
    }
    next()
  })
  app.use("/cobrancas", cobrancasRoutes)
  return app
}

describe("rotas internas de cobrancas", () => {
  it("permite leitura para funcionario autenticado", async () => {
    const app = criarApp(PapelUsuario.TECNICO)

    const lista = await request(app).get("/cobrancas?orcamentoId=17")
    const detalhe = await request(app).get("/cobrancas/31")

    expect(lista.status).toBe(200)
    expect(detalhe.status).toBe(200)
    expect(controllerMocks.listar).toHaveBeenCalled()
    expect(controllerMocks.buscar).toHaveBeenCalled()
  })

  it("mantem criacao e simulacao exclusivas do administrador", async () => {
    const app = criarApp(PapelUsuario.ATENDENTE)

    const criacao = await request(app).post("/cobrancas").send({})
    const simulacao = await request(app)
      .post("/cobrancas/31/simular-confirmacao")
      .send({})

    expect(criacao.status).toBe(403)
    expect(simulacao.status).toBe(403)
    expect(controllerMocks.criar).not.toHaveBeenCalled()
    expect(controllerMocks.confirmar).not.toHaveBeenCalled()
  })
})
