import express from "express"
import request from "supertest"
import { describe, expect, it, vi } from "vitest"

const controllerMocks = vi.hoisted(() => ({
  buscar: vi.fn((_req, res) => res.status(200).json({ numero: 1 }))
}))

vi.mock("../controllers/ordens-publicas.controllers.js", () => ({
  buscarOrdemPublicaController: controllerMocks.buscar
}))

import router from "./ordens-publicas.routes.js"

describe("limite do acompanhamento público", () => {
  it("aceita consultas normais e limita rajadas por IP", async () => {
    const app = express()
    app.use("/publico/ordens", router)

    for (let tentativa = 0; tentativa < 60; tentativa += 1) {
      const resposta = await request(app).get(
        `/publico/ordens/token-publico-${tentativa}`
      )
      expect(resposta.status).toBe(200)
    }

    const bloqueada = await request(app).get(
      "/publico/ordens/token-publico-final"
    )

    expect(bloqueada.status).toBe(429)
    expect(bloqueada.headers["cache-control"]).toBe("no-store")
    expect(bloqueada.headers["x-robots-tag"]).toBe("noindex, nofollow")
    expect(bloqueada.body.codigo).toBe(
      "LIMITE_ACOMPANHAMENTO_PUBLICO_EXCEDIDO"
    )
  })
})
