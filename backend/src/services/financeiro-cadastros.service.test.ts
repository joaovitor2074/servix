import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  AmbienteFinanceiro,
  TipoCategoriaFinanceira
} from "../generated/prisma/enums.js"

const txMocks = vi.hoisted(() => ({
  criarCategoria: vi.fn()
}))
const transacaoMocks = vi.hoisted(() => ({
  bloquear: vi.fn(),
  executar: vi.fn()
}))
const auditoriaMocks = vi.hoisted(() => ({ registrar: vi.fn() }))

const tx = {
  categoriaFinanceira: { create: txMocks.criarCategoria }
}

vi.mock("../lib/prisma.js", () => ({ prisma: {} }))
vi.mock("../lib/prisma-errors.js", () => ({
  erroPrismaPossuiCodigo: vi.fn().mockReturnValue(false)
}))
vi.mock("../lib/transacao.js", () => ({
  bloquearFinanceiroPreviewDaEmpresaTx: transacaoMocks.bloquear,
  executarTransacaoComRollback: transacaoMocks.executar
}))
vi.mock("./financeiro-auditoria.service.js", () => ({
  registrarAuditoriaFinanceiraTx: auditoriaMocks.registrar
}))

import { criarCategoriaFinanceiraService } from "./financeiro-cadastros.service.js"

beforeEach(() => {
  vi.clearAllMocks()
  transacaoMocks.executar.mockImplementation(
    async (executar: (cliente: typeof tx) => Promise<unknown>) => executar(tx)
  )
  transacaoMocks.bloquear.mockResolvedValue(undefined)
  auditoriaMocks.registrar.mockResolvedValue(undefined)
})
describe("cadastros do financeiro preview", () => {
  it("serializa a criação pelo advisory lock da empresa", async () => {
    txMocks.criarCategoria.mockResolvedValue({
      id: 7,
      empresaId: 2,
      ambiente: AmbienteFinanceiro.PREVIEW,
      nome: "Serviços",
      tipo: TipoCategoriaFinanceira.RECEITA,
      ativa: true
    })

    const resultado = await criarCategoriaFinanceiraService(2, 5, {
      nome: "Serviços",
      tipo: TipoCategoriaFinanceira.RECEITA
    })

    expect(resultado.sucesso).toBe(true)
    expect(transacaoMocks.bloquear).toHaveBeenCalledWith(tx, 2)
    expect(txMocks.criarCategoria).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        empresaId: 2,
        ambiente: AmbienteFinanceiro.PREVIEW
      })
    }))
  })
})
