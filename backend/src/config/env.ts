import "./load-env.js"

function lerPorta(valor: string | undefined): number {
  const porta = Number(valor ?? 3005)

  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error("PORT deve ser um número inteiro entre 1 e 65535")
  }

  return porta
}

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

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: lerPorta(process.env.PORT),
  corsOrigins: lerOrigens(process.env.CORS_ORIGINS),
  trustProxy: process.env.TRUST_PROXY === "true"
}

export function obterJwtSecret(): string {
  const segredo = process.env.JWT_SECRET

  if (!segredo || segredo.length < 32) {
    throw new Error("JWT_SECRET deve possuir pelo menos 32 caracteres")
  }

  return segredo
}
