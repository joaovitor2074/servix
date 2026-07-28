import { createHash } from "node:crypto"
import {
  obterConfiguracaoAssinaturasMercadoPago
} from "../config/env.js"

const MERCADO_PAGO_API_URL = "https://api.mercadopago.com"

type ObjetoDesconhecido = Record<string, unknown>
const REQUEST_ID_INTERNO = "__servixMercadoPagoRequestId"

export type CriarPlanoAssinaturaInput = {
  reason: string
  transactionAmount: number
  currencyId: "BRL"
}

export type PlanoAssinaturaMercadoPago = {
  id: string
  reason?: string
  status?: string
  init_point?: string
  date_created?: string
  last_modified?: string
}

export type CriarAssinaturaMercadoPagoInput = {
  emailPagador: string
  referenciaExterna: string
  transactionAmount: number
  currencyId: "BRL"
  backUrl: string
}

export type AssinaturaMercadoPago = {
  id: string
  preapproval_plan_id?: string
  external_reference?: string | number
  payer_email?: string
  status?: string
  init_point?: string
  next_payment_date?: string | null
  date_created?: string
  last_modified?: string
  auto_recurring?: {
    frequency?: number
    frequency_type?: string
    transaction_amount?: number
    currency_id?: string
  }
}

export function obterRequestIdMercadoPago(valor: unknown): string | null {
  if (!ehObjeto(valor)) return null
  const requestId = valor[REQUEST_ID_INTERNO]
  return typeof requestId === "string" && requestId ? requestId : null
}

export type PagamentoAutorizadoMercadoPago = {
  id: number
  preapproval_id?: string
  external_reference?: string | number
  status?: string
  summarized?: string
  retry_attempt?: number
  debit_date?: string
  date_created?: string
  last_modified?: string
  payment?: {
    id?: number | string
    status?: string
    status_detail?: string
  } | null
}

type BuscaAssinaturasMercadoPago = {
  results?: AssinaturaMercadoPago[]
}

export class ErroMercadoPagoAssinaturas extends Error {
  readonly statusHttp: number | undefined
  readonly codigo: string | undefined
  readonly requestId: string | undefined

  constructor(
    mensagem: string,
    opcoes: {
      statusHttp?: number
      codigo?: string
      requestId?: string
    } = {}
  ) {
    super(mensagem)
    this.name = "ErroMercadoPagoAssinaturas"
    this.statusHttp = opcoes.statusHttp
    this.codigo = opcoes.codigo
    this.requestId = opcoes.requestId
  }
}

