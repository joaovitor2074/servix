import type { Express } from "express"
import request from "supertest"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { prisma } from "./lib/prisma.js"

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

  it("informa que API e banco estao prontos no health check", async () => {
    vi.spyOn(prisma, "$queryRaw").mockResolvedValueOnce(1 as never)

    const resposta = await request(app).get("/health")

    expect(resposta.status).toBe(200)
    expect(resposta.body).toEqual({
      status: "ok",
      service: "servix-api",
      banco: "ok"
    })
  })

  it("retorna 503 quando o banco nao esta disponivel", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("offline"))

    const resposta = await request(app).get("/health")

    expect(resposta.status).toBe(503)
    expect(resposta.body).toEqual({
      status: "indisponivel",
      service: "servix-api",
      banco: "erro"
    })
  })

  it("protege as rotas de clientes", async () => {
    const resposta = await request(app).get("/clientes")

    expect(resposta.status).toBe(401)
    expect(resposta.body.erro).toContain("Token")
  })

  it("protege o resumo da dashboard", async () => {
    const resposta = await request(app).get("/dashboard/resumo")

    expect(resposta.status).toBe(401)
    expect(resposta.body.erro).toContain("Token")
  })

  it("protege configuracoes de pagamento", async () => {
    const resposta = await request(app).get("/configuracoes/pagamentos")

    expect(resposta.status).toBe(401)
    expect(resposta.body.erro).toContain("Token")
  })

  it("protege a administracao de cobrancas", async () => {
    const resposta = await request(app).get("/cobrancas")

    expect(resposta.status).toBe(401)
    expect(resposta.body.erro).toContain("Token")
  })

  it("publica o plano do Servix sem expor credenciais", async () => {
    const resposta = await request(app).get("/assinaturas/planos")

    expect(resposta.status).toBe(200)
    expect(resposta.body).toMatchObject({
      ambiente: "TESTE",
      planos: [{
        codigo: "servix-mensal",
        valorMensal: "24.90"
      }]
    })
    expect(JSON.stringify(resposta.body)).not.toContain("accessToken")
  })

  it("recusa token de checkout malformado antes de consultar o banco", async () => {
    const resposta = await request(app)
      .get("/assinaturas/checkout/token-curto")

    expect(resposta.status).toBe(400)
    expect(resposta.body.codigo).toBe("CHECKOUT_ASSINATURA_INVALIDO")
  })

  it("responde 404 quando o checkout nao existe", async () => {
    vi.spyOn(prisma.assinaturaEmpresa, "findUnique")
      .mockResolvedValueOnce(null)

    const resposta = await request(app)
      .get("/assinaturas/checkout/123e4567-e89b-12d3-a456-426614174000")

    expect(resposta.status).toBe(404)
    expect(resposta.body).toEqual({
      erro: "Este checkout não existe ou não está mais disponível.",
      codigo: "CHECKOUT_ASSINATURA_NAO_ENCONTRADO"
    })
  })

  it("mantém o acompanhamento fora da autenticação interna", async () => {
    const resposta = await request(app).get("/publico/ordens/token-curto")

    expect(resposta.status).toBe(400)
    expect(resposta.body.codigo).toBe("TOKEN_ACOMPANHAMENTO_INVALIDO")
    expect(resposta.body.erro).not.toContain("Token de autenticação")
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

  it("isola rajadas do webhook do limite global sem remover a protecao", async () => {
    const respostas = await Promise.all(
      Array.from({ length: 305 }, () =>
        request(app)
          .post("/assinaturas/webhooks/mercado-pago")
          .send({})
      )
    )

    expect(respostas.every(resposta => resposta.status === 400)).toBe(true)
    expect(String(respostas[0]?.headers["ratelimit-policy"]))
      .toContain("1000")

    const respostaGeral = await request(app).get("/rota-inexistente")

    expect(respostaGeral.status).toBe(404)
    expect(String(respostaGeral.headers["ratelimit-policy"]))
      .toContain("300")
  })
})
