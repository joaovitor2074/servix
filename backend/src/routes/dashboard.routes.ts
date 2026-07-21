import { Router } from "express"

import { buscarResumoDashboardController } from "../controllers/dashboard.controller.js"

// O middleware de autenticação é aplicado ao prefixo `/dashboard` em app.ts.
const router = Router()

// Rota final: GET /dashboard/resumo.
router.get("/resumo", buscarResumoDashboardController)

export default router
