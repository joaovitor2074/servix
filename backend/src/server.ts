import app from "./app.js"
import { env, obterJwtSecret } from "./config/env.js"
import { prisma } from "./lib/prisma.js"

// Falha imediatamente na inicialização caso o segredo JWT esteja ausente ou
// fraco, em vez de descobrir o problema apenas na primeira tentativa de login.
obterJwtSecret()

// Este é o ponto de entrada usado por `npm run dev` e pelo build de produção.
const server = app.listen(env.port, env.host, () => {
  console.log(`Servidor rodando em http://${env.host}:${env.port}`)
})

// Encerra o servidor de forma controlada e libera a conexão com o banco.
async function encerrar(sinal: string) {
  console.log(`${sinal} recebido. Encerrando servidor...`)

  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

// SIGINT normalmente vem de Ctrl+C; SIGTERM é comum em containers e serviços.
process.once("SIGINT", () => void encerrar("SIGINT"))
process.once("SIGTERM", () => void encerrar("SIGTERM"))
