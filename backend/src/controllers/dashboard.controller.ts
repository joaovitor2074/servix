import type { NextFunction, Request, Response } from "express"

import { buscarResumoDashboardService } from "../services/dashboard.service.js"

// Recebe a empresa identificada pelo middleware de autenticação e devolve os
// indicadores que serão exibidos na página inicial do sistema.
export async function buscarResumoDashboardController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // O empresaId nunca vem do navegador. Usamos o valor confiável preenchido
    // em req.auth para manter o isolamento entre as empresas.
    const resumo = await buscarResumoDashboardService(req.auth.empresaId)

    return res.status(200).json(resumo)
  } catch (error) {
    // Erros inesperados seguem para o middleware global de tratamento.
    return next(error)
  }
}
