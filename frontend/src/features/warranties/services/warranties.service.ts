import { apiFetch } from '../../../shared/services/api'
import type { GarantiaServico } from '../types/warranty.types'

async function ler<T>(resposta: Response): Promise<T> {
  const corpo = await resposta.json().catch(() => null) as { erro?: string } | null
  if (!resposta.ok) throw new Error(corpo?.erro ?? 'Não foi possível concluir a operação')
  return corpo as T
}

export async function listarGarantias(signal?: AbortSignal) {
  return ler<GarantiaServico[]>(await apiFetch('/garantias', { signal }))
}

export async function buscarGarantia(id: number) {
  return ler<GarantiaServico>(await apiFetch(`/garantias/${id}`))
}

export async function acionarGarantia(id: number, observacao: string) {
  return ler<GarantiaServico>(await apiFetch(`/garantias/${id}/acionar`, {
    method: 'PATCH', body: JSON.stringify({ observacao }),
  }))
}
