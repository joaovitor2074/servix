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

export type ModoMercadoPago =
  | "DESABILITADO"
  | "TESTE"
  | "PRODUCAO"

export type ModoPagamentosClientesMercadoPago = ModoMercadoPago

function lerModoMercadoPago(valor: string | undefined): ModoMercadoPago {
  const modo = valor?.trim().toUpperCase()
  return modo === "TESTE" || modo === "PRODUCAO"
    ? modo
    : "DESABILITADO"
}

function redirectOAuthMercadoPagoValido(valor: string): boolean {
  try {
    const url = new URL(valor)
    const hostname = url.hostname.toLowerCase()
    const loopback =
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]"

    return (
      url.protocol === "https:" &&
      !loopback &&
      !url.username &&
      !url.password &&
      !valor.includes("?") &&
      !valor.includes("#") &&
      url.pathname === "/integracoes/mercado-pago/callback"
    )
  } catch {
    return false
  }
}

// O ambiente técnico do Node não determina se uma integração financeira pode
// operar. Valor ausente ou invalido mantem o gateway fechado.
export function obterModoPagamentosClientesMercadoPago():
  ModoPagamentosClientesMercadoPago {
  return lerModoMercadoPago(
    process.env.SERVIX_CUSTOMER_PAYMENTS_MP_MODE
  )
}

export function pagamentosClientesMercadoPagoTesteHabilitados(): boolean {
  return obterModoPagamentosClientesMercadoPago() === "TESTE"
}

export function ambientePagamentosClientesMercadoPago():
  "TESTE" | "PRODUCAO" | null {
  const modo = obterModoPagamentosClientesMercadoPago()
  return modo === "DESABILITADO" ? null : modo
}

export type ModoAssinaturasMercadoPago = ModoMercadoPago

export type ConfiguracaoAssinaturasMercadoPago =
  | {
      status: "CONFIGURADA"
      modo: "TESTE" | "PRODUCAO"
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

// A integracao de assinaturas comeca fechada e seleciona credenciais por modo.
export function obterModoAssinaturasMercadoPago():
  ModoAssinaturasMercadoPago {
  return lerModoMercadoPago(
    process.env.SERVIX_SUBSCRIPTIONS_MP_MODE
  )
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

  const modoBilling = process.env.SERVIX_BILLING_MODE
    ?.trim()
    .toUpperCase()

  if (modoBilling !== modo) {
    return {
      status: "ERRO",
      motivo: "Os modos do billing e das assinaturas Mercado Pago nao coincidem.",
      timeoutMs
    }
  }

  const prefixo = `MERCADO_PAGO_SUBSCRIPTIONS_${modo}`
  const legadoTeste = modo === "TESTE"

  const accessToken = (
    process.env[`${prefixo}_ACCESS_TOKEN`] ??
    (legadoTeste
      ? process.env.MERCADO_PAGO_SUBSCRIPTIONS_ACCESS_TOKEN
      : undefined)
  )?.trim()

  const publicKey = (
    process.env[`${prefixo}_PUBLIC_KEY`] ??
    (legadoTeste
      ? process.env.MERCADO_PAGO_SUBSCRIPTIONS_PUBLIC_KEY
      : undefined)
  )?.trim() || null

  const planId = (
    process.env[`${prefixo}_PLAN_ID`] ??
    (legadoTeste
      ? process.env.MERCADO_PAGO_SUBSCRIPTIONS_PLAN_ID
      : undefined)
  )?.trim() || null

  const backUrl = (
    process.env[`${prefixo}_BACK_URL`] ??
    (legadoTeste
      ? process.env.MERCADO_PAGO_SUBSCRIPTIONS_BACK_URL
      : undefined)
  )?.trim()

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
      modo: "TESTE" | "PRODUCAO"
      liveModeEsperado: boolean
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
  const modo = obterModoPagamentosClientesMercadoPago()

  if (modo === "DESABILITADO") {
    return {
      status: "NAO_CONFIGURADA",
      motivo: "OAuth do Mercado Pago esta desabilitado.",
      timeoutMs: lerTimeoutMercadoPago(process.env.MERCADO_PAGO_TIMEOUT_MS)
    }
  }

  const prefixo = `MERCADO_PAGO_OAUTH_${modo}`
  const clientId = process.env[`${prefixo}_CLIENT_ID`]?.trim()
  const clientSecret = process.env[`${prefixo}_CLIENT_SECRET`]?.trim()
  const redirectUri = process.env[`${prefixo}_REDIRECT_URI`]?.trim()
  const tokenEncryptionKey = process.env[
    `${prefixo}_TOKEN_ENCRYPTION_KEY`
  ]?.trim()

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
    !redirectOAuthMercadoPagoValido(redirectUri) ||
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
    modo,
    liveModeEsperado: modo === "PRODUCAO",
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

export function obterConfiguracaoWhatsAppServidor() {
  const chave = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY?.trim()
  const versaoRecebida = process.env.WHATSAPP_GRAPH_API_VERSION?.trim()
  const graphApiVersion = versaoRecebida && /^v\d+\.\d+$/.test(versaoRecebida)
    ? versaoRecebida
    : "v25.0"

  return {
    graphApiVersion,
    tokenEncryptionKey:
      chave && validarChaveCriptografiaTokens(chave) ? chave : null,
    timeoutMs: 10_000
  }
}
export function obterSegredoWebhookAssinaturasMercadoPago(): string {
  const modo = obterModoAssinaturasMercadoPago()

  if (modo === "DESABILITADO") {
    throw new Error("Webhooks de assinaturas do Mercado Pago estao desabilitados")
  }

  if (process.env.SERVIX_BILLING_MODE?.trim().toUpperCase() !== modo) {
    throw new Error("Os modos do billing e do webhook Mercado Pago nao coincidem")
  }

  const segredo = (
    process.env[`MERCADO_PAGO_SUBSCRIPTIONS_${modo}_WEBHOOK_SECRET`] ??
    (modo === "TESTE"
      ? process.env.MERCADO_PAGO_SUBSCRIPTIONS_WEBHOOK_SECRET
      : undefined)
  )?.trim()

  if (!segredo) {
    throw new Error(
      `MERCADO_PAGO_SUBSCRIPTIONS_${modo}_WEBHOOK_SECRET nao foi configurado`
    )
  }

  return segredo
}
