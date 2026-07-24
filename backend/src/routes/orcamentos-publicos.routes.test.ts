import express from "express"
import request from "supertest"
import { describe, expect, it } from "vitest"

import router from "./orcamentos-publicos.routes.js"

describe("limite da geracao publica de cobranca", () => {
  it("limita somente o POST de geracao e preserva a consulta", async () => {
    const app = express()
    app.use(express.json())
    app.use("/publico/orcamentos", router)

    for (let tentativa = 0; tentativa < 8; tentativa += 1) {
      const resposta = await request(app)
        .post("/publico/orcamentos/token-invalido/cobrancas")
        .set("Idempotency-Key", `tentativa-${tentativa}`)

      expect(resposta.status).toBe(400)
    }

    const bloqueada = await request(app)
      .post("/publico/orcamentos/token-invalido/cobrancas")
      .set("Idempotency-Key", "tentativa-final")

    expect(bloqueada.status).toBe(429)
    expect(bloqueada.body.codigo).toBe(
      "LIMITE_COBRANCA_PUBLICA_EXCEDIDO"
    )

    const consulta = await request(app)
      .get("/publico/orcamentos/token-invalido/cobranca")

    expect(consulta.status).toBe(400)
  })
})
