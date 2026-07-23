import { ProvedorPagamento } from "../generated/prisma/enums.js"
import type {
  CobrancaConsultadaNoGateway,
  CobrancaCriadaNoGateway,
  CobrancaEsperadaNoGateway,
  CriarCobrancaGatewayInput,
  GatewayPagamento
} from "./pagamentos.gateway.js"

const API_MERCADO_PAGO = "https://api.mercadopago.com"
const DURACAO_MINIMA_MS = 30 * 60 * 1000
const DURACAO_MAXIMA_MS = 30 * 24 * 60 * 60 * 1000

export type CodigoErroMercadoPago =
  | "TEMPO_LIMITE"
  | "INDISPONIVEL"
  | "LIMITE_REQUISICOES"
  | "RESPOSTA_REJEITADA"
  | "RESPOSTA_INVALIDA"

export class ErroMercadoPagoGateway extends Error {
  readonly tentarNovamenteEmMs: number | undefined

  constructor(
    public readonly codigo: CodigoErroMercadoPago,
    public readonly statusHttp?: number,
    tentarNovamenteEmMs?: number
  ) {
    super("Nao foi possivel concluir a operacao no Mercado Pago.")
    this.name = "ErroMercadoPagoGateway"
    this.tentarNovamenteEmMs = tentarNovamenteEmMs
  }
}

type MercadoPagoGatewayOpcoes = {
  accessToken: string
  mercadoPagoUserIdEsperado?: string
  timeoutMs?: number
  fetchImpl?: typeof globalThis.fetch
  agora?: () => Date
}

type ObjetoJson = Record<string, unknown>

function objeto(valor: unknown): ObjetoJson | null {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? valor as ObjetoJson
    : null
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor : null
}

function centavos(valor: unknown): bigint | null {
  const recebido = typeof valor === "number" && Number.isFinite(valor)
    ? valor.toFixed(2)
    : texto(valor)?.trim()

  if (!recebido || !/^\d+(?:\.\d{1,2})?$/.test(recebido)) return null

  const [inteiro = "0", decimal = ""] = recebido.split(".")
  return BigInt(inteiro) * 100n + BigInt(decimal.padEnd(2, "0"))
}

function mesmoValor(recebido: unknown, esperado: string): boolean {
  const valorRecebido = centavos(recebido)
  const valorEsperado = centavos(esperado)
  return valorRecebido !== null && valorRecebido === valorEsperado
}

function primeiroPagamento(order: ObjetoJson): ObjetoJson | null {
  const transactions = objeto(order.transactions)
  const payments = transactions?.payments

  if (!Array.isArray(payments)) return null
  return objeto(payments[0])
}

function dataValida(valor: unknown): Date | undefined {
  const recebida = texto(valor)
  if (!recebida) return undefined

  const data = new Date(recebida)
  return Number.isNaN(data.getTime()) ? undefined : data
}

function duracaoIsoEmMinutos(duracaoMs: number): string {
  const minutos = Math.ceil(duracaoMs / 60000)

  if (minutos % 1440 === 0) {
    return `P${minutos / 1440}D`
  }

  return `PT${minutos}M`
}

function obterEsperaRetryAfter(
  valor: string | null,
  agora: Date
): number | undefined {
  if (!valor) return undefined

  const segundos = Number(valor)
  if (Number.isFinite(segundos) && segundos >= 0) {
    return Math.min(5 * 60_000, Math.max(1000, Math.ceil(segundos * 1000)))
  }

  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return undefined

  return Math.min(
    5 * 60_000,
    Math.max(1000, data.getTime() - agora.getTime())
  )
}

export class MercadoPagoGateway implements GatewayPagamento {
  readonly provedor = ProvedorPagamento.MERCADO_PAGO

  private readonly accessToken: string
  private readonly mercadoPagoUserIdEsperado: string | undefined
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof globalThis.fetch
  private readonly agora: () => Date

  constructor(opcoes: MercadoPagoGatewayOpcoes) {
    this.accessToken = opcoes.accessToken
    this.mercadoPagoUserIdEsperado = opcoes.mercadoPagoUserIdEsperado
    this.timeoutMs = opcoes.timeoutMs ?? 8000
    this.fetchImpl = opcoes.fetchImpl ?? globalThis.fetch
    this.agora = opcoes.agora ?? (() => new Date())
  }

  private async requisicao(
    caminho: string,
    init: RequestInit
  ): Promise<ObjetoJson> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    let resposta: Response

