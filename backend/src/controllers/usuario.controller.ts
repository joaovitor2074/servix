import type { NextFunction, Request, Response } from "express";

import { criarUsuarioService } from "../services/usuario.service.js";
import { validarCriacaoUsuario } from "../validators/usuario.validator.js";
export async function criarUsuarioController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const validacao = validarCriacaoUsuario(req.body)

        if (!validacao.valido) {
            return res.status(400).json({
                erro: validacao.erro,
                detalhes: validacao.detalhes
            })
        }

        const usuario = await criarUsuarioService(req.auth.empresaId,validacao.dados)

        return res.status(201).json(usuario)

    }catch(error){
        return next(error)
    }
}




