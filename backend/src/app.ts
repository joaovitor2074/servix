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
import ordensRoutes from "./routes/ordens.routes.js"
import empresaRouter from "./routes/empresa.routes.js"
import usuariosRouter from "./routes/usuarios.routes.js"


const app = express()

if (env.trustProxy) {
  app.set("trust proxy", 1)
}

app.disable("x-powered-by")
app.use(helmet())
app.use(
  cors({
    origin(origin, callback) {
      const permitido = !origin || env.corsOrigins.includes(origin)
      callback(null, permitido)
    },
    credentials: true
  })
)
app.use(express.json({ limit: "100kb" }))

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Tente novamente mais tarde." }
})

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

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return res.status(200).json({ status: "ok", banco: "ok" })
  } catch {
    return res.status(503).json({ status: "indisponivel", banco: "erro" })
  }
})

app.use(apiLimiter)
app.use("/auth/login", loginLimiter)
app.use("/auth", authRoutes)
app.use("/clientes", autenticar, clientesRoutes)
app.use("/ordens", autenticar, ordensRoutes)
app.use("/empresa",empresaRouter)
app.use("/usuarios",autenticar,usuariosRouter)

app.use((_req, res) => {
  res.status(404).json({ erro: "Rota não encontrada" })
})

app.use(errorMiddleware)

export default app
