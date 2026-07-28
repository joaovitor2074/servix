import { StatusProcessamentoWebhook } from "../generated/prisma/enums.js"
import { AppError } from "../errors/app-error.js"
import { prisma } from "../lib/prisma.js"
import { processarNotificacaoAssinaturaMercadoPagoService } from "./assinaturas.service.js"

const MAX_TENTATIVAS = 8
const TENTATIVAS_PARA_ALERTA = 3
const ATRASOS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000]
const LEASE_PROCESSAMENTO_MS = 5 * 60_000

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

function limiteLeaseExpirada(agora: Date) {
  return new Date(agora.getTime() - LEASE_PROCESSAMENTO_MS)
}

export async function processarEventoWebhookAssinaturaService(eventoId: number) {
  const agora = new Date()
  const leaseExpiradaEm = limiteLeaseExpirada(agora)
  const reivindicado = await prisma.eventoWebhookAssinatura.updateMany({
    where: {
      id: eventoId,
      OR: [
        {
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
        {
          // Se a instancia morrer depois da reivindicacao, outra pode assumir
          // o evento ao fim do lease. A ultimaTentativaEm tambem atua como o
          // token da reivindicacao e impede o worker antigo de finalizar depois.
          status: StatusProcessamentoWebhook.PROCESSANDO,
          OR: [
            { ultimaTentativaEm: null },
            { ultimaTentativaEm: { lte: leaseExpiradaEm } }
          ]
        }
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

  let associacaoLocal: { id: number, empresaId: number } | null = null

  try {
    // Para preapproval o recurso assinado e o proprio identificador da
    // assinatura. Associar antes da chamada externa torna falhas consultaveis
    // pela empresa sem confiar em nenhum campo do corpo do webhook.
    if (evento.tipo === "subscription_preapproval") {
      associacaoLocal = await prisma.assinaturaEmpresa.findUnique({
        where: { mercadoPagoAssinaturaId: evento.recursoId },
        select: { id: true, empresaId: true }
      })
    }

    const resultado = await processarNotificacaoAssinaturaMercadoPagoService(
      evento.tipo as TipoWebhookAssinatura,
      evento.recursoId
    )

    if (!resultado?.processada || !("empresaId" in resultado)) {
      throw new Error("A notificacao ainda nao corresponde a uma assinatura local.")
    }

    const assinatura = associacaoLocal?.empresaId === resultado.empresaId
      ? associacaoLocal
      : await prisma.assinaturaEmpresa.findUnique({
          where: { empresaId: resultado.empresaId },
          select: { id: true, empresaId: true }
        })

    const finalizado = await prisma.eventoWebhookAssinatura.updateMany({
      where: {
        id: evento.id,
        status: StatusProcessamentoWebhook.PROCESSANDO,
        ultimaTentativaEm: agora
      },
      data: {
        empresaId: resultado.empresaId,
        assinaturaEmpresaId: assinatura?.id ?? null,
        status: StatusProcessamentoWebhook.PROCESSADO,
        processadoEm: new Date(),
        proximaTentativaEm: null,
        ultimoErro: null
      }
    })

    if (finalizado.count !== 1) {
      return { processado: false as const, leasePerdida: true as const }
    }

    return { processado: true as const, empresaId: resultado.empresaId }
  } catch (error) {
    const mensagem = erroSeguro(error)
    const alertar =
      evento.tentativas >= TENTATIVAS_PARA_ALERTA && !evento.alertaEmitidoEm

    const falhaRegistrada = await prisma.eventoWebhookAssinatura.updateMany({
      where: {
        id: evento.id,
        status: StatusProcessamentoWebhook.PROCESSANDO,
        ultimaTentativaEm: agora
      },
      data: {
        ...(associacaoLocal && {
          empresaId: associacaoLocal.empresaId,
          assinaturaEmpresaId: associacaoLocal.id
        }),
        status: StatusProcessamentoWebhook.FALHA,
        ultimoErro: mensagem,
        proximaTentativaEm: proximaTentativa(evento.tentativas),
        ...(alertar && { alertaEmitidoEm: new Date() })
      }
    })

    if (falhaRegistrada.count !== 1) {
      return { processado: false as const, leasePerdida: true as const }
    }

    if (alertar) {
      console.error("ALERTA_WEBHOOK_ASSINATURA_FALHANDO", {
        eventoId: evento.id,
        empresaId: associacaoLocal?.empresaId ?? null,
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
  const leaseExpiradaEm = limiteLeaseExpirada(agora)
  const pendentes = await prisma.eventoWebhookAssinatura.findMany({
    where: {
      OR: [
        {
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
        {
          status: StatusProcessamentoWebhook.PROCESSANDO,
          OR: [
            { ultimaTentativaEm: null },
            { ultimaTentativaEm: { lte: leaseExpiradaEm } }
          ]
        }
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
    where: { id: eventoId },
    select: {
      id: true,
      empresaId: true,
      tipo: true,
      recursoId: true,
      status: true,
      ultimaTentativaEm: true
    }
  })

  let pertenceAEmpresa = evento?.empresaId === empresaId

  if (
    evento &&
    evento.empresaId === null &&
    evento.tipo === "subscription_preapproval"
  ) {
    const assinatura = await prisma.assinaturaEmpresa.findFirst({
      where: {
        empresaId,
        mercadoPagoAssinaturaId: evento.recursoId
      },
      select: { id: true }
    })

    if (assinatura) {
      pertenceAEmpresa = true
      await prisma.eventoWebhookAssinatura.updateMany({
        where: { id: evento.id, empresaId: null },
        data: {
          empresaId,
          assinaturaEmpresaId: assinatura.id
        }
      })
    }
  }

  if (!evento || !pertenceAEmpresa) {
    throw new AppError(
      "Notificacao nao encontrada para esta empresa.",
      404,
      "WEBHOOK_NAO_ENCONTRADO"
    )
  }

  const agora = new Date()
  const leaseExpiradaEm = limiteLeaseExpirada(agora)
  const processamentoAtivo =
    evento.status === StatusProcessamentoWebhook.PROCESSANDO &&
    evento.ultimaTentativaEm !== null &&
    evento.ultimaTentativaEm > leaseExpiradaEm

  if (processamentoAtivo) {
    throw new AppError(
      "A notificacao ja esta sendo processada.",
      409,
      "WEBHOOK_EM_PROCESSAMENTO"
    )
  }

  const liberado = await prisma.eventoWebhookAssinatura.updateMany({
    where: {
      id: evento.id,
      status: evento.status,
      ultimaTentativaEm: evento.ultimaTentativaEm
    },
    data: {
      status: StatusProcessamentoWebhook.PENDENTE,
      tentativas: 0,
      proximaTentativaEm: new Date(),
      processadoEm: null,
      ultimoErro: null,
      alertaEmitidoEm: null
    }
  })

  if (liberado.count !== 1) {
    throw new AppError(
      "O estado da notificacao mudou durante o reprocessamento.",
      409,
      "WEBHOOK_ESTADO_ALTERADO"
    )
  }

  return processarEventoWebhookAssinaturaService(evento.id)
}
