import { Router } from "express"

import {
  buscarCheckoutAssinaturaController,
  confirmarAssinaturaTesteController,
  listarPlanosServixController
} from "../controllers/assinaturas.controllers.js"

const router = Router()

router.use("/checkout", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Robots-Tag", "noindex, nofollow")
  next()
})

router.get("/planos", listarPlanosServixController)
router.get("/checkout/:token", buscarCheckoutAssinaturaController)
router.post("/checkout/:token/confirmar", confirmarAssinaturaTesteController)

export default router
