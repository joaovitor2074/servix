import type { NextFunction, Request, Response } from "express"

import {
  autenticarUsuarioService,
  buscarUsuarioAutenticadoService
} from "../services/auth.service.js"
import { validarLogin } from "../validators/auth.validators.js"

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarLogin(req.body)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await autenticarUsuarioService(validacao.dados)

    if (!resultado) {
      return res.status(401).json({
        erro: "Empresa, e-mail ou senha inválidos"
      })
    }

    return res.status(200).json(resultado)
  } catch (error) {
    return next(error)
  }
}

export async function usuarioAtualController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const usuario = await buscarUsuarioAutenticadoService(
      req.auth.usuarioId,
      req.auth.empresaId
    )

    if (!usuario) {
      return res.status(401).json({ erro: "Usuário não autorizado" })
    }

    return res.status(200).json(usuario)
  } catch (error) {
    return next(error)
  }
}
