import { Router } from "express"

import {
  estornarPagamentoController,
  listarPagamentosController,
  registrarPagamentoController
} from "../controllers/pagamentos.controllers.js"

// Este router deve ser montado em `/ordens/:id/pagamentos`. O mergeParams
// preserva o ID da ordem definido pelo router pai.
const router = Router({ mergeParams: true })

router.get("/", listarPagamentosController)
router.post("/", registrarPagamentoController)
router.post("/:pagamentoId/estorno", estornarPagamentoController)

export default router
