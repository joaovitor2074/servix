import "./load-env.js"

import { validarChaveCriptografiaTokens } from "../lib/criptografia-tokens.js"

// Converte PORT para número e impede o servidor de iniciar com uma porta
// inexistente ou fora do intervalo aceito pelo sistema operacional.
function lerPorta(valor: string | undefined): number {
  const porta = Number(valor ?? 3005)

  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error("PORT deve ser um número inteiro entre 1 e 65535")
  }

  return porta
}

// Transforma a variável separada por vírgulas em uma lista usada pelo CORS.
function lerOrigens(valor: string | undefined): string[] {
  const padrao = [
    "http://localhost:5173",
    "http://127.0.0.1:5173"
  ]

  if (!valor) {
    return padrao
  }

  return valor
    .split(",")
    .map(origem => origem.trim())
    .filter(Boolean)
}

function lerTimeoutMercadoPago(valor: string | undefined): number {
  const timeout = Number(valor ?? 8000)

  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 30000) {
    return 8000
  }

  return timeout
}

function redirectOAuthValido(valor: string): boolean {
  try {
    const url = new URL(valor)

    const local =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]"

    return url.protocol === "https:" || (url.protocol === "http:" && local)
  } catch {
    return false
  }
}

function urlPublicaHttpsValida(valor: string): boolean {
  try {
    const url = new URL(valor)

    const dominioLocal =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]"

    return (
      url.protocol === "https:" &&
      !dominioLocal &&
      Boolean(url.hostname)
    )
  } catch {
    return false
  }
}

function backUrlAssinaturasValida(valor: string): boolean {
  if (process.env.NODE_ENV === "production") {
    return urlPublicaHttpsValida(valor)
  }

  try {
    const url = new URL(valor)
    if (url.protocol === "https:") return true
    if (url.protocol !== "http:") return false

    const partes = url.hostname.split(".").map(Number)
    const ipv4Privado =
      partes.length === 4 &&
      partes.every(parte => Number.isInteger(parte) && parte >= 0 && parte <= 255) &&
      (
        partes[0] === 10 ||
        (partes[0] === 172 && partes[1]! >= 16 && partes[1]! <= 31) ||
        (partes[0] === 192 && partes[1] === 168)
      )

    return redirectOAuthValido(valor) || ipv4Privado
  } catch {
    return false
  }
}

export type ModoPagamentosClientesMercadoPago =
  | "DESABILITADO"
  | "TESTE"

// O ambiente técnico do Node não determina se uma integração financeira pode
// operar. Somente TESTE é reconhecido nesta etapa; valor ausente, inválido ou
// PRODUCAO mantém o gateway fechado.
export function obterModoPagamentosClientesMercadoPago():
  ModoPagamentosClientesMercadoPago {
  const modo = process.env.SERVIX_CUSTOMER_PAYMENTS_MP_MODE
    ?.trim()
    .toUpperCase()

  return modo === "TESTE" ? "TESTE" : "DESABILITADO"
}

export function pagamentosClientesMercadoPagoTesteHabilitados(): boolean {
  return obterModoPagamentosClientesMercadoPago() === "TESTE"
}

export type ModoAssinaturasMercadoPago =
  | "DESABILITADO"
  | "TESTE"

export type ConfiguracaoAssinaturasMercadoPago =
  | {
      status: "CONFIGURADA"
      modo: "TESTE"
      accessToken: string
      publicKey: string | null
      planId: string | null
      backUrl: string
      timeoutMs: number
    }
  | {
      status: "NAO_CONFIGURADA" | "ERRO"
      motivo: string
      timeoutMs: number
    }

// A integração de assinaturas começa fechada.
// Somente TESTE habilita as credenciais da conta Seller Test User.
export function obterModoAssinaturasMercadoPago():
  ModoAssinaturasMercadoPago {
  const modo = process.env.SERVIX_SUBSCRIPTIONS_MP_MODE
    ?.trim()
    .toUpperCase()

  return modo === "TESTE" ? "TESTE" : "DESABILITADO"
}

export function assinaturasMercadoPagoTesteHabilitadas(): boolean {
  return obterModoAssinaturasMercadoPago() === "TESTE"
}

// Retorna a configuração sem expor segredos.
// O planId pode ficar nulo até o plano ser criado.
export function obterConfiguracaoAssinaturasMercadoPago():
  ConfiguracaoAssinaturasMercadoPago {
  const timeoutMs = lerTimeoutMercadoPago(
    process.env.MERCADO_PAGO_TIMEOUT_MS
  )

  const modo = obterModoAssinaturasMercadoPago()

  if (modo === "DESABILITADO") {
    return {
      status: "NAO_CONFIGURADA",
      motivo: "Assinaturas do Mercado Pago estão desabilitadas.",
      timeoutMs
    }
  }

  const accessToken = process.env
    .MERCADO_PAGO_SUBSCRIPTIONS_ACCESS_TOKEN
    ?.trim()

  const publicKey = process.env
    .MERCADO_PAGO_SUBSCRIPTIONS_PUBLIC_KEY
    ?.trim() || null

  const planId = process.env
    .MERCADO_PAGO_SUBSCRIPTIONS_PLAN_ID
    ?.trim() || null

  const backUrl = process.env
    .MERCADO_PAGO_SUBSCRIPTIONS_BACK_URL
    ?.trim()

  if (
    !accessToken ||
    !backUrl ||
    !backUrlAssinaturasValida(backUrl)
  ) {
    return {
      status: "ERRO",
      motivo: "Revise a configuração de assinaturas do Mercado Pago.",
      timeoutMs
    }
  }

  return {
    status: "CONFIGURADA",
    modo,
    accessToken,
    publicKey,
    planId,
    backUrl: backUrl.replace(/\/$/, ""),
    timeoutMs
  }
}

