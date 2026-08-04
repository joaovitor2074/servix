import {
  StatusAssinatura,
  StatusEmpresa
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

export const DURACAO_TESTE_GRATUITO_DIAS = 5
export const DURACAO_TESTE_GRATUITO_MS =
  DURACAO_TESTE_GRATUITO_DIAS * 24 * 60 * 60 * 1_000

export type TipoAcessoEmpresa =
  | "ASSINATURA"
  | "TESTE_GRATUITO"
  | "PILOTO"
  | "LIBERADO_MANUALMENTE"
  | "BLOQUEADO"

export interface ResumoAcessoEmpresa {
  tipo: TipoAcessoEmpresa
  ativo: boolean
  diasRestantes: number | null
  expiraEm: Date | null
}

interface DadosAssinaturaAcesso {
  status: StatusAssinatura
  testeGratisIniciadoEm: Date | null
  testeGratisExpiraEm: Date | null
  acessoPilotoAte: Date | null
}

interface DadosEmpresaAcesso {
  status: StatusEmpresa
  assinatura: DadosAssinaturaAcesso | null
}

function diasRestantes(expiraEm: Date, agora: Date): number {
  return Math.max(
    0,
    Math.ceil((expiraEm.getTime() - agora.getTime()) / (24 * 60 * 60 * 1_000))
  )
}

export function avaliarAcessoEmpresa(
  empresa: DadosEmpresaAcesso,
  agora = new Date()
): ResumoAcessoEmpresa {
  const assinatura = empresa.assinatura

  if (
    assinatura?.status === StatusAssinatura.ATIVA ||
    assinatura?.status === StatusAssinatura.INADIMPLENTE
  ) {
    return {
      tipo: "ASSINATURA",
      ativo: true,
      diasRestantes: null,
      expiraEm: null
    }
  }

  if (
    assinatura?.acessoPilotoAte &&
    assinatura.acessoPilotoAte.getTime() > agora.getTime()
  ) {
    return {
      tipo: "PILOTO",
      ativo: true,
      diasRestantes: diasRestantes(assinatura.acessoPilotoAte, agora),
      expiraEm: assinatura.acessoPilotoAte
    }
  }

  if (
    assinatura?.testeGratisExpiraEm &&
    assinatura.testeGratisExpiraEm.getTime() > agora.getTime()
  ) {
    return {
      tipo: "TESTE_GRATUITO",
      ativo: true,
      diasRestantes: diasRestantes(assinatura.testeGratisExpiraEm, agora),
      expiraEm: assinatura.testeGratisExpiraEm
    }
  }

  // Empresas antigas sem um ciclo de acesso gerenciado preservam o status
  // administrativo atual. Assim a migracao nao suspende contas preexistentes.
  const possuiAcessoGerenciado = Boolean(
    assinatura?.testeGratisIniciadoEm ||
    assinatura?.testeGratisExpiraEm ||
    assinatura?.acessoPilotoAte
  )

  if (!possuiAcessoGerenciado && empresa.status === StatusEmpresa.ATIVA) {
    return {
      tipo: "LIBERADO_MANUALMENTE",
      ativo: true,
      diasRestantes: null,
      expiraEm: null
    }
  }

  return {
    tipo: "BLOQUEADO",
    ativo: false,
    diasRestantes: 0,
    expiraEm: assinatura?.testeGratisExpiraEm ??
      assinatura?.acessoPilotoAte ??
      null
  }
}

function statusBloqueado(assinatura: DadosAssinaturaAcesso | null) {
  return assinatura?.status === StatusAssinatura.PAUSADA ||
    assinatura?.status === StatusAssinatura.CANCELADA
    ? StatusEmpresa.SUSPENSA
    : StatusEmpresa.PENDENTE_ASSINATURA
}

// Reconciliacao sob demanda: login e toda API protegida verificam a data real,
// portanto a expiracao independe de cron ou de um processo em segundo plano.
export async function sincronizarAcessoEmpresaService(
  empresaId: number,
  agora = new Date()
) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      status: true,
      assinatura: {
        select: {
          status: true,
          testeGratisIniciadoEm: true,
          testeGratisExpiraEm: true,
          acessoPilotoAte: true
        }
      }
    }
  })

  if (!empresa) return null

  const acesso = avaliarAcessoEmpresa(empresa, agora)
  const statusEmpresa = acesso.ativo
    ? StatusEmpresa.ATIVA
    : statusBloqueado(empresa.assinatura)

  if (statusEmpresa !== empresa.status) {
    await prisma.empresa.updateMany({
      where: {
        id: empresaId,
        status: empresa.status
      },
      data: { status: statusEmpresa }
    })
  }

  return { statusEmpresa, acesso }
}
