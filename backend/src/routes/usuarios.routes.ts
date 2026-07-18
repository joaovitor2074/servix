import { Router } from "express";
import { criarUsuarioController } from "../controllers/usuario.controller.js";
import { autorizar } from "../middlewares/auth.middleware.js";
import { PapelUsuario } from "../generated/prisma/enums.js";
const router = Router()

router.post("/",autorizar(PapelUsuario.ADMIN),criarUsuarioController)

export default router

