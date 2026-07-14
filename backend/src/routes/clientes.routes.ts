import { Router } from "express"
import {
  listarClientes,
  buscarCliente,
  criarCliente
} from "../controllers/clientes.controllers.js"

const router = Router()

router.get("/", listarClientes)
router.get("/:id", buscarCliente)

// Comente enquanto os controllers ainda não existem
router.post("/", criarCliente)
// router.put("/:id", atualizarCliente)
// router.delete("/:id", removerCliente)

export default router