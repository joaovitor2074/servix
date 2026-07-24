import { Router } from "express"

import {
  desconectarMercadoPagoController,
  iniciarOAuthMercadoPagoController
} from "../controllers/mercado-pago-oauth.controllers.js"
import { PapelUsuario } from "../generated/prisma/enums.js"
import { autorizar } from "../middlewares/auth.middleware.js"

const router = Router()

router.post(
  "/oauth/iniciar",
  autorizar(PapelUsuario.ADMIN),
  iniciarOAuthMercadoPagoController
)
router.delete(
  "/",
  autorizar(PapelUsuario.ADMIN),
  desconectarMercadoPagoController
)

export default router
