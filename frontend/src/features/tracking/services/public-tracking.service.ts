import { apiFetch } from '../../../shared/services/api'
import type { OrdemAcompanhamentoPublico } from '../types/public-tracking.types'

interface RequestOptions {
  signal?: AbortSignal
}

export class AcompanhamentoPublicoApiError extends Error {
  readonly status: number
  readonly codigo?: string

  constructor(message: string, status: number, codigo?: string) {
    super(message)
    this.name = 'AcompanhamentoPublicoApiError'
    this.status = status
    this.codigo = codigo
  }
}

export async function buscarAcompanhamentoPublico(
  token: string,
  options: RequestOptions = {},
): Promise<OrdemAcompanhamentoPublico> {
  const resposta = await apiFetch(
    `/publico/ordens/${encodeURIComponent(token)}`,
    {
      cache: 'no-store',
      signal: options.signal,
    },
  )

  let corpo: unknown

  try {
    corpo = await resposta.json()
  } catch {
    corpo = null
  }

  if (!resposta.ok) {
    const objeto = typeof corpo === 'object' && corpo !== null ? corpo : null
    const mensagem =
      objeto && 'erro' in objeto && typeof objeto.erro === 'string'
        ? objeto.erro
        : 'Não foi possível carregar o acompanhamento da ordem.'
    const codigo =
      objeto && 'codigo' in objeto && typeof objeto.codigo === 'string'
        ? objeto.codigo
        : undefined

    throw new AcompanhamentoPublicoApiError(
      mensagem,
      resposta.status,
      codigo,
    )
  }

  return corpo as OrdemAcompanhamentoPublico
}
