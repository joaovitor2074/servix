import { Router } from "express"

import {
  atualizarClienteController,
  buscarClienteController,
  criarClienteController,
  listarClientesController,
  removerClienteController
} from "../controllers/clientes.controllers.js"

const router = Router()

router.get("/", listarClientesController)
router.get("/:id", buscarClienteController)
router.post("/", criarClienteController)
router.put("/:id", atualizarClienteController)
router.delete("/:id", removerClienteController)

export default router