function ehObjeto(valor: unknown): valor is ObjetoDesconhecido {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function tentarLerJson(texto: string): unknown {
  if (!texto) return null

  try {
    return JSON.parse(texto) as unknown
  } catch {
    return null
  }
}

function extrairDetalhesErro(corpo: unknown): {
  mensagem: string
  codigo?: string
} {
  if (!ehObjeto(corpo)) {
    return { mensagem: "O Mercado Pago recusou a requisição." }
  }

  const mensagemPrincipal =
    typeof corpo.message === "string"
      ? corpo.message
      : typeof corpo.error === "string"
        ? corpo.error
        : null

  const causas = Array.isArray(corpo.cause) ? corpo.cause : []
  const primeiraCausa = causas.find(ehObjeto)

  const descricaoCausa =
    primeiraCausa && typeof primeiraCausa.description === "string"
      ? primeiraCausa.description
      : null

  const codigoCausa =
    primeiraCausa &&
    (typeof primeiraCausa.code === "string" ||
      typeof primeiraCausa.code === "number")
      ? String(primeiraCausa.code)
      : null

  return {
    mensagem:
      descricaoCausa ??
      mensagemPrincipal ??
      "O Mercado Pago recusou a requisição.",
    ...(codigoCausa && { codigo: codigoCausa })
  }
}

function obterConfiguracaoObrigatoria() {
  const configuracao = obterConfiguracaoAssinaturasMercadoPago()

  if (configuracao.status !== "CONFIGURADA") {
    throw new ErroMercadoPagoAssinaturas(configuracao.motivo, {
      codigo: "CONFIGURACAO_INVALIDA"
    })
  }

  return configuracao
}

async function requisitarMercadoPago<T>(
  caminho: string,
  opcoes: {
    method: "POST" | "GET" | "PUT"
    body?: unknown
    chaveIdempotencia?: string
  }
): Promise<T> {
  const configuracao = obterConfiguracaoObrigatoria()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), configuracao.timeoutMs)

  try {
    const resposta = await fetch(`${MERCADO_PAGO_API_URL}${caminho}`, {
      method: opcoes.method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${configuracao.accessToken}`,
        ...(opcoes.body !== undefined && {
          "Content-Type": "application/json"
        }),
        ...(opcoes.chaveIdempotencia && {
          "X-Idempotency-Key": opcoes.chaveIdempotencia
        })
      },
      ...(opcoes.body !== undefined && {
        body: JSON.stringify(opcoes.body)
      }),
      signal: controller.signal
    })

    const texto = await resposta.text()
    const corpo = tentarLerJson(texto)
    const requestId = resposta.headers.get("x-request-id") ?? undefined

    if (!resposta.ok) {
      const detalhes = extrairDetalhesErro(corpo)
      const erroInternoProvedor =
        resposta.status >= 500 &&
        detalhes.mensagem.trim().toLowerCase() === "internal server error"

      throw new ErroMercadoPagoAssinaturas(
        erroInternoProvedor
          ? "O Mercado Pago não conseguiu criar o checkout. Confirme que o e-mail pertence a uma conta compradora de teste e tente novamente."
          : detalhes.mensagem,
        {
        statusHttp: resposta.status,
        codigo:
          detalhes.codigo ?? `MERCADO_PAGO_HTTP_${resposta.status}`,
        ...(requestId && { requestId })
        }
      )
    }

    if (requestId && ehObjeto(corpo)) {
      Object.defineProperty(corpo, REQUEST_ID_INTERNO, {
        value: requestId,
        enumerable: false,
        configurable: false
      })
    }

    return corpo as T
  } catch (error) {
    if (error instanceof ErroMercadoPagoAssinaturas) throw error

    if (error instanceof Error && error.name === "AbortError") {
      throw new ErroMercadoPagoAssinaturas(
        "O Mercado Pago demorou para responder.",
        { statusHttp: 504, codigo: "TEMPO_LIMITE" }
      )
    }

    throw new ErroMercadoPagoAssinaturas(
      "Não foi possível se comunicar com o Mercado Pago.",
      { statusHttp: 502, codigo: "MERCADO_PAGO_INDISPONIVEL" }
    )
  } finally {
    clearTimeout(timeout)
  }
}

function chaveIdempotenciaPreapproval(referenciaExterna: string): string {
  // A mesma referencia representa a mesma tentativa logica. O hash evita
  // expor o identificador local no header. O modo separa uma eventual chave
  // de teste da chave de producao mesmo quando a referencia local coincide.
  // Os 64 caracteres respeitam o limite conservador das APIs idempotentes.
  const configuracao = obterConfiguracaoObrigatoria()

  return createHash("sha256")
    .update(`servix:preapproval:${configuracao.modo}:${referenciaExterna}`)
    .digest("hex")
}

function validarRespostaComId(
  resposta: unknown,
  mensagem: string
): asserts resposta is { id: string } & ObjetoDesconhecido {
  if (!ehObjeto(resposta) || typeof resposta.id !== "string" || !resposta.id) {
    throw new ErroMercadoPagoAssinaturas(mensagem, {
      statusHttp: 502,
      codigo: "RESPOSTA_INVALIDA"
    })
  }
}

export async function criarPlanoAssinaturaMercadoPago(
  dados: CriarPlanoAssinaturaInput
): Promise<PlanoAssinaturaMercadoPago> {
  const reason = dados.reason.trim()

  if (reason.length < 3 || reason.length > 255) {
    throw new Error("O nome do plano deve possuir entre 3 e 255 caracteres.")
  }

  if (!Number.isFinite(dados.transactionAmount) || dados.transactionAmount <= 0) {
    throw new Error("O valor do plano deve ser maior que zero.")
  }

  const configuracao = obterConfiguracaoObrigatoria()
  const resposta = await requisitarMercadoPago<unknown>("/preapproval_plan", {
    method: "POST",
    body: {
      reason,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: dados.transactionAmount,
        currency_id: dados.currencyId
      },
      back_url: configuracao.backUrl
    }
  })

  validarRespostaComId(
    resposta,
    "O Mercado Pago criou o plano, mas retornou uma resposta inválida."
  )

  return resposta as PlanoAssinaturaMercadoPago
}

export async function criarAssinaturaMercadoPago(
  dados: CriarAssinaturaMercadoPagoInput
): Promise<AssinaturaMercadoPago> {
  const emailPagador = dados.emailPagador.trim().toLowerCase()
  const referenciaExterna = dados.referenciaExterna.trim()
  const backUrl = dados.backUrl.trim()

  if (!emailPagador || !emailPagador.includes("@")) {
    throw new Error("Informe um e-mail de pagador válido.")
  }

  if (!referenciaExterna) {
    throw new Error("A referência externa é obrigatória.")
  }

  if (
    !Number.isFinite(dados.transactionAmount) ||
    dados.transactionAmount <= 0
  ) {
    throw new Error("O valor da assinatura deve ser maior que zero.")
  }

  try {
    const url = new URL(backUrl)
    const local =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]"
    const partes = url.hostname.split(".").map(Number)
    const ipv4Privado =
      partes.length === 4 &&
      partes.every(parte => Number.isInteger(parte) && parte >= 0 && parte <= 255) &&
      (
        partes[0] === 10 ||
        (partes[0] === 172 && partes[1]! >= 16 && partes[1]! <= 31) ||
        (partes[0] === 192 && partes[1] === 168)
      )
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && (local || ipv4Privado))
    ) {
      throw new Error()
    }
  } catch {
    throw new Error("A URL de retorno da assinatura é inválida.")
  }

  const resposta = await requisitarMercadoPago<unknown>("/preapproval", {
    method: "POST",
    chaveIdempotencia: chaveIdempotenciaPreapproval(referenciaExterna),
    body: {
      reason: "Servix - Plano mensal",
      external_reference: referenciaExterna,
      payer_email: emailPagador,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: dados.transactionAmount,
        currency_id: dados.currencyId
      },
      back_url: backUrl,
      status: "pending"
    }
  })

  validarRespostaComId(
    resposta,
    "O Mercado Pago retornou uma assinatura inválida."
  )

  return resposta as AssinaturaMercadoPago
}

export async function obterAssinaturaMercadoPago(
  assinaturaId: string
): Promise<AssinaturaMercadoPago> {
  const id = assinaturaId.trim()
  if (!id) throw new Error("O ID da assinatura é obrigatório.")

  const resposta = await requisitarMercadoPago<unknown>(
    `/preapproval/${encodeURIComponent(id)}`,
    { method: "GET" }
  )

  validarRespostaComId(
    resposta,
    "O Mercado Pago retornou dados inválidos para a assinatura."
  )

  return resposta as AssinaturaMercadoPago
}

export async function cancelarAssinaturaMercadoPago(
  assinaturaId: string
): Promise<AssinaturaMercadoPago> {
  const id = assinaturaId.trim()
  if (!id) throw new Error("O ID da assinatura é obrigatório.")

  const resposta = await requisitarMercadoPago<unknown>(
    `/preapproval/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      body: {
        // A API de Preapproval aceita `cancelled` (grafia também usada pelo
        // SDK oficial), embora a documentação pública ainda mostre `canceled`.
        status: "cancelled"
      }
    }
  )

  validarRespostaComId(
    resposta,
    "O Mercado Pago retornou dados inválidos ao cancelar a assinatura."
  )

  return resposta as AssinaturaMercadoPago
}

