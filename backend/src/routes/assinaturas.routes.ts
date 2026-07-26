import { Router } from "express"
import { PapelUsuario } from "../generated/prisma/enums.js"
import {
  buscarAssinaturaAtualController,
  buscarCheckoutAssinaturaController,
  confirmarCheckoutAssinaturaController,
  iniciarAssinaturaController,
  listarPlanosAssinaturaController,
  sincronizarCheckoutAssinaturaController,
  sincronizarAssinaturaController,
  webhookAssinaturasMercadoPagoController
} from "../controllers/assinaturas.controllers.js"
import {
  autenticar,
  autorizar
} from "../middlewares/auth.middleware.js"

const assinaturasRoutes = Router()

// Catálogo público; não contém credenciais nem dados de clientes.
assinaturasRoutes.get(
  "/planos",
  listarPlanosAssinaturaController
)

assinaturasRoutes.post(
  "/webhooks/mercado-pago",
  webhookAssinaturasMercadoPagoController
)

// Pública
assinaturasRoutes.get(
  "/checkout/:token",
  buscarCheckoutAssinaturaController
)

// Pública
assinaturasRoutes.post(
  "/checkout/:token/confirmar",
  confirmarCheckoutAssinaturaController
)

assinaturasRoutes.post(
  "/checkout/:token/sincronizar",
  sincronizarCheckoutAssinaturaController
)

// Somente abaixo daqui exige JWT
assinaturasRoutes.use(autenticar)

assinaturasRoutes.get(
  "/atual",
  buscarAssinaturaAtualController
)

assinaturasRoutes.post(
  "/sincronizar",
  autorizar(PapelUsuario.ADMIN),
  sincronizarAssinaturaController
)

assinaturasRoutes.post(
  "/",
  autorizar(PapelUsuario.ADMIN),
  iniciarAssinaturaController
)

export { assinaturasRoutes }
