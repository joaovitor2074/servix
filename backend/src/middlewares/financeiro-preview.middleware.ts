import type { NextFunction, Request, Response } from "express"

import { financeiroEmpresarialPreviewHabilitado } from "../config/env.js"
import {
  CABECALHO_CONFIRMACAO_FINANCEIRO_PREVIEW,
  VALOR_CONFIRMACAO_FINANCEIRO_PREVIEW
} from "../financeiro/financeiro-preview.js"

const METODOS_SOMENTE_LEITURA = new Set(["GET", "HEAD", "OPTIONS"])

export function exigirFinanceiroPreviewHabilitado(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (!financeiroEmpresarialPreviewHabilitado()) {
    return res.status(503).json({
      erro: "Financeiro empresarial em preview não está habilitado neste servidor",
      codigo: "FINANCEIRO_PREVIEW_DESABILITADO"
    })
  }

  return next()
}

// Este bloqueio e deliberadamente independente de NODE_ENV: ate em um servidor
// configurado incorretamente, nenhuma mutacao ocorre sem uma confirmacao de
// intencao enviada pelo cliente da preview.
export function protegerMutacaoFinanceiroPreview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  res.setHeader("X-Servix-Ambiente", "PREVIEW")
  res.setHeader("Cache-Control", "no-store")

  if (METODOS_SOMENTE_LEITURA.has(req.method)) {
    return next()
  }

  const confirmacao = req.get(CABECALHO_CONFIRMACAO_FINANCEIRO_PREVIEW)

  if (confirmacao !== VALOR_CONFIRMACAO_FINANCEIRO_PREVIEW) {
    return res.status(428).json({
      erro: "Confirmação explícita da preview financeira não informada",
      codigo: "FINANCEIRO_PREVIEW_CONFIRMACAO_OBRIGATORIA",
      detalhes: {
        cabecalho: CABECALHO_CONFIRMACAO_FINANCEIRO_PREVIEW,
        valor: VALOR_CONFIRMACAO_FINANCEIRO_PREVIEW
      }
    })
  }

  return next()
}
