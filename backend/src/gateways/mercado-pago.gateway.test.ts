import { afterEach, describe, expect, it, vi } from "vitest"

import { AmbientePagamento } from "../generated/prisma/enums.js"
import {
  ErroMercadoPagoGateway,
  MercadoPagoGateway
} from "./mercado-pago.gateway.js"

const agora = new Date("2026-07-23T12:00:00.000Z")

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" }
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe("gateway Mercado Pago de teste", () => {
  it("cria Pix pela Orders API com idempotencia e pagador sandbox", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respostaJson({
      id: "ORD_TESTE_123",
      user_id: "241983636",
      external_reference: "servix_8_31",
      total_amount: "50.00",
      status: "action_required",
      status_detail: "waiting_transfer",
      transactions: {
        payments: [{
          amount: "50.00",
          status: "action_required",
          status_detail: "waiting_transfer",
          date_of_expiration: "2026-07-23T12:30:00.000Z",
          payment_method: {
            id: "pix",
            type: "bank_transfer",
            qr_code: "000201PIXTESTE",
            qr_code_base64: "BASE64_TESTE"
          }
        }]
      }
    }))
    const gateway = new MercadoPagoGateway({
      accessToken: "APP_USR-token-somente-teste",
      mercadoPagoUserIdEsperado: "241983636",
      fetchImpl,
      agora: () => agora
    })

    const resultado = await gateway.criarCobranca({
      empresaId: 8,
      cobrancaLocalId: 31,
      chaveIdempotencia: "cobranca-31-chave",
      valor: "50.00",
      descricao: "Orcamento Servix #12",
      ambiente: AmbientePagamento.TESTE
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://api.mercadopago.com/v1/orders")
    expect(init.method).toBe("POST")
    expect(init.redirect).toBe("error")
    expect(init.headers).toMatchObject({
      Authorization: "Bearer APP_USR-token-somente-teste",
      "Content-Type": "application/json",
      "X-Idempotency-Key": "cobranca-31-chave"
    })
    expect(JSON.parse(String(init.body))).toEqual({
      type: "online",
      processing_mode: "automatic",
      external_reference: "servix_8_31",
      total_amount: "50.00",
      payer: {
        email: "test_user_br@testuser.com",
        first_name: "APRO"
      },
      transactions: {
        payments: [{
          amount: "50.00",
          expiration_time: "PT30M",
          payment_method: {
            id: "pix",
            type: "bank_transfer"
          }
        }]
      }
    })
    expect(resultado).toEqual({
      identificadorExterno: "ORD_TESTE_123",
      mercadoPagoUserId: "241983636",
      codigoPix: "000201PIXTESTE",
      qrCodeBase64: "BASE64_TESTE",
      expiraEm: new Date("2026-07-23T12:30:00.000Z")
    })
  })

  it("consulta a order e reconhece somente processed/accredited como paga", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(respostaJson({
      id: "ORD_TESTE_123",
      user_id: "241983636",
      status: "processed",
      status_detail: "accredited",
      last_updated_date: "2026-07-23T12:00:05.000Z",
      transactions: {
        payments: [{
          status: "processed",
          status_detail: "accredited"
        }]
      }
    }))
    const gateway = new MercadoPagoGateway({
      accessToken: "APP_USR-token-somente-teste",
      mercadoPagoUserIdEsperado: "241983636",
      fetchImpl,
      agora: () => agora
    })

    await expect(gateway.consultarCobranca("ORD_TESTE_123")).resolves.toEqual({
      status: "PAGA",
      mercadoPagoUserId: "241983636",
      pagaEm: new Date("2026-07-23T12:00:05.000Z")
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/orders/ORD_TESTE_123",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer APP_USR-token-somente-teste"
        })
      })
    )
  })

  it("rejeita order de outra conta ou com dados financeiros divergentes", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(respostaJson({
        id: "ORD_TESTE_123",
        user_id: "999999",
        external_reference: "servix_8_31",
        total_amount: "50.00",
        transactions: {
          payments: [{
            amount: "50.00",
            payment_method: { id: "pix", type: "bank_transfer" }
          }]
        }
      }))
      .mockResolvedValueOnce(respostaJson({
        id: "ORD_TESTE_123",
        user_id: "241983636",
        external_reference: "servix_8_999",
        total_amount: "1.00",
        transactions: {
          payments: [{
            amount: "1.00",
            status: "processed",
            status_detail: "accredited",
            payment_method: { id: "pix", type: "bank_transfer" }
          }]
        }
      }))
    const gateway = new MercadoPagoGateway({
      accessToken: "APP_USR-token-somente-teste",
      mercadoPagoUserIdEsperado: "241983636",
      fetchImpl
    })
    const esperada = {
      valor: "50.00",
      referenciaExterna: "servix_8_31"
    }

    await expect(gateway.consultarCobranca("ORD_TESTE_123", esperada))
      .rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" })
    await expect(gateway.consultarCobranca("ORD_TESTE_123", esperada))
      .rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" })
  })

  it("mantem waiting_transfer pendente e mapeia expiracao", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(respostaJson({
        id: "ORD_1",
        status: "action_required",
        status_detail: "waiting_transfer"
      }))
      .mockResolvedValueOnce(respostaJson({
        id: "ORD_2",
        status: "expired",
        status_detail: "expired"
      }))
    const gateway = new MercadoPagoGateway({
      accessToken: "APP_USR-token-somente-teste",
      fetchImpl
    })

    await expect(gateway.consultarCobranca("ORD_1")).resolves.toEqual({
      status: "PENDENTE"
    })
    await expect(gateway.consultarCobranca("ORD_2")).resolves.toEqual({
      status: "EXPIRADA"
    })
  })

  it("aplica timeout e nao inclui credencial nem corpo externo no erro", async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Abortado", "AbortError"))
        })
      })
    ) as unknown as typeof globalThis.fetch
    const gateway = new MercadoPagoGateway({
      accessToken: "APP_USR-segredo-que-nao-pode-vazar",
      timeoutMs: 100,
      fetchImpl
    })

    const requisicao = gateway
      .consultarCobranca("ORD_TIMEOUT")
      .catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(100)

    const erro = await requisicao
    expect(erro).toMatchObject({
      codigo: "TEMPO_LIMITE"
    })
    expect(String(erro)).not.toContain("APP_USR-segredo-que-nao-pode-vazar")
  })

  it("rejeita respostas HTTP e JSON incompleto com erros controlados", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(respostaJson({ message: "token-invalido" }, 401))
      .mockResolvedValueOnce(respostaJson({ id: "ORD_SEM_PIX" }))
    const gateway = new MercadoPagoGateway({
      accessToken: "APP_USR-segredo",
      fetchImpl
    })
    const dados = {
      empresaId: 8,
      cobrancaLocalId: 31,
      chaveIdempotencia: "cobranca-31-chave",
      valor: "50.00",
      descricao: "Orcamento #12",
      ambiente: AmbientePagamento.TESTE
    }

    await expect(gateway.criarCobranca(dados)).rejects.toEqual(
      new ErroMercadoPagoGateway("RESPOSTA_REJEITADA", 401)
    )
    await expect(gateway.criarCobranca(dados)).rejects.toMatchObject({
      codigo: "RESPOSTA_INVALIDA"
    })
  })

  it("preserva Retry-After quando o provedor limita requisicoes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: "rate limit" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": "7"
        }
      }
    ))
    const gateway = new MercadoPagoGateway({
      accessToken: "APP_USR-segredo",
      fetchImpl,
      agora: () => agora
    })

    await expect(gateway.consultarCobranca("ORD_LIMITADA"))
      .rejects.toMatchObject({
        codigo: "LIMITE_REQUISICOES",
        statusHttp: 429,
        tentarNovamenteEmMs: 7000
      })
  })
})
