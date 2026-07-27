import { apiFetch } from '../../../../shared/services/api'
import type {
  AssinaturaAtual,
  PainelAssinatura,
  RespostaAssinaturaAtual,
} from '../types/subscription-settings.types'

export class AssinaturaApiError extends Error {
  readonly status: number
  readonly codigo?: string

  constructor(
    message: string,
    status: number,
    codigo?: string,
  ) {
    super(message)
    this.name = 'AssinaturaApiError'
    this.status = status
    this.codigo = codigo
  }
}

export async function buscarAssinaturaAtual(
  signal?: AbortSignal,
): Promise<AssinaturaAtual | null> {
  const resposta = await apiFetch('/assinaturas/atual', { signal })
  const corpo = await lerResposta(resposta)
  return (corpo as RespostaAssinaturaAtual).assinatura
}

export async function buscarPainelAssinatura(
  signal?: AbortSignal,
): Promise<PainelAssinatura> {
  const resposta = await apiFetch('/assinaturas/painel', { signal })
  return lerResposta(resposta) as Promise<PainelAssinatura>
}

export async function reprocessarWebhookAssinatura(eventoId: number) {
  const resposta = await apiFetch(`/assinaturas/webhooks/${eventoId}/reprocessar`, {
    method: 'POST',
  })
  return lerResposta(resposta)
}

export async function sincronizarAssinaturaAtual(): Promise<AssinaturaAtual> {
  const resposta = await apiFetch('/assinaturas/sincronizar', {
    method: 'POST',
  })
  const corpo = await lerResposta(resposta) as RespostaAssinaturaAtual

  if (!corpo.assinatura) {
    throw new AssinaturaApiError(
      'O servidor não retornou os dados da assinatura.',
      502,
    )
  }

  return corpo.assinatura
}

export async function cancelarAssinaturaAtual(): Promise<AssinaturaAtual> {
  const resposta = await apiFetch('/assinaturas/cancelar', {
    method: 'POST',
  })
  const corpo = await lerResposta(resposta) as RespostaAssinaturaAtual

  if (!corpo.assinatura) {
    throw new AssinaturaApiError(
      'O servidor não confirmou o cancelamento da assinatura.',
      502,
    )
  }

  return corpo.assinatura
}

async function lerResposta(resposta: Response): Promise<unknown> {
  const corpo: unknown = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    const registro = ehRegistro(corpo) ? corpo : null
    throw new AssinaturaApiError(
      typeof registro?.erro === 'string'
        ? registro.erro
        : 'Não foi possível consultar a assinatura.',
      resposta.status,
      typeof registro?.codigo === 'string' ? registro.codigo : undefined,
    )
  }

  if (!ehRegistro(corpo)) {
    throw new AssinaturaApiError(
      'O servidor respondeu sem dados válidos.',
      502,
    )
  }

  return corpo
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}
