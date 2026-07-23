import { apiFetch } from '../../../shared/services/api'
import type { RespostaPaginada } from '../../../shared/types/api.types'
import type {
  AlterarStatusOrcamentoInput,
  AtualizarOrcamentoInput,
  CobrancaPublica,
  CriarOrcamentoInput,
  FormaPagamentoPublica,
  Orcamento,
  OrcamentoPublico,
  StatusOrcamento,
  TransformarOrcamentoResposta,
} from '../types/budget.types'

export interface ListarOrcamentosFiltros {
  pagina?: number
  limite?: number
  busca?: string
  status?: StatusOrcamento
  clienteId?: number
}

interface RequestOptions {
  signal?: AbortSignal
}

export class OrcamentoApiError extends Error {
  readonly status: number
  readonly codigo?: string
  readonly detalhes?: unknown
  readonly retryAfterSegundos?: number

  constructor(
    message: string,
    status: number,
    codigo?: string,
    detalhes?: unknown,
    retryAfterSegundos?: number,
  ) {
    super(message)
    this.name = 'OrcamentoApiError'
    this.status = status
    this.codigo = codigo
    this.detalhes = detalhes
    this.retryAfterSegundos = retryAfterSegundos
  }
}

export async function listarOrcamentos(
  filtros: ListarOrcamentosFiltros = {},
  options: RequestOptions = {},
): Promise<RespostaPaginada<Orcamento>> {
  const parametros = new URLSearchParams()

  if (filtros.pagina) parametros.set('pagina', String(filtros.pagina))
  if (filtros.limite) parametros.set('limite', String(filtros.limite))
  if (filtros.busca?.trim()) parametros.set('busca', filtros.busca.trim())
  if (filtros.status) parametros.set('status', filtros.status)
  if (filtros.clienteId) parametros.set('clienteId', String(filtros.clienteId))

  const query = parametros.toString()
  const resposta = await apiFetch(`/orcamentos${query ? `?${query}` : ''}`, {
    signal: options.signal,
  })

  return lerResposta<RespostaPaginada<Orcamento>>(
    resposta,
    'Não foi possível carregar os orçamentos',
  )
}

export async function buscarOrcamento(
  id: number,
  options: RequestOptions = {},
): Promise<Orcamento> {
  const resposta = await apiFetch(`/orcamentos/${id}`, {
    signal: options.signal,
  })

  return lerResposta<Orcamento>(
    resposta,
    'Não foi possível carregar o orçamento',
  )
}

export async function criarOrcamento(
  dados: CriarOrcamentoInput,
): Promise<Orcamento> {
  const resposta = await apiFetch('/orcamentos', {
    method: 'POST',
    body: JSON.stringify(dados),
  })

  return lerResposta<Orcamento>(
    resposta,
    'Não foi possível criar o orçamento',
  )
}

export async function atualizarOrcamento(
  id: number,
  dados: AtualizarOrcamentoInput,
): Promise<Orcamento> {
  const resposta = await apiFetch(`/orcamentos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dados),
  })

  return lerResposta<Orcamento>(
    resposta,
    'Não foi possível atualizar o orçamento',
  )
}

export async function alterarStatusOrcamento(
  id: number,
  dados: AlterarStatusOrcamentoInput,
): Promise<Orcamento> {
  const resposta = await apiFetch(`/orcamentos/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(dados),
  })

  return lerResposta<Orcamento>(
    resposta,
    'Não foi possível alterar o status do orçamento',
  )
}

export async function transformarOrcamentoEmOrdem(
  id: number,
  versaoEsperada: number,
): Promise<TransformarOrcamentoResposta> {
  const resposta = await apiFetch(`/orcamentos/${id}/transformar-em-ordem`, {
    method: 'POST',
    body: JSON.stringify({
      statusEsperado: 'APROVADO',
      versaoEsperada,
    }),
  })

  return lerResposta<TransformarOrcamentoResposta>(
    resposta,
    'Não foi possível gerar a ordem de serviço',
  )
}

export async function buscarOrcamentoPublico(
  token: string,
  options: RequestOptions = {},
): Promise<OrcamentoPublico> {
  const resposta = await apiFetch(
    `/publico/orcamentos/${encodeURIComponent(token)}`,
    { signal: options.signal },
  )

  return lerResposta<OrcamentoPublico>(
    resposta,
    'Não foi possível carregar o orçamento',
  )
}

export async function responderOrcamentoPublico(
  token: string,
  acao: 'aprovar' | 'rejeitar',
  versaoEsperada: number,
  formaPagamento?: FormaPagamentoPublica,
): Promise<OrcamentoPublico> {
  const resposta = await apiFetch(
    `/publico/orcamentos/${encodeURIComponent(token)}/${acao}`,
    {
      method: 'POST',
      body: JSON.stringify({
        versaoEsperada,
        ...(acao === 'aprovar' && formaPagamento ? { formaPagamento } : {}),
      }),
    },
  )

  return lerResposta<OrcamentoPublico>(
    resposta,
    acao === 'aprovar'
      ? 'Não foi possível aprovar o orçamento'
      : 'Não foi possível rejeitar o orçamento',
  )
}

export async function buscarCobrancaPublica(
  token: string,
  options: RequestOptions = {},
): Promise<CobrancaPublica | null> {
  const resposta = await apiFetch(
    `/publico/orcamentos/${encodeURIComponent(token)}/cobranca`,
    { cache: 'no-store', signal: options.signal },
  )

  if (resposta.status === 204) return null

  return lerResposta<CobrancaPublica>(
    resposta,
    'NÃ£o foi possÃ­vel consultar a cobranÃ§a',
  )
}

export async function criarCobrancaPublica(
  token: string,
  chaveIdempotencia: string,
  options: RequestOptions = {},
): Promise<CobrancaPublica> {
  const resposta = await apiFetch(
    `/publico/orcamentos/${encodeURIComponent(token)}/cobrancas`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': chaveIdempotencia },
      signal: options.signal,
    },
  )

  return lerResposta<CobrancaPublica>(
    resposta,
    'NÃ£o foi possÃ­vel gerar a cobranÃ§a Pix',
  )
}

async function lerResposta<T>(resposta: Response, mensagemPadrao: string) {
  let corpo: unknown

  try {
    corpo = await resposta.json()
  } catch {
    corpo = null
  }

  if (!resposta.ok) {
    const objeto = typeof corpo === 'object' && corpo !== null ? corpo : null
    const mensagem =
      objeto &&
      'erro' in objeto &&
      typeof objeto.erro === 'string'
        ? objeto.erro
        : mensagemPadrao
    const codigo =
      objeto &&
      'codigo' in objeto &&
      typeof objeto.codigo === 'string'
        ? objeto.codigo
        : undefined
    const detalhes = objeto && 'detalhes' in objeto ? objeto.detalhes : undefined
    const retryAfter = Number(resposta.headers.get('Retry-After'))

    throw new OrcamentoApiError(
      mensagem,
      resposta.status,
      codigo,
      detalhes,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    )
  }

  return corpo as T
}
