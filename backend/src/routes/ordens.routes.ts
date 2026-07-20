import { Router } from "express"
import {
  alterarStatusOrdem,
  atualizarOrdem,
  buscarOrdem,
  criarOrdem,
  listarHistoricoOrdem,
  listarOrdens,
  removerOrdem
} from "../controllers/ordens.controllers.js"

// O middleware de autenticação é aplicado ao prefixo `/ordens` em app.ts.
const router = Router()

// O histórico vem antes de `/:id` para deixar explícita a rota mais específica.
router.get("/", listarOrdens)
router.get("/:id/historico", listarHistoricoOrdem)
router.get("/:id", buscarOrdem)
router.post("/", criarOrdem)
// PUT e PATCH compartilham a mesma atualização parcial neste estágio do projeto.
router.put("/:id", atualizarOrdem)
router.patch("/:id", atualizarOrdem)
router.patch("/:id/status", alterarStatusOrdem)
router.delete("/:id", removerOrdem)

export default router
