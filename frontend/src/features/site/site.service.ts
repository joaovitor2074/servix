import { apiFetch } from '../../shared/services/api'
import type {
  CadastroEmpresaInput,
  CadastroEmpresaResponse,
  CheckoutData,
} from './site.types'

export async function cadastrarEmpresa(
  dados: CadastroEmpresaInput,
): Promise<CadastroEmpresaResponse> {
  const resposta = await apiFetch('/empresa', {
    method: 'POST',
    body: JSON.stringify(dados),
  })

  return lerResposta<CadastroEmpresaResponse>(
    resposta,
    'Não foi possível criar a empresa.',
  )
}

export async function buscarCheckout(
  token: string,
  signal?: AbortSignal,
): Promise<CheckoutData> {
  const resposta = await apiFetch(
    `/assinaturas/checkout/${encodeURIComponent(token)}`,
    { signal },
  )

  return lerResposta<CheckoutData>(
    resposta,
    'Não foi possível carregar o checkout.',
  )
}

export async function confirmarCheckout(token: string): Promise<CheckoutData> {
  const resposta = await apiFetch(
    `/assinaturas/checkout/${encodeURIComponent(token)}/confirmar`,
    {
      method: 'POST',
      body: JSON.stringify({ aceiteModoTeste: true }),
    },
  )

  return lerResposta<CheckoutData>(
    resposta,
    'Não foi possível confirmar a assinatura de teste.',
  )
}

async function lerResposta<T>(resposta: Response, mensagemPadrao: string) {
  const corpo: unknown = await resposta.json().catch(() => null)

  if (!resposta.ok) {
    throw new Error(extrairMensagem(corpo, mensagemPadrao))
  }

  return corpo as T
}

function extrairMensagem(corpo: unknown, mensagemPadrao: string) {
  if (
    corpo &&
    typeof corpo === 'object' &&
    'erro' in corpo &&
    typeof corpo.erro === 'string'
  ) {
    return corpo.erro
  }

  return mensagemPadrao
}
