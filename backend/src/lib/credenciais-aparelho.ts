import { AppError } from "../errors/app-error.js"
import {
  criptografarToken,
  descriptografarToken,
  validarChaveCriptografiaTokens
} from "./criptografia-tokens.js"

function obterChaveCredenciaisAparelho(): string {
  const chave = process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY?.trim()

  if (!validarChaveCriptografiaTokens(chave)) {
    throw new AppError(
      "A protecao de credenciais de aparelhos nao esta configurada.",
      503,
      "CREDENCIAIS_APARELHO_NAO_CONFIGURADAS"
    )
  }

  return chave!
}

function contexto(empresaId: number, ordemId: number): string {
  return `aparelho:empresa:${empresaId}:ordem:${ordemId}`
}

export function protegerCredencialAparelho(
  credencial: string,
  empresaId: number,
  ordemId: number
): string {
  try {
    return criptografarToken(
      credencial,
      obterChaveCredenciaisAparelho(),
      contexto(empresaId, ordemId)
    )
  } catch (error) {
    if (error instanceof AppError) throw error

    throw new AppError(
      "Nao foi possivel proteger a credencial do aparelho.",
      500,
      "CREDENCIAL_APARELHO_CRIPTOGRAFIA_FALHOU"
    )
  }
}

export function revelarCredencialAparelho(
  credencialCifrada: string,
  empresaId: number,
  ordemId: number
): string {
  try {
    return descriptografarToken(
      credencialCifrada,
      obterChaveCredenciaisAparelho(),
      contexto(empresaId, ordemId)
    )
  } catch (error) {
    if (error instanceof AppError) throw error

    throw new AppError(
      "Nao foi possivel acessar a credencial do aparelho.",
      500,
      "CREDENCIAL_APARELHO_DESCRIPTOGRAFIA_FALHOU"
    )
  }
}
