import { Router } from "express"

import {
  callbackOAuthMercadoPagoController
} from "../controllers/mercado-pago-oauth.controllers.js"

const router = Router()

router.get("/mercado-pago/callback", callbackOAuthMercadoPagoController)

export default router
