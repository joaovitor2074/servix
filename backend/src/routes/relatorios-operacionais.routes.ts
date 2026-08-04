import { Router } from "express"
import { gerarRelatorioOperacional } from "../controllers/relatorios-operacionais.controllers.js"

const router = Router()
router.get("/operacional", gerarRelatorioOperacional)
export default router
