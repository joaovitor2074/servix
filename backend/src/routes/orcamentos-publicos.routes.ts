import { Router } from "express"

import {
  aprovarOrcamentoPublico,
  buscarOrcamentoPublico,
  rejeitarOrcamentoPublico
} from "../controllers/orcamentos.controllers.js"

// Router publico: o token imprevisivel identifica o orcamento e nenhuma rota
// abaixo depende de req.auth.
const router = Router()

router.get("/:token", buscarOrcamentoPublico)
router.post("/:token/aprovar", aprovarOrcamentoPublico)
router.post("/:token/rejeitar", rejeitarOrcamentoPublico)

export default router
