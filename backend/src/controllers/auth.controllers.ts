import type { NextFunction, Request, Response } from "express"

import {
  autenticarUsuarioService,
  buscarUsuarioAutenticadoService
} from "../services/auth.service.js"
import { validarLogin } from "../validators/auth.validators.js"

// Controllers traduzem HTTP para a camada de negócio: leem a requisição,
// validam a entrada, chamam um service e escolhem o status da resposta.

// Valida as credenciais e devolve 400 para formato inválido, 401 para
// credenciais incorretas ou 200 com token e dados básicos do usuário.
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

// Retorna os dados atuais do usuário identificado pelo middleware `autenticar`.
// A busca inclui empresaId para manter o isolamento entre empresas.
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
