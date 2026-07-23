import type { NextFunction, Request, Response } from "express"

import {
  buscarCobrancaPublicaService,
  criarCobrancaPublicaService
} from "../services/cobrancas.service.js"
import { validarChaveIdempotenciaPublica } from "../validators/cobrancas.validators.js"
import { tokenOrcamentoEhInvalido } from "../validators/orcamentos.validators.js"

function normalizarToken(req: Request, res: Response): string | null {
  const token = req.params.token

  if (tokenOrcamentoEhInvalido(token)) {
    res.status(400).json({
      erro: "Token invalido",
      codigo: "TOKEN_ORCAMENTO_INVALIDO"
    })
    return null
  }

  return typeof token === "string" ? token.trim() : null
}

export async function buscarCobrancaPublicaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    res.setHeader("Cache-Control", "no-store")
    const token = normalizarToken(req, res)
    if (!token) return

    const resultado = await buscarCobrancaPublicaService(token)

    if (!resultado.encontrado) {
      return res.status(404).json({
        erro: "Orcamento nao encontrado",
        codigo: "ORCAMENTO_NAO_ENCONTRADO"
      })
    }

    if (!resultado.cobranca) {
      return res.status(204).send()
    }

    return res.status(200).json(resultado.cobranca)
  } catch (error) {
    return next(error)
  }
}

export async function criarCobrancaPublicaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    res.setHeader("Cache-Control", "no-store")
    const token = normalizarToken(req, res)
    if (!token) return

    const validacao = validarChaveIdempotenciaPublica(
      req.get("Idempotency-Key")
    )

    if (!validacao.valido) {
      return res.status(400).json({
        erro: "Informe uma chave Idempotency-Key valida.",
        codigo: "CHAVE_IDEMPOTENCIA_INVALIDA",
        detalhes: validacao.detalhes
      })
    }

    const resultado = await criarCobrancaPublicaService(
      token,
      validacao.dados
    )

    if (!resultado.sucesso) {
      if (resultado.motivo === "orcamento_nao_encontrado") {
        return res.status(404).json({
          erro: "Orcamento nao encontrado",
          codigo: "ORCAMENTO_NAO_ENCONTRADO"
        })
      }

      if (resultado.motivo === "chave_idempotencia_em_uso") {
        return res.status(409).json({
          erro: "A chave de idempotencia ja foi usada em outra cobranca.",
          codigo: "CHAVE_IDEMPOTENCIA_EM_USO"
        })
      }

      if (resultado.motivo === "forma_pagamento_nao_pix") {
        return res.status(409).json({
          erro: "Este orcamento nao foi aprovado com pagamento por Pix.",
          codigo: "FORMA_PAGAMENTO_NAO_PIX"
        })
      }

      if (resultado.motivo === "orcamento_nao_aprovado") {
        return res.status(409).json({
          erro: "A cobranca exige um orcamento aprovado.",
          codigo: "COBRANCA_EXIGE_ORCAMENTO_APROVADO"
        })
      }

      if (resultado.motivo === "sem_saldo_para_cobranca") {
        return res.status(409).json({
          erro: "Nao existe saldo disponivel para uma nova cobranca.",
          codigo: "COBRANCA_SEM_SALDO"
        })
      }

      return res.status(409).json({
        erro: "O pagamento por Pix nao esta disponivel no momento.",
        codigo: "PIX_INDISPONIVEL"
      })
    }

    res.setHeader(
      "Idempotency-Replayed",
      resultado.reutilizada ? "true" : "false"
    )
    return res
      .status(resultado.reutilizada ? 200 : 201)
      .json(resultado.cobranca)
  } catch (error) {
    return next(error)
  }
}
