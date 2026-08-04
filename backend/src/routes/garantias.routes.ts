import { Router } from "express"
import { PapelUsuario } from "../generated/prisma/enums.js"
import { acionarGarantia, buscarGarantia, cancelarGarantia, listarGarantias } from "../controllers/garantias.controllers.js"
import { autorizar } from "../middlewares/auth.middleware.js"

const router = Router()
router.get("/", listarGarantias)
router.get("/:id", buscarGarantia)
router.patch("/:id/acionar", autorizar(PapelUsuario.ADMIN, PapelUsuario.TECNICO), acionarGarantia)
router.patch("/:id/cancelar", autorizar(PapelUsuario.ADMIN), cancelarGarantia)
export default router
