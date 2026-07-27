import { StatusProcessamentoWebhook } from "../generated/prisma/enums.js"
import { AppError } from "../errors/app-error.js"
import { prisma } from "../lib/prisma.js"
import { processarNotificacaoAssinaturaMercadoPagoService } from "./assinaturas.service.js"

const MAX_TENTATIVAS = 8
const TENTATIVAS_PARA_ALERTA = 3
const ATRASOS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000]

type TipoWebhookAssinatura =
  | "subscription_preapproval"
  | "subscription_authorized_payment"

export async function registrarWebhookAssinaturaService(dados: {
  requestId: string
  tipo: TipoWebhookAssinatura
  recursoId: string
}) {
  const evento = await prisma.eventoWebhookAssinatura.upsert({
    where: { requestId: dados.requestId },
    update: {},
    create: {
        requestId: dados.requestId,
        tipo: dados.tipo,
        recursoId: dados.recursoId,
        status: StatusProcessamentoWebhook.PENDENTE,
        proximaTentativaEm: new Date()
    },
    select: { id: true, status: true, tentativas: true }
  })

  // Mesmo duas entregas simultaneas podem tentar disparar o worker: a
  // reivindicacao atomica em processarEvento garante que apenas uma prossiga.
  return { ...evento, duplicado: evento.tentativas > 0 }
}

function erroSeguro(error: unknown): string {
  const mensagem = error instanceof Error ? error.message : "Erro desconhecido"
  return mensagem.replace(/[\r\n\t]+/g, " ").trim().slice(0, 500)
}

function proximaTentativa(tentativas: number): Date | null {
  if (tentativas >= MAX_TENTATIVAS) return null
  const atraso = ATRASOS_MS[Math.min(tentativas - 1, ATRASOS_MS.length - 1)]!
  return new Date(Date.now() + atraso)
}

export async function processarEventoWebhookAssinaturaService(eventoId: number) {
  const agora = new Date()
  const reivindicado = await prisma.eventoWebhookAssinatura.updateMany({
    where: {
      id: eventoId,
      status: {
        in: [
          StatusProcessamentoWebhook.PENDENTE,
          StatusProcessamentoWebhook.FALHA
        ]
      },
      tentativas: { lt: MAX_TENTATIVAS },
      OR: [
        { proximaTentativaEm: null },
        { proximaTentativaEm: { lte: agora } }
      ]
    },
    data: {
      status: StatusProcessamentoWebhook.PROCESSANDO,
      tentativas: { increment: 1 },
      ultimaTentativaEm: agora,
      proximaTentativaEm: null
    }
  })

  if (reivindicado.count !== 1) return { processado: false as const }

  const evento = await prisma.eventoWebhookAssinatura.findUniqueOrThrow({
    where: { id: eventoId },
    select: {
      id: true,
      tipo: true,
      recursoId: true,
      tentativas: true,
      alertaEmitidoEm: true
    }
  })

  try {
    const resultado = await processarNotificacaoAssinaturaMercadoPagoService(
      evento.tipo as TipoWebhookAssinatura,
      evento.recursoId
    )

    if (!resultado?.processada || !("empresaId" in resultado)) {
      throw new Error("A notificacao ainda nao corresponde a uma assinatura local.")
    }

    const assinatura = await prisma.assinaturaEmpresa.findUnique({
      where: { empresaId: resultado.empresaId },
      select: { id: true }
    })

    await prisma.eventoWebhookAssinatura.update({
      where: { id: evento.id },
      data: {
        empresaId: resultado.empresaId,
        assinaturaEmpresaId: assinatura?.id ?? null,
        status: StatusProcessamentoWebhook.PROCESSADO,
        processadoEm: new Date(),
        proximaTentativaEm: null,
        ultimoErro: null
      }
    })

    return { processado: true as const, empresaId: resultado.empresaId }
  } catch (error) {
    const mensagem = erroSeguro(error)
    const alertar =
      evento.tentativas >= TENTATIVAS_PARA_ALERTA && !evento.alertaEmitidoEm

    await prisma.eventoWebhookAssinatura.update({
      where: { id: evento.id },
      data: {
        status: StatusProcessamentoWebhook.FALHA,
        ultimoErro: mensagem,
        proximaTentativaEm: proximaTentativa(evento.tentativas),
        ...(alertar && { alertaEmitidoEm: new Date() })
      }
    })

    if (alertar) {
      console.error("ALERTA_WEBHOOK_ASSINATURA_FALHANDO", {
        eventoId: evento.id,
        tipo: evento.tipo,
        recursoId: evento.recursoId,
        tentativas: evento.tentativas,
        erro: mensagem
      })
    }

    return { processado: false as const, erro: mensagem }
  }
}

export async function processarWebhooksAssinaturaPendentesService() {
  const agora = new Date()
  const pendentes = await prisma.eventoWebhookAssinatura.findMany({
    where: {
      status: {
        in: [
          StatusProcessamentoWebhook.PENDENTE,
          StatusProcessamentoWebhook.FALHA
        ]
      },
      tentativas: { lt: MAX_TENTATIVAS },
      OR: [
        { proximaTentativaEm: null },
        { proximaTentativaEm: { lte: agora } }
      ]
    },
    orderBy: { recebidoEm: "asc" },
    take: 20,
    select: { id: true }
  })

  await Promise.allSettled(
    pendentes.map(evento => processarEventoWebhookAssinaturaService(evento.id))
  )

  return pendentes.length
}

export async function reprocessarWebhookAssinaturaService(
  empresaId: number,
  eventoId: number
) {
  const evento = await prisma.eventoWebhookAssinatura.findFirst({
    where: { id: eventoId, empresaId },
    select: { id: true, status: true }
  })

  if (!evento) {
    throw new AppError(
      "Notificacao nao encontrada para esta empresa.",
      404,
      "WEBHOOK_NAO_ENCONTRADO"
    )
  }

  if (evento.status === StatusProcessamentoWebhook.PROCESSANDO) {
    throw new AppError(
      "A notificacao ja esta sendo processada.",
      409,
      "WEBHOOK_EM_PROCESSAMENTO"
    )
  }

  await prisma.eventoWebhookAssinatura.update({
    where: { id: evento.id },
    data: {
      status: StatusProcessamentoWebhook.PENDENTE,
      tentativas: 0,
      proximaTentativaEm: new Date(),
      processadoEm: null,
      ultimoErro: null,
      alertaEmitidoEm: null
    }
  })

  return processarEventoWebhookAssinaturaService(evento.id)
}
