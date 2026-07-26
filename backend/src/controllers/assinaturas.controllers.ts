import type { NextFunction, Request, Response } from "express"
import {
  InvalidWebhookSignatureError,
  WebhookSignatureValidator
} from "mercadopago"
import { obterSegredoWebhookAssinaturasMercadoPago } from "../config/env.js"
import { listarPlanosServixService } from "../billing/assinaturas.service.js"
import {
  buscarCheckoutPorTokenService,
  buscarAssinaturaEmpresaService,
  iniciarAssinaturaEmpresaService,
  iniciarAssinaturaPorCheckoutTokenService,
  processarNotificacaoAssinaturaMercadoPagoService,
  sincronizarAssinaturaPorCheckoutTokenService,
  sincronizarAssinaturaEmpresaService
} from "../services/assinaturas.service.js"

type CorpoIniciarAssinatura = {
  emailPagador?: unknown
  versaoTermos?: unknown
  aceiteModoTeste?: unknown
}
type CorpoWebhook = {
  type?: unknown
  data?: {
    id?: unknown
  }
}

export function listarPlanosAssinaturaController(
  _req: Request,
  res: Response
) {
  res.json(listarPlanosServixService())
}

function stringObrigatoria(
  valor: unknown,
  campo: string
): string {
  if (
    typeof valor !== "string" ||
    !valor.trim()
  ) {
    throw Object.assign(
      new Error(`${campo} é obrigatório.`),
      {
        statusCode: 400
      }
    )
  }

  return valor.trim()
}

function empresaIdAutenticada(
  req: Request
): number {
  if (!req.auth) {
    throw Object.assign(
      new Error("Usuário não autenticado."),
      {
        statusCode: 401
      }
    )
  }

  return req.auth.empresaId
}

export async function confirmarCheckoutAssinaturaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const checkoutToken = stringObrigatoria(
      req.params.token,
      "checkoutToken"
    )

    const body = req.body as CorpoIniciarAssinatura

    if (body.aceiteModoTeste !== true) {
      throw Object.assign(
        new Error(
          "É necessário confirmar o ambiente de teste."
        ),
        {
          statusCode: 400
        }
      )
    }

    const resultado =
      await iniciarAssinaturaPorCheckoutTokenService(
        checkoutToken,
        {
          emailPagador: stringObrigatoria(
            body.emailPagador,
            "emailPagador"
          ),
          versaoTermos: stringObrigatoria(
            body.versaoTermos,
            "versaoTermos"
          )
        }
      )

    res.status(resultado.recuperada ? 200 : 201).json({
      checkoutUrl: resultado.assinatura.checkoutUrl,
      status: resultado.assinatura.status
    })
  } catch (error) {
    next(error)
  }
}

export async function iniciarAssinaturaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const body =
      req.body as CorpoIniciarAssinatura

    const resultado =
      await iniciarAssinaturaEmpresaService(
        empresaIdAutenticada(req),
        {
          emailPagador: stringObrigatoria(
            body.emailPagador,
            "emailPagador"
          ),
          versaoTermos: stringObrigatoria(
            body.versaoTermos,
            "versaoTermos"
          )
        }
      )

    res
      .status(resultado.recuperada ? 200 : 201)
      .json(resultado)
  } catch (error) {
    next(error)
  }
}

export async function sincronizarCheckoutAssinaturaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const checkout =
      await sincronizarAssinaturaPorCheckoutTokenService(
        stringObrigatoria(req.params.token, "checkoutToken")
      )
    res.json(checkout)
  } catch (error) {
    next(error)
  }
}

export async function buscarAssinaturaAtualController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const assinatura =
      await buscarAssinaturaEmpresaService(
        empresaIdAutenticada(req)
      )

    res.json({
      assinatura
    })
  } catch (error) {
    next(error)
  }
}
export async function buscarCheckoutAssinaturaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const checkoutToken = stringObrigatoria(
      req.params.token,
      "checkoutToken"
    )

    const checkout =
      await buscarCheckoutPorTokenService(
        checkoutToken
      )

    // O checkout contém dados temporários e não deve
    // ser armazenado no cache do navegador ou proxy.
    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    )

    res.json(checkout)
  } catch (error) {
    next(error)
  }
}

export async function sincronizarAssinaturaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const assinatura =
      await sincronizarAssinaturaEmpresaService(
        empresaIdAutenticada(req)
      )

    res.json({
      assinatura
    })
  } catch (error) {
    next(error)
  }
}

function lerQueryString(
  valor: unknown
): string | null {
  if (
    typeof valor === "string" &&
    valor.trim()
  ) {
    return valor.trim()
  }

  if (
    Array.isArray(valor) &&
    typeof valor[0] === "string"
  ) {
    return valor[0].trim() || null
  }

  return null
}

export function webhookAssinaturasMercadoPagoController(
  req: Request,
  res: Response
) {
  const xSignature =
    req.header("x-signature")

  const xRequestId =
    req.header("x-request-id")

  const dataIdQuery =
    lerQueryString(req.query["data.id"])

  if (
    !xSignature ||
    !xRequestId ||
    !dataIdQuery
  ) {
    res.status(400).json({
      erro: "Webhook incompleto."
    })

    return
  }

  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId,
      dataId: dataIdQuery,
      secret:
        obterSegredoWebhookAssinaturasMercadoPago()
    })
  } catch (error) {
    if (
      error instanceof
      InvalidWebhookSignatureError
    ) {
      res.sendStatus(401)
      return
    }

    console.error(
      "Falha ao validar webhook de assinaturas:",
      error
    )

    res.sendStatus(500)
    return
  }

  const body = req.body as CorpoWebhook

  const tipo =
    typeof body.type === "string"
      ? body.type
      : ""

  const recursoIdBody =
    typeof body.data?.id === "string" ||
    typeof body.data?.id === "number"
      ? String(body.data.id)
      : dataIdQuery

  // Confirma rapidamente o recebimento.
  // A fonte de verdade será consultada na API
  // do Mercado Pago, e não no corpo do webhook.
  res.sendStatus(200)

  if (
    tipo !== "subscription_preapproval" &&
    tipo !==
      "subscription_authorized_payment"
  ) {
    return
  }

  void processarNotificacaoAssinaturaMercadoPagoService(
    tipo,
    recursoIdBody
  ).catch(error => {
    console.error(
      "Falha ao processar webhook de assinatura:",
      {
        tipo,
        recursoId: recursoIdBody,
        erro:
          error instanceof Error
            ? error.message
            : "erro desconhecido"
      }
    )
  })
}
