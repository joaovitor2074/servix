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

export type ModoPagamentosClientesMercadoPago =
  | "DESABILITADO"
  | "TESTE"

// O ambiente tecnico do Node nao determina se uma integracao financeira pode
// operar. Somente TESTE e reconhecido nesta etapa; valor ausente, invalido ou
// PRODUCAO mantem o gateway fechado.
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

// O simulador possui uma chave propria porque habilita-lo e uma decisao
// independente do sandbox OAuth do Mercado Pago.
export function gatewayPagamentoSimuladoHabilitado(): boolean {
  return process.env.SERVIX_PAYMENT_SIMULATOR_ENABLED
    ?.trim()
    .toLowerCase() === "true"
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

function redirectOAuthValido(valor: string): boolean {
  try {
    const url = new URL(valor)
    const local = url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]"
    return url.protocol === "https:" || (url.protocol === "http:" && local)
  } catch {
    return false
  }
}

// A consulta de disponibilidade nunca lanca nem revela qual segredo esta
// ausente. Assim o GET de configuracoes pode orientar a UI com seguranca.
export function obterConfiguracaoOAuthMercadoPago(): ConfiguracaoOAuthMercadoPago {
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID?.trim()
  const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET?.trim()
  const redirectUri = process.env.MERCADO_PAGO_REDIRECT_URI?.trim()
  const tokenEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY?.trim()
  const timeoutMs = lerTimeoutMercadoPago(process.env.MERCADO_PAGO_TIMEOUT_MS)

  if (!clientId && !clientSecret && !redirectUri && !tokenEncryptionKey) {
    return {
      status: "NAO_CONFIGURADA",
      motivo: "OAuth do Mercado Pago nao configurado no servidor.",
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
      motivo: "Revise a configuracao OAuth do Mercado Pago no servidor.",
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
  // Railway injeta PORT e precisa que o processo aceite conexoes externas.
  // Localmente preservamos o bind restrito a maquina do desenvolvedor.
  host: process.env.HOST?.trim() ||
    (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  port: lerPorta(process.env.PORT),
  corsOrigins: lerOrigens(process.env.CORS_ORIGINS),
  trustProxy: process.env.TRUST_PROXY === "true"
}

export function obterUrlFrontend(): string {
  const configurada = process.env.FRONTEND_URL?.trim()

  if (configurada && redirectOAuthValido(configurada)) {
    return configurada.replace(/\/$/, "")
  }

  return env.corsOrigins[0]?.replace(/\/$/, "") ?? "http://localhost:5173"
}

// O segredo é lido por função para que sua validação sempre seja aplicada.
export function obterJwtSecret(): string {
  const segredo = process.env.JWT_SECRET

  if (!segredo || segredo.length < 32) {
    throw new Error("JWT_SECRET deve possuir pelo menos 32 caracteres")
  }

  return segredo
}