    try {
      resposta = await this.fetchImpl(`${API_MERCADO_PAGO}${caminho}`, {
        ...init,
        // Nao permita que um redirecionamento inesperado encaminhe o header
        // Authorization para outro destino.
        redirect: "error",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.accessToken}`,
          ...init.headers
        },
        signal: controller.signal
      })
    } catch {
      if (controller.signal.aborted) {
        throw new ErroMercadoPagoGateway("TEMPO_LIMITE")
      }

      throw new ErroMercadoPagoGateway("INDISPONIVEL")
    } finally {
      clearTimeout(timeout)
    }

    if (!resposta.ok) {
      if (resposta.status === 429) {
        throw new ErroMercadoPagoGateway(
          "LIMITE_REQUISICOES",
          resposta.status,
          obterEsperaRetryAfter(
            resposta.headers.get("Retry-After"),
            this.agora()
          )
        )
      }

      throw new ErroMercadoPagoGateway(
        "RESPOSTA_REJEITADA",
        resposta.status
      )
    }

    let corpo: unknown

    try {
      corpo = await resposta.json()
    } catch {
      throw new ErroMercadoPagoGateway("RESPOSTA_INVALIDA")
    }

    const json = objeto(corpo)
    if (!json) {
      throw new ErroMercadoPagoGateway("RESPOSTA_INVALIDA")
    }

    return json
  }

  private validarContaVendedora(order: ObjetoJson): string | null {
    const userId = typeof order.user_id === "number" &&
      Number.isSafeInteger(order.user_id)
      ? String(order.user_id)
      : texto(order.user_id)?.trim()

    if (
      this.mercadoPagoUserIdEsperado &&
      userId !== this.mercadoPagoUserIdEsperado
    ) {
      throw new ErroMercadoPagoGateway("RESPOSTA_INVALIDA")
    }

    return userId ?? null
  }

  private validarDadosDaCobranca(
    order: ObjetoJson,
    esperada: CobrancaEsperadaNoGateway
  ) {
    const pagamento = primeiroPagamento(order)
    const metodoPagamento = objeto(pagamento?.payment_method)

    if (
      texto(order.external_reference) !== esperada.referenciaExterna ||
      !mesmoValor(order.total_amount, esperada.valor) ||
      !pagamento ||
      !mesmoValor(pagamento.amount, esperada.valor) ||
      texto(metodoPagamento?.id) !== "pix" ||
      texto(metodoPagamento?.type) !== "bank_transfer"
    ) {
      throw new ErroMercadoPagoGateway("RESPOSTA_INVALIDA")
    }
  }

  async criarCobranca(
    dados: CriarCobrancaGatewayInput
  ): Promise<CobrancaCriadaNoGateway> {
    const agora = this.agora()
    const vencimentoRecebido = dados.expiraEm?.getTime()
      ?? agora.getTime() + DURACAO_MINIMA_MS
    const duracao = Math.min(
      DURACAO_MAXIMA_MS,
      Math.max(DURACAO_MINIMA_MS, vencimentoRecebido - agora.getTime())
    )
    const expiraEm = new Date(agora.getTime() + duracao)
    const referencia = dados.cobrancaLocalId === undefined
      ? `servix_${dados.empresaId}_${dados.chaveIdempotencia}`
      : `servix_${dados.empresaId}_${dados.cobrancaLocalId}`

    const order = await this.requisicao("/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": dados.chaveIdempotencia
      },
      body: JSON.stringify({
        type: "online",
        processing_mode: "automatic",
        external_reference: referencia,
        total_amount: dados.valor,
        payer: {
          email: "test_user_br@testuser.com",
          first_name: "APRO"
        },
        transactions: {
          payments: [{
            amount: dados.valor,
            expiration_time: duracaoIsoEmMinutos(duracao),
            payment_method: {
              id: "pix",
              type: "bank_transfer"
            }
          }]
        }
      })
    })

    const mercadoPagoUserId = this.validarContaVendedora(order)
    this.validarDadosDaCobranca(order, {
      valor: dados.valor,
      referenciaExterna: referencia
    })

    const identificadorExterno = texto(order.id)
    const pagamento = primeiroPagamento(order)
    const metodoPagamento = objeto(pagamento?.payment_method)
    const codigoPix = texto(metodoPagamento?.qr_code)

    if (!identificadorExterno || !codigoPix) {
      throw new ErroMercadoPagoGateway("RESPOSTA_INVALIDA")
    }

    const qrCodeBase64 = texto(metodoPagamento?.qr_code_base64)
    const vencimentoRetornado = dataValida(pagamento?.date_of_expiration)

    return {
      identificadorExterno,
      ...(mercadoPagoUserId && { mercadoPagoUserId }),
      codigoPix,
      ...(qrCodeBase64 && { qrCodeBase64 }),
      expiraEm: vencimentoRetornado ?? expiraEm
    }
  }

  async consultarCobranca(
    identificadorExterno: string,
    esperada?: CobrancaEsperadaNoGateway
  ): Promise<CobrancaConsultadaNoGateway> {
    const order = await this.requisicao(
      `/v1/orders/${encodeURIComponent(identificadorExterno)}`,
      { method: "GET" }
    )

    const mercadoPagoUserId = this.validarContaVendedora(order)

    if (esperada) {
      this.validarDadosDaCobranca(order, esperada)
    }

    if (texto(order.id) !== identificadorExterno) {
      throw new ErroMercadoPagoGateway("RESPOSTA_INVALIDA")
    }

    const pagamento = primeiroPagamento(order)
    const status = texto(pagamento?.status) ?? texto(order.status)
    const detalhe = texto(pagamento?.status_detail)
      ?? texto(order.status_detail)

    if (status === "processed" && detalhe === "accredited") {
      return {
        status: "PAGA",
        ...(mercadoPagoUserId && { mercadoPagoUserId }),
        pagaEm: dataValida(pagamento?.last_updated_date)
          ?? dataValida(order.last_updated_date)
          ?? this.agora()
      }
    }

    if (status === "expired" && detalhe === "expired") {
      return {
        status: "EXPIRADA",
        ...(mercadoPagoUserId && { mercadoPagoUserId })
      }
    }

    if (
      (status === "canceled" && detalhe === "canceled") ||
      status === "failed"
    ) {
      return {
        status: "CANCELADA",
        ...(mercadoPagoUserId && { mercadoPagoUserId })
      }
    }

    return {
      status: "PENDENTE",
      ...(mercadoPagoUserId && { mercadoPagoUserId })
    }
  }
}
