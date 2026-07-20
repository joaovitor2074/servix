import type { Express } from "express"
import request from "supertest"
import { beforeAll, describe, expect, it } from "vitest"

// Estes são testes de integração HTTP: o Supertest chama o Express em memória,
// sem abrir uma porta real. A importação ocorre depois da configuração do JWT.
let app: Express

beforeAll(async () => {
  process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres"
  const modulo = await import("./app.js")
  app = modulo.default
})

describe("API HTTP", () => {
  it("responde na raiz sem expor dados internos", async () => {
    const resposta = await request(app).get("/")

    expect(resposta.status).toBe(200)
    expect(resposta.body).toEqual({
      nome: "Servix API",
      status: "online"
    })
  })

  it("protege as rotas de clientes", async () => {
    const resposta = await request(app).get("/clientes")

    expect(resposta.status).toBe(401)
    expect(resposta.body.erro).toContain("Token")
  })

  it("recusa campos desconhecidos no login antes de consultar o banco", async () => {
    const resposta = await request(app)
      .post("/auth/login")
      .send({
        empresaSlug: "empresa",
        email: "admin@empresa.com",
        senha: "senha-segura",
        empresaId: 99
      })

    expect(resposta.status).toBe(400)
  })

  it("responde 400 para JSON malformado", async () => {
    const resposta = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":')

    expect(resposta.status).toBe(400)
    expect(resposta.body.erro).toBe("JSON inválido")
  })
})
