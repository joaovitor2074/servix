import { Prisma } from "../generated/prisma/client.js"

// Faz o narrowing de `unknown` e compara um código conhecido do Prisma, como
// P2002 (valor único duplicado) ou P2025 (registro não encontrado).
export function erroPrismaPossuiCodigo(
  error: unknown,
  codigo: string
): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === codigo
  )
}

// Alguns erros de chave estrangeira chegam diretamente pelo Prisma; outros
// podem estar encapsulados pelo adaptador PostgreSQL em `cause`.
export function erroDeChaveEstrangeira(error: unknown): boolean {
  if (erroPrismaPossuiCodigo(error, "P2003")) {
    return true
  }

  if (typeof error !== "object" || error === null || !("cause" in error)) {
    return false
  }

  const cause = error.cause

  if (typeof cause !== "object" || cause === null) {
    return false
  }

  const codigo =
    "originalCode" in cause && typeof cause.originalCode === "string"
      ? cause.originalCode
      : "code" in cause && typeof cause.code === "string"
        ? cause.code
        : null

  return codigo === "23001" || codigo === "23503"
}
