import express from "express"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { PapelUsuario } from "../generated/prisma/enums.js"

const mocks = vi.hoisted(() => ({
  iniciar: vi.fn(),
  concluir: vi.fn(),
  desconectar: vi.fn()
}))

vi.mock("../services/mercado-pago-oauth.service.js", async importOriginal => {
  const original = await importOriginal<
    typeof import("../services/mercado-pago-oauth.service.js")
  >()
  return {
    ...original,
    iniciarOAuthMercadoPagoService: mocks.iniciar,
    concluirOAuthMercadoPagoService: mocks.concluir,
    desconectarMercadoPagoService: mocks.desconectar
  }
})

vi.mock("../config/env.js", () => ({
  obterUrlFrontend: () => "http://frontend.test"
}))

import integracoesPublicasRoutes from "../routes/integracoes-publicas.routes.js"
import mercadoPagoOAuthRoutes from "../routes/mercado-pago-oauth.routes.js"

function appPublica() {
  const app = express()
  app.use("/integracoes", integracoesPublicasRoutes)
  return app
}

function appProtegida(papel: PapelUsuario) {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.auth = { usuarioId: 3, empresaId: 8, papel }
    next()
  })
  app.use(
    "/configuracoes/pagamentos/mercado-pago",
    mercadoPagoOAuthRoutes
  )
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.iniciar.mockResolvedValue({
    authorizationUrl: "https://auth.mercadopago.com/authorization?state=seguro"
  })
  mocks.concluir.mockResolvedValue({
    sucesso: true,
    empresaId: 8,
    liveMode: false
  })
  mocks.desconectar.mockResolvedValue({ sucesso: true })
})

describe("HTTP OAuth Mercado Pago", () => {
  it("expoe iniciar/desconectar apenas para ADMIN e sem tokens", async () => {
    const admin = appProtegida(PapelUsuario.ADMIN)
    const inicio = await request(admin)
      .post("/configuracoes/pagamentos/mercado-pago/oauth/iniciar")
      .send({})
    const desconexao = await request(admin)
      .delete("/configuracoes/pagamentos/mercado-pago")

    expect(inicio.status).toBe(200)
    expect(inicio.body).toEqual({
      authorizationUrl: "https://auth.mercadopago.com/authorization?state=seguro"
    })
    expect(JSON.stringify(inicio.body)).not.toMatch(/access_token|refresh_token/i)
    expect(desconexao.status).toBe(204)
    expect(mocks.iniciar).toHaveBeenCalledWith(8, 3)
    expect(mocks.desconectar).toHaveBeenCalledWith(8)

    const atendente = await request(appProtegida(PapelUsuario.ATENDENTE))
      .post("/configuracoes/pagamentos/mercado-pago/oauth/iniciar")
      .send({})
    expect(atendente.status).toBe(403)
  })

  it("callback publica redireciona sucesso sem serializar credenciais", async () => {
    const resposta = await request(appPublica()).get(
      "/integracoes/mercado-pago/callback?state=state-seguro&code=code-seguro"
    )

    expect(resposta.status).toBe(303)
    expect(resposta.headers.location).toBe(
      "http://frontend.test/configuracoes/pagamentos?mercadoPago=conectado"
    )
    expect(JSON.stringify(resposta.headers)).not.toMatch(
      /APP_USR|TG-refresh|access_token|refresh_token/i
    )
  })

  it("callback converte falha inesperada em codigo seguro", async () => {
    mocks.concluir.mockRejectedValue(
      new Error("APP_USR-token-e-TG-refresh-nao-podem-vazar")
    )

    const resposta = await request(appPublica()).get(
      "/integracoes/mercado-pago/callback?state=state-seguro&code=code-seguro"
    )

    expect(resposta.status).toBe(303)
    expect(resposta.headers.location).toBe(
      "http://frontend.test/configuracoes/pagamentos?mercadoPago=erro&codigo=CONEXAO_FALHOU"
    )
    expect(String(resposta.headers.location)).not.toMatch(/APP_USR|TG-refresh/)
  })
})
