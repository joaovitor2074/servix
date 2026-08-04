import type { NextFunction, Request, Response } from "express"
import { gerarRelatorioOperacionalService } from "../services/relatorios-operacionais.service.js"
import { validarQueryRelatorioOperacional } from "../validators/relatorios.validators.js"

export async function gerarRelatorioOperacional(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarQueryRelatorioOperacional(req.query)
    if (!validacao.valido) return res.status(400).json({ erro: validacao.erro, detalhes: validacao.detalhes })
    return res.json(await gerarRelatorioOperacionalService(req.auth.empresaId, validacao.dados))
  } catch (error) { return next(error) }
}
