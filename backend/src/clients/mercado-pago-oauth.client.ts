const ENDPOINT_TOKEN = "https://api.mercadopago.com/oauth/token"

export type TokensOAuthMercadoPago = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  mercadoPagoUserId: string
  liveMode: boolean
}

export type CodigoErroClienteOAuthMercadoPago =
  | "TEMPO_LIMITE"
  | "INDISPONIVEL"
  | "RESPOSTA_REJEITADA"
  | "RESPOSTA_INVALIDA"

export class ErroClienteOAuthMercadoPago extends Error {
  readonly tentarNovamenteEmMs: number | undefined

  constructor(
    public readonly codigo: CodigoErroClienteOAuthMercadoPago,
    public readonly statusHttp?: number,
    public readonly erroProvedor?: string,
    tentarNovamenteEmMs?: number
  ) {
    super("Nao foi possivel concluir a autorizacao no Mercado Pago.")
    this.name = "ErroClienteOAuthMercadoPago"
    this.tentarNovamenteEmMs = tentarNovamenteEmMs
  }
}

export function falhaOAuthMercadoPagoEhDefinitiva(
  erro: unknown
): boolean {
  return erro instanceof ErroClienteOAuthMercadoPago && (
    erro.statusHttp === 400 ||
    erro.statusHttp === 401 ||
    erro.erroProvedor === "invalid_grant"
  )
}

type OpcoesClienteOAuthMercadoPago = {
  clientId: string
  clientSecret: string
  redirectUri: string
  timeoutMs?: number
  fetchImpl?: typeof globalThis.fetch
}

type ObjetoJson = Record<string, unknown>

function objeto(valor: unknown): ObjetoJson | null {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
    ? valor as ObjetoJson
    : null
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null
}

function erroSeguroDoProvedor(corpo: unknown): string | undefined {
  const codigo = texto(objeto(corpo)?.error)
  return codigo && /^[a-z0-9_-]{1,64}$/i.test(codigo) ? codigo : undefined
}

function esperaRetryAfter(valor: string | null): number | undefined {
  if (!valor) return undefined

  const segundos = Number(valor)
  if (Number.isFinite(segundos) && segundos >= 0) {
    return Math.min(5 * 60_000, Math.max(1000, Math.ceil(segundos * 1000)))
  }

  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return undefined
  return Math.min(5 * 60_000, Math.max(1000, data.getTime() - Date.now()))
}

function interpretarTokens(corpo: unknown): TokensOAuthMercadoPago {
  const json = objeto(corpo)
  const accessToken = texto(json?.access_token)
  const refreshToken = texto(json?.refresh_token)
  const expiresIn = json?.expires_in
  const userId = json?.user_id
  const scopes = new Set(texto(json?.scope)?.split(/\s+/) ?? [])
  const mercadoPagoUserId = typeof userId === "number" && Number.isSafeInteger(userId)
    ? String(userId)
    : texto(userId)

  if (
    !accessToken ||
    !refreshToken ||
    typeof expiresIn !== "number" ||
    !Number.isInteger(expiresIn) ||
    expiresIn <= 0 ||
    expiresIn > 366 * 24 * 60 * 60 ||
    !mercadoPagoUserId ||
    typeof json?.live_mode !== "boolean" ||
    !scopes.has("offline_access") ||
    !scopes.has("read") ||
    !scopes.has("write")
  ) {
    throw new ErroClienteOAuthMercadoPago("RESPOSTA_INVALIDA")
  }

  return {
    accessToken,
    refreshToken,
    expiresIn,
    mercadoPagoUserId,
    liveMode: json.live_mode
  }
}

export class MercadoPagoOAuthClient {
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof globalThis.fetch

  constructor(opcoes: OpcoesClienteOAuthMercadoPago) {
    this.clientId = opcoes.clientId
    this.clientSecret = opcoes.clientSecret
    this.redirectUri = opcoes.redirectUri
    this.timeoutMs = opcoes.timeoutMs ?? 8000
    this.fetchImpl = opcoes.fetchImpl ?? globalThis.fetch
  }

  private async solicitarTokens(
    parametros: Record<string, string>
  ): Promise<TokensOAuthMercadoPago> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    let resposta: Response

    try {
      resposta = await this.fetchImpl(ENDPOINT_TOKEN, {
        method: "POST",
        // O endpoint e fixo. Falhar em redirects evita encaminhar o segredo da
        // aplicacao ou o refresh token para um destino inesperado.
        redirect: "error",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          ...parametros
        }),
        signal: controller.signal
      })
    } catch {
      if (controller.signal.aborted) {
        throw new ErroClienteOAuthMercadoPago("TEMPO_LIMITE")
      }

      throw new ErroClienteOAuthMercadoPago("INDISPONIVEL")
    } finally {
      clearTimeout(timeout)
    }

    let corpo: unknown

    try {
      corpo = await resposta.json()
    } catch {
      throw new ErroClienteOAuthMercadoPago(
        resposta.ok ? "RESPOSTA_INVALIDA" : "RESPOSTA_REJEITADA",
        resposta.status
      )
    }

    if (!resposta.ok) {
      throw new ErroClienteOAuthMercadoPago(
        "RESPOSTA_REJEITADA",
        resposta.status,
        erroSeguroDoProvedor(corpo),
        resposta.status === 429
          ? esperaRetryAfter(resposta.headers.get("Retry-After"))
          : undefined
      )
    }

    return interpretarTokens(corpo)
  }

  trocarCodigoPorTokens(
    code: string,
    codeVerifier: string
  ): Promise<TokensOAuthMercadoPago> {
    return this.solicitarTokens({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier,
      // Esta etapa do Servix e deliberadamente sandbox. O Mercado Pago exige
      // este parametro para emitir a credencial de teste no authorization_code.
      test_token: "true"
    })
  }

  renovarTokens(refreshToken: string): Promise<TokensOAuthMercadoPago> {
    return this.solicitarTokens({
      grant_type: "refresh_token",
      refresh_token: refreshToken
    })
  }
}
