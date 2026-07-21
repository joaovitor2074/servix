import cors from "cors"
import express from "express"
import rateLimit from "express-rate-limit"
import helmet from "helmet"

import { env } from "./config/env.js"
import { prisma } from "./lib/prisma.js"
import { autenticar } from "./middlewares/auth.middleware.js"
import { errorMiddleware } from "./middlewares/error.middleware.js"
import authRoutes from "./routes/auth.routes.js"
import clientesRoutes from "./routes/clientes.routes.js"
import dashboardRoutes from "./routes/dashboard.routes.js"
import ordensRoutes from "./routes/ordens.routes.js"
import empresaRouter from "./routes/empresa.routes.js"
import usuariosRouter from "./routes/usuarios.routes.js"

// Este arquivo monta a aplicação Express, mas não abre a porta HTTP. Essa
// separação permite importar `app` nos testes sem iniciar um servidor real.
const app = express()

// Quando a API está atrás de um proxy confiável, essa opção faz o Express usar
// corretamente informações como o IP original da requisição.
if (env.trustProxy) {
  app.set("trust proxy", 1)
}

// Middlewares globais de segurança, CORS e leitura do corpo JSON.
app.disable("x-powered-by")
app.use(helmet())
app.use(
  cors({
    origin(origin, callback) {
      // Requisições sem Origin incluem ferramentas locais e comunicação entre
      // servidores. No navegador, a origem precisa estar na lista configurada.
      const permitido = !origin || env.corsOrigins.includes(origin)
      callback(null, permitido)
    },
    credentials: true
  })
)
app.use(express.json({ limit: "100kb" }))

// Limite geral para reduzir abuso da API sem prejudicar o uso normal.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Tente novamente mais tarde." }
})

// O login recebe um limite menor para dificultar tentativas repetidas de senha.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de login. Tente novamente mais tarde." }
})

app.get("/", (_req, res) => {
  res.json({
    nome: "Servix API",
    status: "online"
  })
})

// O health check também consulta o banco; assim ele detecta quando o processo
// está funcionando, mas o PostgreSQL está indisponível.
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return res.status(200).json({ status: "ok", banco: "ok" })
  } catch {
    return res.status(503).json({ status: "indisponivel", banco: "erro" })
  }
})

// O limitador específico deve ser registrado antes das rotas de autenticação.
// Clientes, ordens e usuários recebem autenticação antes dos routers.
app.use(apiLimiter)
app.use("/auth/login", loginLimiter)
app.use("/auth", authRoutes)
app.use("/clientes", autenticar, clientesRoutes)
app.use("/dashboard", autenticar, dashboardRoutes)
app.use("/ordens", autenticar, ordensRoutes)
app.use("/empresa",empresaRouter)
app.use("/usuarios",autenticar,usuariosRouter)

// Uma rota que não foi reconhecida chega a este fallback.
app.use((_req, res) => {
  res.status(404).json({ erro: "Rota não encontrada" })
})

// O middleware de erro precisa ser o último da cadeia do Express.
app.use(errorMiddleware)

export default app
