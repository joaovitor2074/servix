import { apiFetch } from '../../../shared/services/api'
import type { RespostaPaginada } from '../../../shared/types/api.types'
import type {
  CriarOrdemInput,
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

// O status HTTP permite que o formulário trate de maneira específica um
// cliente removido depois da seleção, sem depender do texto da mensagem.
export class OrdemApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'OrdemApiError'
    this.status = status
  }
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

  return lerResposta<RespostaPaginada<OrdemServico>>(
    resposta,
    'Não foi possível carregar as ordens de serviço',
  )
}

// Envia somente os campos aceitos pelo schema estrito do backend. O status não
// é incluído: a API é a responsável por iniciar toda ordem como ABERTA.
export async function criarOrdem(
  dados: CriarOrdemInput,
): Promise<OrdemServico> {
  const resposta = await apiFetch('/ordens', {
    method: 'POST',
    body: JSON.stringify(dados),
  })

  return lerResposta<OrdemServico>(
    resposta,
    'Não foi possível criar a ordem de serviço',
  )
}

// Centralizar a leitura garante que listagem e cadastro mostrem a mensagem
// enviada pela API, sem duplicar a regra de tratamento de erro.
async function lerResposta<T>(
  resposta: Response,
  mensagemPadrao: string,
): Promise<T> {
  const corpo: unknown = await resposta.json()

  if (!resposta.ok) {
    const mensagem =
      typeof corpo === 'object' &&
      corpo !== null &&
      'erro' in corpo &&
      typeof corpo.erro === 'string'
        ? corpo.erro
        : mensagemPadrao

    throw new OrdemApiError(mensagem, resposta.status)
  }

  return corpo as T
}
