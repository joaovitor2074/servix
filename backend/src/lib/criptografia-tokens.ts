import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto"

const ALGORITMO = "aes-256-gcm"
const VERSAO = "v1"
const TAMANHO_IV = 12
const TAMANHO_CHAVE = 32

export class ErroCriptografiaTokens extends Error {
  constructor() {
    super("Nao foi possivel proteger a credencial de pagamento.")
    this.name = "ErroCriptografiaTokens"
  }
}

export function validarChaveCriptografiaTokens(
  chaveBase64: string | undefined
): boolean {
  if (!chaveBase64) return false

  const valor = chaveBase64.trim()

  try {
    const chave = Buffer.from(valor, "base64")
    return chave.length === TAMANHO_CHAVE && chave.toString("base64") === valor
  } catch {
    return false
  }
}

function obterChave(chaveBase64: string): Buffer {
  if (!validarChaveCriptografiaTokens(chaveBase64)) {
    throw new ErroCriptografiaTokens()
  }

  return Buffer.from(chaveBase64.trim(), "base64")
}

function dadosAssociados(contexto: string): Buffer {
  return Buffer.from(`servix:credencial:${VERSAO}:${contexto}`, "utf8")
}

function decodificarBase64Url(valor: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(valor)) {
    throw new ErroCriptografiaTokens()
  }

  const buffer = Buffer.from(valor, "base64url")

  // Rejeita representacoes nao canonicas que decodificariam para os mesmos
  // bytes ao alterar apenas bits de preenchimento do ultimo caractere.
  if (buffer.toString("base64url") !== valor) {
    throw new ErroCriptografiaTokens()
  }

  return buffer
}

export function criptografarToken(
  token: string,
  chaveBase64: string,
  contexto: string
): string {
  if (!token || !contexto) {
    throw new ErroCriptografiaTokens()
  }

  try {
    const iv = randomBytes(TAMANHO_IV)
    const cipher = createCipheriv(ALGORITMO, obterChave(chaveBase64), iv)
    cipher.setAAD(dadosAssociados(contexto))
    const conteudo = Buffer.concat([
      cipher.update(token, "utf8"),
      cipher.final()
    ])
    const tag = cipher.getAuthTag()

    return [
      VERSAO,
      iv.toString("base64url"),
      tag.toString("base64url"),
      conteudo.toString("base64url")
    ].join(".")
  } catch (error) {
    if (error instanceof ErroCriptografiaTokens) throw error
    throw new ErroCriptografiaTokens()
  }
}

export function descriptografarToken(
  tokenCriptografado: string,
  chaveBase64: string,
  contexto: string
): string {
  try {
    const [versao, ivRecebido, tagRecebida, conteudoRecebido, extra] =
      tokenCriptografado.split(".")

    if (
      versao !== VERSAO ||
      !ivRecebido ||
      !tagRecebida ||
      !conteudoRecebido ||
      extra !== undefined ||
      !contexto
    ) {
      throw new ErroCriptografiaTokens()
    }

    const iv = decodificarBase64Url(ivRecebido)
    const tag = decodificarBase64Url(tagRecebida)
    const conteudo = decodificarBase64Url(conteudoRecebido)

    if (iv.length !== TAMANHO_IV || tag.length !== 16 || conteudo.length === 0) {
      throw new ErroCriptografiaTokens()
    }

    const decipher = createDecipheriv(ALGORITMO, obterChave(chaveBase64), iv)
    decipher.setAAD(dadosAssociados(contexto))
    decipher.setAuthTag(tag)

    return Buffer.concat([
      decipher.update(conteudo),
      decipher.final()
    ]).toString("utf8")
  } catch (error) {
    if (error instanceof ErroCriptografiaTokens) throw error
    throw new ErroCriptografiaTokens()
  }
}
