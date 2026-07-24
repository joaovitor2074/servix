import { apiFetch } from '../../../shared/services/api'
import type { RespostaPaginada } from '../../../shared/types/api.types'
import type { Cliente, ClienteInput } from '../types/client.types'

export interface ListarClientesFiltros {
  pagina?: number
  limite?: number
  busca?: string
}

interface RequestOptions {
  signal?: AbortSignal
}

// Preserva o status HTTP junto da mensagem para a interface distinguir, por
// exemplo, um conflito de telefone (409) de uma falha inesperada.
export class ClienteApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ClienteApiError'
    this.status = status
  }
}

export async function listarClientes(
  filtros: ListarClientesFiltros = {},
  options: RequestOptions = {},
): Promise<RespostaPaginada<Cliente>> {
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

  const query = parametros.toString()
  const resposta = await apiFetch(`/clientes${query ? `?${query}` : ''}`, {
    signal: options.signal,
  })

  return lerResposta<RespostaPaginada<Cliente>>(
    resposta,
    'Não foi possível carregar os clientes',
  )
}

export async function buscarCliente(
  id: number,
  options: RequestOptions = {},
): Promise<Cliente> {
  const resposta = await apiFetch(`/clientes/${id}`, {
    signal: options.signal,
  })

  return lerResposta<Cliente>(
    resposta,
    'Não foi possível carregar o cliente',
  )
}

export async function criarCliente(dados: ClienteInput): Promise<Cliente> {
  const resposta = await apiFetch('/clientes', {
    method: 'POST',
    body: JSON.stringify(dados),
  })

  return lerResposta<Cliente>(
    resposta,
    'Não foi possível cadastrar o cliente',
  )
}

export async function atualizarCliente(
  id: number,
  dados: ClienteInput,
): Promise<Cliente> {
  const resposta = await apiFetch(`/clientes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dados),
  })

  return lerResposta<Cliente>(
    resposta,
    'Não foi possível atualizar o cliente',
  )
}

export async function excluirCliente(id: number): Promise<void> {
  const resposta = await apiFetch(`/clientes/${id}`, {
    method: 'DELETE',
  })

  await lerResposta<unknown>(
    resposta,
    'Não foi possível excluir o cliente',
  )
}

// Todas as funções usam o mesmo leitor para manter mensagens da API e erros
// HTTP consistentes. O backend devolve o campo `erro` nas respostas conhecidas.
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

    throw new ClienteApiError(mensagem, resposta.status)
  }

  return corpo as T
}
