import "../config/load-env.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client.js"

// O Prisma usa a URL para criar o adaptador PostgreSQL. A aplicação interrompe
// a inicialização se a conexão não estiver configurada.
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL não configurada")
}

const adapter = new PrismaPg({
  connectionString
})

// Uma única instância compartilhada evita abrir um pool novo em cada service.
export const prisma = new PrismaClient({
  adapter
})
