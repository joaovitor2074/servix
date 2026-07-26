import express from "express"
import request from "supertest"
import { describe, expect, it } from "vitest"

import { PapelUsuario } from "../generated/prisma/enums.js"
import financeiroRoutes from "./financeiro.routes.js"

function criarApp(papel: PapelUsuario) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.auth = { usuarioId: 1, empresaId: 1, papel }
    next()
  })
  app.use("/preview/financeiro", financeiroRoutes)
  return app
}

describe("rotas do financeiro preview", () => {
  it("restringe inclusive leituras ao ADMIN", async () => {
    const resposta = await request(criarApp(PapelUsuario.ATENDENTE))
      .get("/preview/financeiro/dashboard")

    expect(resposta.status).toBe(403)
  })

  it("bloqueia mutação sem confirmação explícita", async () => {
    const resposta = await request(criarApp(PapelUsuario.ADMIN))
      .post("/preview/financeiro/categorias")
      .send({ nome: "Receitas", tipo: "RECEITA" })

    expect(resposta.status).toBe(428)
    expect(resposta.body.codigo).toBe("FINANCEIRO_PREVIEW_CONFIRMACAO_OBRIGATORIA")
  })

  it("exige idempotência depois da confirmação da preview", async () => {
    const resposta = await request(criarApp(PapelUsuario.ADMIN))
      .post("/preview/financeiro/categorias")
      .set("X-Servix-Preview-Confirmation", "FINANCEIRO_PREVIEW")
      .send({ nome: "R", tipo: "RECEITA", empresaId: 999 })

    expect(resposta.status).toBe(400)
    expect(resposta.body.codigo).toBe("FINANCEIRO_IDEMPOTENCY_KEY_OBRIGATORIA")
  })
})
