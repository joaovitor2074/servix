import { Router } from "express"

import {
  atualizarConfiguracaoPagamentoController,
  buscarConfiguracaoPagamentoController
} from "../controllers/configuracoes-pagamento.controllers.js"
import {
  atualizarConfiguracaoWhatsApp,
  buscarConfiguracaoWhatsApp,
  testarConexaoWhatsApp
} from "../controllers/configuracoes-whatsapp.controllers.js"
import { PapelUsuario } from "../generated/prisma/enums.js"
import { autorizar } from "../middlewares/auth.middleware.js"
import mercadoPagoOAuthRoutes from "./mercado-pago-oauth.routes.js"

const router = Router()

router.get(
  "/pagamentos",
  autorizar(PapelUsuario.ADMIN),
  buscarConfiguracaoPagamentoController
)
router.patch(
  "/pagamentos",
  autorizar(PapelUsuario.ADMIN),
  atualizarConfiguracaoPagamentoController
)
router.use("/pagamentos/mercado-pago", mercadoPagoOAuthRoutes)

router.get(
  "/whatsapp",
  autorizar(PapelUsuario.ADMIN),
  buscarConfiguracaoWhatsApp
)
router.patch(
  "/whatsapp",
  autorizar(PapelUsuario.ADMIN),
  atualizarConfiguracaoWhatsApp
)
router.post(
  "/whatsapp/testar",
  autorizar(PapelUsuario.ADMIN),
  testarConexaoWhatsApp
)

export default router
