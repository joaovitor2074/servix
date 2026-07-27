import { apiFetch } from '../../shared/services/api'

export type StatusAssinaturaRecuperacao =
  | 'PENDENTE'
  | 'ATIVA'
  | 'PAUSADA'
  | 'INADIMPLENTE'
  | 'CANCELADA'

export interface PortalAssinatura {
  statusEmpresa: 'PENDENTE_ASSINATURA' | 'ATIVA' | 'SUSPENSA'
  assinatura: null | {
    planoNome: string
    valorMensal: number | string
    ambiente: 'TESTE' | 'PRODUCAO'
    status: StatusAssinaturaRecuperacao
    checkoutUrl?: string | null
    canceladaEm?: string | null
    ativadaEm?: string | null
    proximaCobrancaEm?: string | null
    atualizadoEm: string
  }
}

export async function buscarPortalAssinatura(signal?: AbortSignal) {
  const resposta = await apiFetch('/assinaturas/recuperacao', { signal })
  return lerResposta<PortalAssinatura>(resposta)
}

export async function iniciarReativacaoAssinatura(gerarNovoCheckout = false) {
  const resposta = await apiFetch('/assinaturas/recuperacao/reativar', {
    method: 'POST',
    body: JSON.stringify({ gerarNovoCheckout }),
  })
  return lerResposta<{
    checkoutUrl: string
    status: StatusAssinaturaRecuperacao
    recuperada: boolean
  }>(resposta)
}

export async function sincronizarRecuperacaoAssinatura() {
  const resposta = await apiFetch('/assinaturas/recuperacao/sincronizar', {
    method: 'POST',
  })
  return lerResposta<{ assinatura: PortalAssinatura['assinatura'] }>(resposta)
}

async function lerResposta<T>(resposta: Response): Promise<T> {
  const corpo = await resposta.json().catch(() => null) as Record<string, unknown> | null
  if (!resposta.ok) {
    throw new Error(
      typeof corpo?.erro === 'string'
        ? corpo.erro
        : 'Não foi possível recuperar a assinatura.',
    )
  }
  return corpo as T
}
