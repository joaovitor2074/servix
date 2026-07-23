import { beforeEach, describe, expect, it, vi } from "vitest"

import { Prisma } from "../generated/prisma/client.js"
import {
  StatusOrdem,
  StatusRegistroPagamento
} from "../generated/prisma/enums.js"

const prismaMocks = vi.hoisted(() => ({
  buscarOrdem: vi.fn()
}))

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    ordemServico: {
      findUnique: prismaMocks.buscarOrdem
    }
  }
}))

import { buscarOrdemPublicaService } from "./ordens-publicas.service.js"

describe("acompanhamento público da ordem", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("devolve somente o contrato público e resume o pagamento", async () => {
    prismaMocks.buscarOrdem.mockResolvedValue({
      numero: 12,
      equipamento: "Notebook Dell",
      status: StatusOrdem.EM_EXECUCAO,
      previsaoDeEntrega: new Date("2026-08-01T18:00:00.000Z"),
      valor: new Prisma.Decimal("350.00"),
      orcamento: {
        empresa: {
          nome: "Servix Teste",
          telefone: "11999999999",
          email: "contato@servix.test"
        }
      },
      historico: [
        {
          status: StatusOrdem.RECEBIDO,
          mensagemPublica: "Equipamento recebido com segurança.",
          criadoEm: new Date("2026-07-22T10:00:00.000Z")
        },
        {
          status: StatusOrdem.EM_EXECUCAO,
          mensagemPublica: "Reparo em andamento.",
          criadoEm: new Date("2026-07-23T10:00:00.000Z")
        }
      ],
      pagamentos: [
        {
          valor: new Prisma.Decimal("100.00"),
          status: StatusRegistroPagamento.CONFIRMADO
        }
      ]
    })

    const resultado = await buscarOrdemPublicaService(
      "12345678-1234-1234-1234-123456789012"
    )

    expect(resultado).toEqual({
      empresa: {
        nome: "Servix Teste",
        telefone: "11999999999",
        email: "contato@servix.test"
      },
      numero: 12,
      equipamento: "Notebook Dell",
      status: StatusOrdem.EM_EXECUCAO,
      statusDescricao: "Serviço em execução",
      previsaoDeEntrega: new Date("2026-08-01T18:00:00.000Z"),
      valorAprovado: "350.00",
      pagamento: {
        status: "PARCIAL",
        valorTotal: "350.00",
        totalPago: "100.00",
        saldo: "250.00"
      },
      historico: [
        {
          status: StatusOrdem.RECEBIDO,
          statusDescricao: "Serviço recebido",
          mensagemPublica: "Equipamento recebido com segurança.",
          criadoEm: new Date("2026-07-22T10:00:00.000Z")
        },
        {
          status: StatusOrdem.EM_EXECUCAO,
          statusDescricao: "Serviço em execução",
          mensagemPublica: "Reparo em andamento.",
          criadoEm: new Date("2026-07-23T10:00:00.000Z")
        }
      ]
    })

    expect(resultado).not.toHaveProperty("id")
    expect(resultado).not.toHaveProperty("empresaId")
    expect(resultado).not.toHaveProperty("cliente")
    expect(resultado).not.toHaveProperty("problemaRelatado")
    expect(resultado).not.toHaveProperty("diagnostico")
    expect(resultado).not.toHaveProperty("tecnicoResponsavel")
    expect(resultado?.pagamento).not.toHaveProperty("totalEstornado")
    expect(resultado?.historico[0]).not.toHaveProperty("alteradoPor")
    expect(resultado?.historico[0]).not.toHaveProperty("ordemId")
  })

  it("consulta uma única OS pelo token e seleciona relações do mesmo registro", async () => {
    prismaMocks.buscarOrdem.mockResolvedValue(null)

    const resultado = await buscarOrdemPublicaService(
      "token-global-imprevisivel-empresa-b"
    )

    expect(resultado).toBeNull()
    expect(prismaMocks.buscarOrdem).toHaveBeenCalledWith({
      where: {
        tokenAcompanhamento: "token-global-imprevisivel-empresa-b"
      },
      select: expect.objectContaining({
        numero: true,
        equipamento: true,
        orcamento: {
          select: {
            empresa: {
              select: {
                nome: true,
                telefone: true,
                email: true
              }
            }
          }
        },
        historico: expect.objectContaining({
          select: {
            status: true,
            mensagemPublica: true,
            criadoEm: true
          }
        })
      })
    })

    const selecao = prismaMocks.buscarOrdem.mock.calls[0][0].select
    expect(selecao).not.toHaveProperty("cliente")
    expect(selecao).not.toHaveProperty("diagnostico")
    expect(selecao).not.toHaveProperty("problemaRelatado")
    expect(selecao.historico.select).not.toHaveProperty("alteradoPor")
  })
})
