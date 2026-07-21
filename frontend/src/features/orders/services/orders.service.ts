import { apiFetch } from '../../../shared/services/api'
import type { RespostaPaginada } from '../../../shared/types/api.types'
import type {
  OrdemServico,
  StatusOrdem,
} from '../../../shared/types/ordem.types'

export interface ListarOrdensFiltros {
  pagina?: number
  limite?: number
  busca?: string
  status?: StatusOrdem
  clienteId?: number
}

interface ListarOrdensOptions {
  signal?: AbortSignal
}

// Converte o objeto de filtros em query string e consulta a listagem protegida.
// Campos vazios não são enviados, permitindo que o backend aplique os padrões.
export async function listarOrdens(
  filtros: ListarOrdensFiltros = {},
  options: ListarOrdensOptions = {},
): Promise<RespostaPaginada<OrdemServico>> {
  const parametros = new URLSearchParams()

  if (filtros.pagina) {
    parametros.set('pagina', String(filtros.pagina))
  }

  if (filtros.limite) {
    parametros.set('limite', String(filtros.limite))
  }

  if (filtros.busca?.trim()) {
    parametros.set('busca', filtros.busca.trim())
  }

  if (filtros.status) {
    parametros.set('status', filtros.status)
  }

  if (filtros.clienteId) {
    parametros.set('clienteId', String(filtros.clienteId))
  }

  const query = parametros.toString()
  const resposta = await apiFetch(`/ordens${query ? `?${query}` : ''}`, {
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
        : 'Não foi possível carregar as ordens de serviço'

    throw new Error(mensagem)
  }

  return corpo as RespostaPaginada<OrdemServico>
}
