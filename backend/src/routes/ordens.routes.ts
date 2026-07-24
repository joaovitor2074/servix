import { Router } from "express"
import {
  alterarStatusOrdem,
  atualizarOrdem,
  buscarOrdem,
  listarHistoricoOrdem,
  listarOrdens,
  removerOrdem
} from "../controllers/ordens.controllers.js"
import pagamentosRoutes from "./pagamentos.routes.js"

// O middleware de autenticação é aplicado ao prefixo `/ordens` em app.ts.
const router = Router()

// O histórico vem antes de `/:id` para deixar explícita a rota mais específica.
router.get("/", listarOrdens)
router.post("/", (_req, res) => {
  res.status(405).json({
    erro: "A ordem deve ser criada a partir de um orçamento aprovado.",
    codigo: "ORDEM_EXIGE_ORCAMENTO_APROVADO"
  })
})
router.use("/:id/pagamentos", pagamentosRoutes)
router.get("/:id/historico", listarHistoricoOrdem)
router.get("/:id", buscarOrdem)
// PUT e PATCH compartilham a mesma atualização parcial neste estágio do projeto.
router.put("/:id", atualizarOrdem)
router.patch("/:id", atualizarOrdem)
router.patch("/:id/status", alterarStatusOrdem)
router.delete("/:id", removerOrdem)

export default router
