import type { NextFunction, Request, Response } from "express"

import {
  buscarCheckoutAssinaturaService,
  confirmarAssinaturaTesteService,
  listarPlanosServixService
} from "../billing/assinaturas.service.js"
import {
  validarConfirmacaoAssinaturaTeste,
  validarTokenCheckout
} from "../validators/assinaturas.validators.js"

export function listarPlanosServixController(_req: Request, res: Response) {
  return res.status(200).json(listarPlanosServixService())
}

export async function buscarCheckoutAssinaturaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = validarTokenCheckout(req.params.token)

    if (!token.valido) {
      return res.status(400).json({
        erro: "Checkout invalido",
        codigo: "CHECKOUT_ASSINATURA_INVALIDO"
      })
    }

    const checkout = await buscarCheckoutAssinaturaService(token.dados)

    if (!checkout) {
      return res.status(404).json({
        erro: "Checkout nao encontrado",
        codigo: "CHECKOUT_ASSINATURA_NAO_ENCONTRADO"
      })
    }

    return res.status(200).json(checkout)
  } catch (error) {
    return next(error)
  }
}

export async function confirmarAssinaturaTesteController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = validarTokenCheckout(req.params.token)
    const corpo = validarConfirmacaoAssinaturaTeste(req.body)

    if (!token.valido || !corpo.valido) {
      return res.status(400).json({
        erro: "Confirmacao de teste invalida",
        codigo: "CONFIRMACAO_ASSINATURA_INVALIDA"
      })
    }

    const resultado = await confirmarAssinaturaTesteService(token.dados)

    if (!resultado.sucesso) {
      if (resultado.motivo === "nao_encontrada") {
        return res.status(404).json({
          erro: "Checkout nao encontrado",
          codigo: "CHECKOUT_ASSINATURA_NAO_ENCONTRADO"
        })
      }

      if (resultado.motivo === "billing_bloqueado") {
        return res.status(503).json({
          erro: "Assinaturas de teste nao estao habilitadas neste ambiente.",
          codigo: "BILLING_SERVIX_BLOQUEADO"
        })
      }

      return res.status(409).json({
        erro: "A assinatura nao pode ser ativada no estado atual.",
        codigo: "ASSINATURA_ESTADO_INVALIDO"
      })
    }

    return res.status(200).json(resultado)
  } catch (error) {
    return next(error)
  }
}
