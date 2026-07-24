import type { NextFunction, Request, Response } from "express"

import { obterUrlFrontend } from "../config/env.js"
import {
  concluirOAuthMercadoPagoService,
  desconectarMercadoPagoService,
  ErroFluxoOAuthMercadoPago,
  iniciarOAuthMercadoPagoService
} from "../services/mercado-pago-oauth.service.js"

function parametroQuery(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor : undefined
}

function urlRetornoMercadoPago(
  resultado: "conectado" | "erro",
  codigo?: string
) {
  const url = new URL("/configuracoes/pagamentos", `${obterUrlFrontend()}/`)
  url.searchParams.set("mercadoPago", resultado)
  if (codigo) url.searchParams.set("codigo", codigo)
  return url.toString()
}

export async function iniciarOAuthMercadoPagoController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const resultado = await iniciarOAuthMercadoPagoService(
      req.auth.empresaId,
      req.auth.usuarioId
    )
    return res.status(200).json(resultado)
  } catch (error) {
    if (error instanceof ErroFluxoOAuthMercadoPago) {
      const indisponivel = error.codigo === "OAUTH_NAO_CONFIGURADO"
      return res.status(indisponivel ? 503 : 403).json({
        erro: indisponivel
          ? "A conexao com o Mercado Pago nao esta disponivel no momento."
          : "Usuario sem permissao para conectar o Mercado Pago.",
        codigo: error.codigo
      })
    }
    return next(error)
  }
}

export async function callbackOAuthMercadoPagoController(
  req: Request,
  res: Response
) {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("Pragma", "no-cache")
  res.setHeader("Referrer-Policy", "no-referrer")
  res.setHeader("X-Robots-Tag", "noindex, nofollow")

  try {
    const state = parametroQuery(req.query.state)

    if (!state) {
      return res.redirect(
        303,
        urlRetornoMercadoPago("erro", "STATE_INVALIDO")
      )
    }

    const code = parametroQuery(req.query.code)
    const erro = parametroQuery(req.query.error)
    const resultado = await concluirOAuthMercadoPagoService({
      state,
      ...(code && { code }),
      ...(erro && { erro })
    })

    if (!resultado.sucesso) {
      return res.redirect(
        303,
        urlRetornoMercadoPago("erro", resultado.codigo)
      )
    }

    return res.redirect(303, urlRetornoMercadoPago("conectado"))
  } catch (error) {
    const codigo = error instanceof ErroFluxoOAuthMercadoPago
      ? error.codigo
      : "CONEXAO_FALHOU"

    return res.redirect(303, urlRetornoMercadoPago("erro", codigo))
  }
}

export async function desconectarMercadoPagoController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const resultado = await desconectarMercadoPagoService(req.auth.empresaId)

    if (!resultado.sucesso) {
      return res.status(409).json({
        erro: "Conclua a conciliacao das cobrancas Pix em aberto antes de desconectar.",
        codigo: resultado.codigo
      })
    }

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}
