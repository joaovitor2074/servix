import type { NextFunction, Request, Response } from "express"

import { criarEmpresaService } from "../services/empresa.service.js"
import { validarCriacaoEmpresa } from "../validators/empresa.validators.js"

// Cadastra empresa e administrador inicial. O service executa a criação
// relacionada, enquanto o controller cuida da validação e da resposta HTTP.
export async function criarEmpresaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarCriacaoEmpresa(req.body)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const empresa = await criarEmpresaService(validacao.dados)

    return res.status(201).json(empresa)
  } catch (error) {
    return next(error)
  }
}