// O simulador possui uma chave própria porque habilitá-lo é uma decisão
// independente do sandbox OAuth do Mercado Pago.
export function gatewayPagamentoSimuladoHabilitado(): boolean {
  return process.env.SERVIX_PAYMENT_SIMULATOR_ENABLED
    ?.trim()
    .toLowerCase() === "true"
}

export type ModoFinanceiroEmpresarial =
  | "DESABILITADO"
  | "PREVIEW"

// O financeiro empresarial possui uma chave fail-closed própria.
export function obterModoFinanceiroEmpresarial():
  ModoFinanceiroEmpresarial {
  return process.env.SERVIX_FINANCEIRO_MODE
    ?.trim()
    .toUpperCase() === "PREVIEW"
    ? "PREVIEW"
    : "DESABILITADO"
}

export function financeiroEmpresarialPreviewHabilitado(): boolean {
  return obterModoFinanceiroEmpresarial() === "PREVIEW"
}

export type ConfiguracaoOAuthMercadoPago =
  | {
      status: "CONFIGURADA"
      clientId: string
      clientSecret: string
      redirectUri: string
      tokenEncryptionKey: string
      timeoutMs: number
    }
  | {
      status: "NAO_CONFIGURADA" | "ERRO"
      motivo: string
      timeoutMs: number
    }

// A consulta de disponibilidade nunca lança nem revela qual segredo está
// ausente. Assim o GET de configurações pode orientar a UI com segurança.
export function obterConfiguracaoOAuthMercadoPago():
  ConfiguracaoOAuthMercadoPago {
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID?.trim()
  const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET?.trim()
  const redirectUri = process.env.MERCADO_PAGO_REDIRECT_URI?.trim()
  const tokenEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY?.trim()

  const timeoutMs = lerTimeoutMercadoPago(
    process.env.MERCADO_PAGO_TIMEOUT_MS
  )

  if (
    !clientId &&
    !clientSecret &&
    !redirectUri &&
    !tokenEncryptionKey
  ) {
    return {
      status: "NAO_CONFIGURADA",
      motivo: "OAuth do Mercado Pago não configurado no servidor.",
      timeoutMs
    }
  }

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !redirectOAuthValido(redirectUri) ||
    !tokenEncryptionKey ||
    !validarChaveCriptografiaTokens(tokenEncryptionKey)
  ) {
    return {
      status: "ERRO",
      motivo: "Revise a configuração OAuth do Mercado Pago no servidor.",
      timeoutMs
    }
  }

  return {
    status: "CONFIGURADA",
    clientId,
    clientSecret,
    redirectUri,
    tokenEncryptionKey,
    timeoutMs
  }
}

// Centralizar variáveis de ambiente evita leituras e conversões diferentes em
// cada arquivo da aplicação.
export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",

  // Railway injeta PORT e precisa que o processo aceite conexões externas.
  // Localmente preservamos o bind restrito à máquina do desenvolvedor.
  host:
    process.env.HOST?.trim() ||
    (
      process.env.NODE_ENV === "production"
        ? "0.0.0.0"
        : "127.0.0.1"
    ),

  port: lerPorta(process.env.PORT),
  corsOrigins: lerOrigens(process.env.CORS_ORIGINS),
  trustProxy: process.env.TRUST_PROXY === "true"
}

export function obterUrlFrontend(): string {
  const configurada = process.env.FRONTEND_URL?.trim()

  if (configurada && redirectOAuthValido(configurada)) {
    return configurada.replace(/\/$/, "")
  }

  return (
    env.corsOrigins[0]?.replace(/\/$/, "") ??
    "http://localhost:5173"
  )
}

// O segredo é lido por função para que sua validação sempre seja aplicada.
export function obterJwtSecret(): string {
  const segredo = process.env.JWT_SECRET

  if (!segredo || segredo.length < 32) {
    throw new Error("JWT_SECRET deve possuir pelo menos 32 caracteres")
  }

  return segredo
}
export function obterSegredoWebhookAssinaturasMercadoPago(): string {
  const segredo = process.env
    .MERCADO_PAGO_SUBSCRIPTIONS_WEBHOOK_SECRET
    ?.trim()

  if (!segredo) {
    throw new Error(
      "MERCADO_PAGO_SUBSCRIPTIONS_WEBHOOK_SECRET não foi configurado"
    )
  }

  return segredo
}