export async function buscarAssinaturaPorReferenciaMercadoPago(
  referenciaExterna: string
): Promise<AssinaturaMercadoPago | null> {
  const referencia = referenciaExterna.trim()
  if (!referencia) return null

  const parametros = new URLSearchParams({
    q: referencia,
    limit: "20",
    offset: "0"
  })

  const resposta = await requisitarMercadoPago<BuscaAssinaturasMercadoPago>(
    `/preapproval/search?${parametros.toString()}`,
    { method: "GET" }
  )

  return (
    resposta.results?.find(
      assinatura => String(assinatura.external_reference) === referencia
    ) ?? null
  )
}

export async function obterPagamentoAutorizadoMercadoPago(
  pagamentoAutorizadoId: string
): Promise<PagamentoAutorizadoMercadoPago> {
  const id = pagamentoAutorizadoId.trim()
  if (!id) throw new Error("O ID da fatura recorrente é obrigatório.")

  const resposta = await requisitarMercadoPago<unknown>(
    `/authorized_payments/${encodeURIComponent(id)}`,
    { method: "GET" }
  )

  if (
    !ehObjeto(resposta) ||
    (typeof resposta.id !== "number" && typeof resposta.id !== "string")
  ) {
    throw new ErroMercadoPagoAssinaturas(
      "O Mercado Pago retornou dados inválidos para a fatura recorrente.",
      { statusHttp: 502, codigo: "RESPOSTA_INVALIDA" }
    )
  }

  return resposta as unknown as PagamentoAutorizadoMercadoPago
}
