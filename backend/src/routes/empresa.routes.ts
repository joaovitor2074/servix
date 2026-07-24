import { Router } from "express";

import { criarEmpresaController } from "../controllers/empresa.controller.js";

// A criação de empresa é pública porque também cria o primeiro administrador.
// Proteções adicionais, como confirmação de e-mail, podem ser adicionadas aqui.
const router = Router()

router.post("/",criarEmpresaController)

export default router
