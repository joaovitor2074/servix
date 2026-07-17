import app from "./app.js"
import { env, obterJwtSecret } from "./config/env.js"
import { prisma } from "./lib/prisma.js"

obterJwtSecret()

const server = app.listen(env.port, () => {
  console.log(`Servidor rodando na porta ${env.port}`)
})

async function encerrar(sinal: string) {
  console.log(`${sinal} recebido. Encerrando servidor...`)

  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

process.once("SIGINT", () => void encerrar("SIGINT"))
process.once("SIGTERM", () => void encerrar("SIGTERM"))
