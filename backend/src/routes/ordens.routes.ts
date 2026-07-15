import { Router } from "express"
import {
  alterarStatusOrdem,
  atualizarOrdem,
  buscarOrdem,
  criarOrdem,
  listarOrdens,
  removerOrdem
} from "../controllers/ordens.controllers.js"

const router = Router()

router.get("/", listarOrdens)
router.get("/:id", buscarOrdem)
router.post("/", criarOrdem)
router.put("/:id", atualizarOrdem)
router.patch("/:id/status", alterarStatusOrdem)
router.delete("/:id", removerOrdem)

export default router
