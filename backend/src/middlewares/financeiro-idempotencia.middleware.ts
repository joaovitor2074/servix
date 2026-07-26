import { createHash } from "node:crypto"

import type { NextFunction, Request, Response } from "express"

import type { Prisma } from "../generated/prisma/client.js"
import { StatusIdempotenciaFinanceira } from "../generated/prisma/enums.js"
import { AMBIENTE_FINANCEIRO_PREVIEW } from "../financeiro/financeiro-preview.js"
import { prisma } from "../lib/prisma.js"
import { erroPrismaPossuiCodigo } from "../lib/prisma-errors.js"

const FORMATO_CHAVE = /^[A-Za-z0-9._:-]{8,120}$/

function ordenarParaFingerprint(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(ordenarParaFingerprint)
  }

  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .sort(([chaveA], [chaveB]) => chaveA.localeCompare(chaveB))
        .map(([chave, item]) => [chave, ordenarParaFingerprint(item)])
    )
  }

  return valor
}

function criarFingerprint(req: Request, operacao: string): string {
  const canonico = JSON.stringify({
    operacao,
    usuarioId: req.auth.usuarioId,
    corpo: ordenarParaFingerprint(req.body)
  })
  return createHash("sha256").update(canonico).digest("hex")
}

function serializarResposta(corpo: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(corpo)) as Prisma.InputJsonValue
}

// Reserva uma chave antes de executar o controller. A reserva persistente
// oferece semantica at-most-once inclusive entre instancias: uma queda depois
// da escrita pode deixar a operacao EM_PROCESSAMENTO para reconciliacao, mas
// uma repeticao jamais executa a mutacao novamente silenciosamente.
export async function garantirIdempotenciaFinanceiroPreview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.method !== "POST") {
    return next()
  }

  const chave = req.get("Idempotency-Key")?.trim()
  if (!chave || !FORMATO_CHAVE.test(chave)) {
    return res.status(400).json({
      erro: "Idempotency-Key deve possuir de 8 a 120 caracteres seguros",
      codigo: "FINANCEIRO_IDEMPOTENCY_KEY_OBRIGATORIA"
    })
  }

  const caminho = req.originalUrl.split("?", 1)[0] ?? req.originalUrl
  const operacao = `${req.method} ${caminho}`
  const fingerprint = criarFingerprint(req, operacao)
  let registro
  let criado = false

  try {
    registro = await prisma.idempotenciaFinanceira.create({
      data: {
        empresaId: req.auth.empresaId,
        ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
        usuarioId: req.auth.usuarioId,
        chave,
        operacao,
        fingerprint
      }
    })
    criado = true
  } catch (error) {
    if (!erroPrismaPossuiCodigo(error, "P2002")) {
      return next(error)
    }

    registro = await prisma.idempotenciaFinanceira.findUnique({
      where: {
        empresaId_ambiente_chave: {
          empresaId: req.auth.empresaId,
          ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
          chave
        }
      }
    })
  }

  if (!registro) {
    return next(new Error("Reserva idempotente não pôde ser recuperada"))
  }

  if (registro.operacao !== operacao || registro.fingerprint !== fingerprint) {
    return res.status(409).json({
      erro: "Idempotency-Key já foi usada com outra operação ou payload",
      codigo: "FINANCEIRO_IDEMPOTENCY_KEY_REUTILIZADA"
    })
  }

  if (!criado) {
    if (
      registro.status === StatusIdempotenciaFinanceira.CONCLUIDA &&
      registro.codigoHttp !== null &&
      registro.resposta !== null
    ) {
      res.setHeader("Idempotency-Replayed", "true")
      return res.status(registro.codigoHttp).json(registro.resposta)
    }

    res.setHeader("Retry-After", "2")
    return res.status(409).json({
      erro: "Operação com esta Idempotency-Key ainda está em processamento",
      codigo: "FINANCEIRO_IDEMPOTENCIA_EM_PROCESSAMENTO"
    })
  }

  const responderJson = res.json.bind(res)
  let finalizacaoIniciada = false

  res.json = ((corpo: unknown) => {
    if (finalizacaoIniciada) {
      return responderJson(corpo)
    }
    finalizacaoIniciada = true
    const codigoHttp = res.statusCode
    const concluidoEm = new Date(Math.max(
      Date.now(),
      registro.criadoEm.getTime()
    ))

    void prisma.idempotenciaFinanceira.update({
      where: { id: registro.id },
      data: {
        status: StatusIdempotenciaFinanceira.CONCLUIDA,
        codigoHttp,
        resposta: serializarResposta(corpo),
        concluidoEm
      }
    }).then(() => {
      responderJson(corpo)
    }).catch(error => {
      next(error)
    })

    return res
  }) as Response["json"]

  return next()
}
