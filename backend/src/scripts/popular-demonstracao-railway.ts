import "../config/load-env.js"

const databasePublicUrl = process.env.DATABASE_PUBLIC_URL?.trim()

if (!databasePublicUrl) {
  throw new Error("DATABASE_PUBLIC_URL nao configurada")
}

// `railway run` acontece na maquina local e nao alcanca o hostname privado do
// PostgreSQL. O proxy publico e usado somente neste processo administrativo.
process.env.DATABASE_URL = databasePublicUrl

await import("./popular-demonstracao.js")
