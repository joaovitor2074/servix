import { apiFetch } from '../../../shared/services/api'
import type { ResumoDashboard } from '../types/dashboard.types'

interface BuscarResumoOptions {
  signal?: AbortSignal
}

// Centraliza a comunicação da dashboard com o endpoint criado no backend.
export async function buscarResumoDashboard(
  options: BuscarResumoOptions = {},
): Promise<ResumoDashboard> {
  const resposta = await apiFetch('/dashboard/resumo', {
    signal: options.signal,
  })

  const corpo: unknown = await resposta.json()

  if (!resposta.ok) {
    const mensagem =
      typeof corpo === 'object' &&
      corpo !== null &&
      'erro' in corpo &&
      typeof corpo.erro === 'string'
        ? corpo.erro
        : 'Não foi possível carregar a dashboard'

    throw new Error(mensagem)
  }

  return corpo as ResumoDashboard
}
