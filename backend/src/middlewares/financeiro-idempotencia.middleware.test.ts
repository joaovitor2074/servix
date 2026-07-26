import { createHash } from "node:crypto"

import express from "express"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  PapelUsuario,
  StatusIdempotenciaFinanceira
} from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  criar: vi.fn(),
  buscar: vi.fn(),
  atualizar: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    idempotenciaFinanceira: {
      create: prismaMocks.criar,
      findUnique: prismaMocks.buscar,
      update: prismaMocks.atualizar
    }
  }
}))
vi.mock("../lib/prisma-errors.js", () => ({
  erroPrismaPossuiCodigo: vi.fn().mockReturnValue(true)
}))

import { garantirIdempotenciaFinanceiroPreview } from "./financeiro-idempotencia.middleware.js"

type Registro = {
  id: number
  empresaId: number
  ambiente: "PREVIEW"
  usuarioId: number
  chave: string
  operacao: string
  fingerprint: string
  status: StatusIdempotenciaFinanceira
  codigoHttp: number | null
  resposta: unknown
  criadoEm: Date
  concluidoEm: Date | null
}

let registro: Registro | null
let execucoes: number

function criarApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.auth = {
      usuarioId: 5,
      empresaId: 2,
      papel: PapelUsuario.ADMIN
    }
    next()
  })
  app.post("/preview/financeiro/operacao", garantirIdempotenciaFinanceiroPreview, (_req, res) => {
    execucoes += 1
    res.status(201).json({ criado: true, execucoes })
  })
  return app
}

beforeEach(() => {
  registro = null
  execucoes = 0
  vi.clearAllMocks()
  prismaMocks.criar.mockImplementation(async ({ data }) => {
    if (registro) throw new Error("P2002")
    registro = {
      id: 1,
      ...data,
      status: StatusIdempotenciaFinanceira.EM_PROCESSAMENTO,
      codigoHttp: null,
      resposta: null,
      criadoEm: new Date(),
      concluidoEm: null
    } as Registro
    return registro
  })
  prismaMocks.buscar.mockImplementation(async () => registro)
  prismaMocks.atualizar.mockImplementation(async ({ data }) => {
    if (!registro) throw new Error("reserva ausente")
    registro = { ...registro, ...data }
    return registro
  })
})

describe("idempotência do financeiro preview", () => {
  it("exige Idempotency-Key válida em todo POST", async () => {
    const resposta = await request(criarApp())
      .post("/preview/financeiro/operacao")
      .send({ valor: 10 })

    expect(resposta.status).toBe(400)
    expect(resposta.body.codigo).toBe("FINANCEIRO_IDEMPOTENCY_KEY_OBRIGATORIA")
    expect(execucoes).toBe(0)
  })

  it("reutiliza a resposta concluída sem repetir a mutação", async () => {
    const app = criarApp()
    const primeira = await request(app)
      .post("/preview/financeiro/operacao")
      .set("Idempotency-Key", "operacao-123")
      .send({ descricao: "Teste", valor: 10 })
    const repetida = await request(app)
      .post("/preview/financeiro/operacao")
      .set("Idempotency-Key", "operacao-123")
      // A ordenação diferente das propriedades produz o mesmo fingerprint.
      .send({ valor: 10, descricao: "Teste" })

    expect(primeira.status).toBe(201)
    expect(repetida.status).toBe(201)
    expect(repetida.headers["idempotency-replayed"]).toBe("true")
    expect(repetida.body).toEqual(primeira.body)
    expect(execucoes).toBe(1)
  })

  it("recusa reutilização da chave com payload diferente", async () => {
    const app = criarApp()
    await request(app)
      .post("/preview/financeiro/operacao")
      .set("Idempotency-Key", "operacao-456")
      .send({ valor: 10 })
    const resposta = await request(app)
      .post("/preview/financeiro/operacao")
      .set("Idempotency-Key", "operacao-456")
      .send({ valor: 11 })

    expect(resposta.status).toBe(409)
    expect(resposta.body.codigo).toBe("FINANCEIRO_IDEMPOTENCY_KEY_REUTILIZADA")
    expect(execucoes).toBe(1)
  })

  it("não repete reserva que ainda está em processamento", async () => {
    prismaMocks.criar.mockRejectedValueOnce(new Error("P2002"))
    registro = {
      id: 9,
      empresaId: 2,
      ambiente: "PREVIEW",
      usuarioId: 5,
      chave: "processando-1",
      operacao: "POST /preview/financeiro/operacao",
      fingerprint: createHash("sha256").update(JSON.stringify({
        operacao: "POST /preview/financeiro/operacao",
        usuarioId: 5,
        corpo: { valor: 10 }
      })).digest("hex"),
      status: StatusIdempotenciaFinanceira.EM_PROCESSAMENTO,
      codigoHttp: null,
      resposta: null,
      criadoEm: new Date(),
      concluidoEm: null
    }

    const resposta = await request(criarApp())
      .post("/preview/financeiro/operacao")
      .set("Idempotency-Key", "processando-1")
      .send({ valor: 10 })

    expect(resposta.status).toBe(409)
    expect(resposta.body.codigo).toBe("FINANCEIRO_IDEMPOTENCIA_EM_PROCESSAMENTO")
    expect(execucoes).toBe(0)
  })
})
