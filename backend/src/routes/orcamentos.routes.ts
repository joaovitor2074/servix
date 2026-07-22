import { Router } from "express"

import {
  alterarStatusOrcamento,
  atualizarOrcamento,
  buscarOrcamento,
  criarOrcamento,
  listarOrcamentos,
  transformarOrcamentoEmOrdem
} from "../controllers/orcamentos.controllers.js"

// O middleware de autenticacao deve ser aplicado ao prefixo /orcamentos.
const router = Router()

router.get("/", listarOrcamentos)
router.post("/", criarOrcamento)
router.patch("/:id/status", alterarStatusOrcamento)
router.post("/:id/transformar-em-ordem", transformarOrcamentoEmOrdem)
router.get("/:id", buscarOrcamento)
router.patch("/:id", atualizarOrcamento)

export default router
