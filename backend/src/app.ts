import cors from "cors"
import express, { type Request } from "express"
import rateLimit from "express-rate-limit"
import helmet from "helmet"

import { env } from "./config/env.js"
import { prisma } from "./lib/prisma.js"
import { autenticar } from "./middlewares/auth.middleware.js"
import { errorMiddleware } from "./middlewares/error.middleware.js"
import { exigirFinanceiroPreviewHabilitado } from "./middlewares/financeiro-preview.middleware.js"
import {assinaturasRoutes} from "./routes/assinaturas.routes.js"
import authRoutes from "./routes/auth.routes.js"
import clientesRoutes from "./routes/clientes.routes.js"
import cobrancasRoutes from "./routes/cobrancas.routes.js"
import configuracoesRoutes from "./routes/configuracoes.routes.js"
import dashboardRoutes from "./routes/dashboard.routes.js"
import financeiroRoutes from "./routes/financeiro.routes.js"
import ordensRoutes from "./routes/ordens.routes.js"
import ordensPublicasRoutes from "./routes/ordens-publicas.routes.js"
import orcamentosPublicosRoutes from "./routes/orcamentos-publicos.routes.js"
import orcamentosRoutes from "./routes/orcamentos.routes.js"
import empresaRouter from "./routes/empresa.routes.js"
import integracoesPublicasRoutes from "./routes/integracoes-publicas.routes.js"
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

const CAMINHO_WEBHOOK_ASSINATURAS =
  "/assinaturas/webhooks/mercado-pago"

function ehWebhookAssinaturas(req: Request): boolean {
  return (
    req.method === "POST" &&
    req.path.replace(/\/+$/, "") === CAMINHO_WEBHOOK_ASSINATURAS
  )
}

// Limite geral para reduzir abuso da API sem prejudicar o uso normal.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  // O Mercado Pago pode entregar rajadas de notificacoes para varias empresas
  // usando o mesmo IP. Esse endpoint possui um limite proprio logo abaixo.
  skip: ehWebhookAssinaturas,
  message: { erro: "Muitas requisições. Tente novamente mais tarde." }
})

// Mil notificacoes por minuto e por IP absorvem rajadas legitimas sem deixar o
// endpoint publico ilimitado. A assinatura criptografica ainda e validada pelo
// controller antes de qualquer evento ser persistido.
const webhookAssinaturasLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1_000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    erro: "Muitas notificacoes de assinatura. Tente novamente mais tarde."
  }
})

// O login recebe um limite menor para dificultar tentativas repetidas de senha.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de login. Tente novamente mais tarde." }
})

// Cadastro e ativacao publica criam ou liberam contas. Limites menores evitam
// automacao abusiva sem compartilhar estado com o OAuth ou com webhooks.
const onboardingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { erro: "Muitas tentativas. Tente novamente mais tarde." }
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
    return res.status(200).json({
      status: "ok",
      service: "servix-api",
      banco: "ok"
    })
  } catch {
    return res.status(503).json({
      status: "indisponivel",
      service: "servix-api",
      banco: "erro"
    })
  }
})

// O limitador específico deve ser registrado antes das rotas de autenticação.
// Clientes, ordens e usuários recebem autenticação antes dos routers.
// Os cabeçalhos entram antes do limiter global para também cobrirem respostas
// 429, que não chegam ao controller do acompanhamento.
app.use("/publico/ordens", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Robots-Tag", "noindex, nofollow")
  next()
})
app.post(CAMINHO_WEBHOOK_ASSINATURAS, webhookAssinaturasLimiter)
app.use(apiLimiter)
app.use("/auth/login", loginLimiter)
app.use("/empresa", onboardingLimiter)
app.use("/assinaturas/checkout", onboardingLimiter)
app.use("/integracoes", integracoesPublicasRoutes)
app.use("/auth", authRoutes)
app.use("/assinaturas", assinaturasRoutes)
app.use("/publico/orcamentos", orcamentosPublicosRoutes)
app.use("/publico/ordens", ordensPublicasRoutes)
app.use("/clientes", autenticar, clientesRoutes)
app.use("/cobrancas", autenticar, cobrancasRoutes)
app.use("/configuracoes", autenticar, configuracoesRoutes)
app.use("/dashboard", autenticar, dashboardRoutes)
app.use(
  "/preview/financeiro",
  exigirFinanceiroPreviewHabilitado,
  autenticar,
  financeiroRoutes
)
app.use("/orcamentos", autenticar, orcamentosRoutes)
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
