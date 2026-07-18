import { Router } from "express";

import { criarEmpresaController } from "../controllers/empresa.controller.js";

const router = Router()

router.post("/",criarEmpresaController)

export default router