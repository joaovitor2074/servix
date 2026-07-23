import { obterModoBillingServix } from "./billing-servix.config.js"
import { PLANO_SERVIX_MENSAL } from "./planos-servix.js"
import { Prisma } from "../generated/prisma/client.js"
import {
  AmbienteAssinatura,
  ProvedorAssinatura,
  StatusAssinatura,
  StatusEmpresa
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

const assinaturaCheckoutSelect = {
  checkoutToken: true,
  planoCodigo: true,
  planoNome: true,
  valorMensal: true,
  ambiente: true,
  provedor: true,
  status: true,
  ativadaEm: true,
  criadoEm: true,
  empresa: {
    select: {
      id: true,
      nome: true,
      slug: true,
      email: true,
      status: true
    }
  }
} as const

type AssinaturaCheckout = Prisma.AssinaturaEmpresaGetPayload<{
  select: typeof assinaturaCheckoutSelect
}>

class ConflitoAtivacaoAssinatura extends Error {}

function formatarAssinatura(assinatura: AssinaturaCheckout) {
  return {
    empresa: assinatura.empresa,
    assinatura: {
      checkoutToken: assinatura.checkoutToken,
      planoCodigo: assinatura.planoCodigo,
      planoNome: assinatura.planoNome,
      valorMensal: assinatura.valorMensal.toFixed(2),
      ambiente: assinatura.ambiente,
      provedor: assinatura.provedor,
      status: assinatura.status,
      ativadaEm: assinatura.ativadaEm,
      criadoEm: assinatura.criadoEm
    }
  }
}

export function listarPlanosServixService() {
  return {
    ambiente: AmbienteAssinatura.TESTE,
    checkoutDisponivel: obterModoBillingServix() === "TESTE",
    planos: [PLANO_SERVIX_MENSAL]
  }
}

export async function buscarCheckoutAssinaturaService(token: string) {
  const assinatura = await prisma.assinaturaEmpresa.findUnique({
    where: { checkoutToken: token },
    select: assinaturaCheckoutSelect
  })

  return assinatura ? formatarAssinatura(assinatura) : null
}

export async function confirmarAssinaturaTesteService(token: string) {
  if (obterModoBillingServix() !== "TESTE") {
    return { sucesso: false as const, motivo: "billing_bloqueado" as const }
  }

  try {
    return await prisma.$transaction(async tx => {
      const atual = await tx.assinaturaEmpresa.findUnique({
      where: { checkoutToken: token },
      select: assinaturaCheckoutSelect
      })

      if (!atual) {
        return { sucesso: false as const, motivo: "nao_encontrada" as const }
      }

      if (
        atual.status === StatusAssinatura.ATIVA &&
        atual.empresa.status === StatusEmpresa.ATIVA
      ) {
        return {
          sucesso: true as const,
          reutilizada: true,
          ...formatarAssinatura(atual)
        }
      }

      if (
        atual.status !== StatusAssinatura.PENDENTE ||
        atual.ambiente !== AmbienteAssinatura.TESTE ||
        atual.provedor !== ProvedorAssinatura.SIMULADO
      ) {
        return { sucesso: false as const, motivo: "estado_invalido" as const }
      }

      const agora = new Date()
      const ativacao = await tx.assinaturaEmpresa.updateMany({
        where: {
          checkoutToken: token,
          status: StatusAssinatura.PENDENTE,
          ambiente: AmbienteAssinatura.TESTE,
          provedor: ProvedorAssinatura.SIMULADO
        },
        data: {
          status: StatusAssinatura.ATIVA,
          ativadaEm: agora
        }
      })

      if (ativacao.count === 0) {
        throw new ConflitoAtivacaoAssinatura()
      }

      const empresa = await tx.empresa.updateMany({
        where: {
          id: atual.empresa.id,
          status: StatusEmpresa.PENDENTE_ASSINATURA
        },
        data: { status: StatusEmpresa.ATIVA }
      })

      if (empresa.count === 0) {
        throw new ConflitoAtivacaoAssinatura()
      }

      const confirmada = await tx.assinaturaEmpresa.findUniqueOrThrow({
        where: { checkoutToken: token },
        select: assinaturaCheckoutSelect
      })

      return {
        sucesso: true as const,
        reutilizada: false,
        ...formatarAssinatura(confirmada)
      }
    })
  } catch (error) {
    if (error instanceof ConflitoAtivacaoAssinatura) {
      return { sucesso: false as const, motivo: "conflito" as const }
    }
    throw error
  }
}
