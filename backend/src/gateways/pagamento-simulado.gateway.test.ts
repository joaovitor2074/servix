import { describe, expect, it } from "vitest"

import { AmbientePagamento } from "../generated/prisma/enums.js"
import { PagamentoSimuladoGateway } from "./pagamento-simulado.gateway.js"

describe("gateway simulado", () => {
  it("e deterministico por empresa e chave sem gerar Pix bancario", async () => {
    const gateway = new PagamentoSimuladoGateway()
    const dados = {
      empresaId: 8,
      chaveIdempotencia: "pedido-123456",
      valor: "100.00",
      descricao: "Orcamento #12",
      ambiente: AmbientePagamento.TESTE
    }

    const primeira = await gateway.criarCobranca(dados)
    const segunda = await gateway.criarCobranca(dados)

    expect(primeira.identificadorExterno).toBe(segunda.identificadorExterno)
    expect(primeira.codigoPix).toContain("PIX_SIMULADO")
    expect(primeira.codigoPix).not.toMatch(/^000201/)
  })

  it("separa identificadores de empresas diferentes", async () => {
    const gateway = new PagamentoSimuladoGateway()
    const base = {
      chaveIdempotencia: "pedido-123456",
      valor: "100.00",
      descricao: "Orcamento #12",
      ambiente: AmbientePagamento.TESTE
    }

    const primeira = await gateway.criarCobranca({ ...base, empresaId: 8 })
    const segunda = await gateway.criarCobranca({ ...base, empresaId: 9 })

    expect(primeira.identificadorExterno).not.toBe(segunda.identificadorExterno)
  })
})

