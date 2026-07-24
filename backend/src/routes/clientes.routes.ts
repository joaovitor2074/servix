import { Router } from "express"

import {
  atualizarClienteController,
  buscarClienteController,
  criarClienteController,
  listarClientesController,
  removerClienteController
} from "../controllers/clientes.controllers.js"

// app.ts aplica `autenticar` antes deste router. Todos os controllers abaixo
// recebem `req.auth` e trabalham somente dentro da empresa autenticada.
const router = Router()

// Rotas mais específicas e operações CRUD do recurso cliente.
router.get("/", listarClientesController)
router.get("/:id", buscarClienteController)
router.post("/", criarClienteController)
router.put("/:id", atualizarClienteController)
router.delete("/:id", removerClienteController)

export default router
