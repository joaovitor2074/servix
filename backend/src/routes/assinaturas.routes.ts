import { Router } from "express"
import { PapelUsuario } from "../generated/prisma/enums.js"
import {
  buscarAssinaturaAtualController,
  buscarPainelAssinaturaController,
  buscarPortalAssinaturaController,
  buscarCheckoutAssinaturaController,
  cancelarAssinaturaController,
  confirmarCheckoutAssinaturaController,
  iniciarAssinaturaController,
  listarPlanosAssinaturaController,
  reativarAssinaturaController,
  reprocessarWebhookAssinaturaController,
  sincronizarCheckoutAssinaturaController,
  sincronizarAssinaturaController,
  webhookAssinaturasMercadoPagoController
} from "../controllers/assinaturas.controllers.js"
import {
  autenticar,
  autenticarRecuperacaoAssinatura,
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

// Recuperacao isolada: aceita ADMIN de empresa suspensa, mas nao abre nenhuma
// rota operacional do sistema.
assinaturasRoutes.get(
  "/recuperacao",
  autenticarRecuperacaoAssinatura,
  buscarPortalAssinaturaController
)

assinaturasRoutes.post(
  "/recuperacao/reativar",
  autenticarRecuperacaoAssinatura,
  reativarAssinaturaController
)

// Somente abaixo daqui exige JWT
assinaturasRoutes.use(autenticar)

assinaturasRoutes.get(
  "/atual",
  buscarAssinaturaAtualController
)

assinaturasRoutes.get(
  "/painel",
  autorizar(PapelUsuario.ADMIN),
  buscarPainelAssinaturaController
)

assinaturasRoutes.post(
  "/webhooks/:id/reprocessar",
  autorizar(PapelUsuario.ADMIN),
  reprocessarWebhookAssinaturaController
)

assinaturasRoutes.post(
  "/sincronizar",
  autorizar(PapelUsuario.ADMIN),
  sincronizarAssinaturaController
)

assinaturasRoutes.post(
  "/cancelar",
  autorizar(PapelUsuario.ADMIN),
  cancelarAssinaturaController
)

assinaturasRoutes.post(
  "/",
  autorizar(PapelUsuario.ADMIN),
  iniciarAssinaturaController
)

export { assinaturasRoutes }
