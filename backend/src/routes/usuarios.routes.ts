import { Router } from "express";
import {
    alterarAtivoUsuarioController,
    atualizarUsuarioController,
    buscarUsuarioController,
    criarUsuarioController,
    listarUsuariosController,
    redefinirSenhaUsuarioController
} from "../controllers/usuario.controller.js";
import { autorizar } from "../middlewares/auth.middleware.js";
import { PapelUsuario } from "../generated/prisma/enums.js";

// app.ts autentica todas as requisições de `/usuarios`. Aqui, `autorizar`
// acrescenta a regra de que apenas administradores gerenciam outras contas.
const router = Router()

router.post("/",autorizar(PapelUsuario.ADMIN),criarUsuarioController)
router.get( "/:id", autorizar(PapelUsuario.ADMIN),buscarUsuarioController)
router.get( "/", autorizar(PapelUsuario.ADMIN),listarUsuariosController)
router.patch("/:id/ativo", autorizar(PapelUsuario.ADMIN), alterarAtivoUsuarioController)
router.patch("/:id/senha", autorizar(PapelUsuario.ADMIN), redefinirSenhaUsuarioController)
router.patch("/:id", autorizar(PapelUsuario.ADMIN), atualizarUsuarioController)




export default router

