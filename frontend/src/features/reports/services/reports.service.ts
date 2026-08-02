import { apiFetch } from '../../../shared/services/api'
import type { RelatorioOperacional } from '../types/report.types'

export async function buscarRelatorioOperacional(filtros: { inicio?: string; fim?: string }, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (filtros.inicio) params.set('inicio', filtros.inicio)
  if (filtros.fim) params.set('fim', filtros.fim)
  const resposta = await apiFetch(`/relatorios/operacional?${params}`, { signal })
  const corpo = await resposta.json().catch(() => null) as RelatorioOperacional | { erro?: string } | null
  if (!resposta.ok) throw new Error(corpo && 'erro' in corpo ? corpo.erro : 'Não foi possível gerar o relatório')
  return corpo as RelatorioOperacional
}
