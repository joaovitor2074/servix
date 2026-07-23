import type { NextFunction, Request, Response } from "express"

import { buscarOrdemPublicaService } from "../services/ordens-publicas.service.js"

export function tokenAcompanhamentoEhInvalido(token: unknown): boolean {
  return (
    typeof token !== "string" ||
    token.trim().length < 16 ||
    token.length > 100
  )
}

export async function buscarOrdemPublicaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // O acompanhamento contém estado operacional e financeiro atual; ele nunca
    // deve ser servido de cache compartilhado ou reutilizado pelo navegador.
    res.setHeader("Cache-Control", "no-store")

    const token = req.params.token
    if (tokenAcompanhamentoEhInvalido(token)) {
      return res.status(400).json({
        erro: "Token inválido",
        codigo: "TOKEN_ACOMPANHAMENTO_INVALIDO"
      })
    }

    const tokenNormalizado = typeof token === "string" ? token.trim() : ""
    const ordem = await buscarOrdemPublicaService(tokenNormalizado)
    if (!ordem) {
      return res.status(404).json({
        erro: "Acompanhamento não encontrado",
        codigo: "ACOMPANHAMENTO_NAO_ENCONTRADO"
      })
    }

    return res.status(200).json(ordem)
  } catch (error) {
    return next(error)
  }
}
