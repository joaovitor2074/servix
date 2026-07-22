import { apiFetch } from '../../../shared/services/api'
import type {
  EstornarPagamentoInput,
  ListaPagamentosResposta,
  MutacaoPagamentoResposta,
  RegistrarPagamentoInput,
} from '../types/payment.types'

interface RequestOptions {
  signal?: AbortSignal
}

export class PagamentoApiError extends Error {
  readonly status: number
  readonly codigo?: string

  constructor(message: string, status: number, codigo?: string) {
    super(message)
    this.name = 'PagamentoApiError'
    this.status = status
    this.codigo = codigo
  }
}

export async function listarPagamentos(
  ordemId: number,
  options: RequestOptions = {},
): Promise<ListaPagamentosResposta> {
  const resposta = await apiFetch(`/ordens/${ordemId}/pagamentos`, {
    signal: options.signal,
  })

  return lerResposta(
    resposta,
    'Não foi possível carregar os pagamentos da ordem.',
  )
}

export async function registrarPagamento(
  ordemId: number,
  dados: RegistrarPagamentoInput,
): Promise<MutacaoPagamentoResposta> {
  const resposta = await apiFetch(`/ordens/${ordemId}/pagamentos`, {
    method: 'POST',
    body: JSON.stringify(dados),
  })

  return lerResposta(resposta, 'Não foi possível registrar o pagamento.')
}

export async function estornarPagamento(
  ordemId: number,
  pagamentoId: number,
  dados: EstornarPagamentoInput,
): Promise<MutacaoPagamentoResposta> {
  const resposta = await apiFetch(
    `/ordens/${ordemId}/pagamentos/${pagamentoId}/estorno`,
    {
      method: 'POST',
      body: JSON.stringify(dados),
    },
  )

  return lerResposta(resposta, 'Não foi possível estornar o pagamento.')
}

async function lerResposta<T>(
  resposta: Response,
  mensagemPadrao: string,
): Promise<T> {
  const corpo: unknown = await resposta.json()

  if (!resposta.ok) {
    const registro =
      typeof corpo === 'object' && corpo !== null
        ? corpo as Record<string, unknown>
        : null
    const mensagem =
      typeof registro?.erro === 'string' ? registro.erro : mensagemPadrao
    const codigo =
      typeof registro?.codigo === 'string' ? registro.codigo : undefined

    throw new PagamentoApiError(mensagem, resposta.status, codigo)
  }

  return corpo as T
}
