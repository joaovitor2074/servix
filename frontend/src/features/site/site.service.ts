import { apiFetch } from '../../shared/services/api'
import type {
  CadastroEmpresaInput,
  CadastroEmpresaResponse,
  CatalogoAssinaturasData,
  CheckoutData,
  CheckoutHospedadoData,
} from './site.types'

export interface ConfirmarCheckoutInput {
  emailPagador: string
  versaoTermos: string
  aceiteModoTeste: boolean
}

export async function buscarCatalogoAssinaturas(
  signal?: AbortSignal,
): Promise<CatalogoAssinaturasData> {
  const resposta = await apiFetch('/assinaturas/planos', { signal })

  return lerResposta<CatalogoAssinaturasData>(
    resposta,
    'Não foi possível consultar o ambiente da assinatura.',
  )
}

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
    {
      signal,
    },
  )

  return lerResposta<CheckoutData>(
    resposta,
    'Não foi possível carregar o checkout.',
  )
}

export async function confirmarCheckout(
  checkoutToken: string,
  dados: ConfirmarCheckoutInput,
): Promise<CheckoutHospedadoData> {
  const resposta = await apiFetch(
    `/assinaturas/checkout/${encodeURIComponent(
      checkoutToken,
    )}/confirmar`,
    {
      method: 'POST',
      body: JSON.stringify({
        emailPagador: dados.emailPagador,
        versaoTermos: dados.versaoTermos,
        aceiteModoTeste: dados.aceiteModoTeste,
      }),
    },
  )

  return lerResposta<CheckoutHospedadoData>(
    resposta,
    'Não foi possível abrir o checkout seguro.',
  )
}

export async function sincronizarCheckout(
  checkoutToken: string,
  signal?: AbortSignal,
): Promise<CheckoutData> {
  const resposta = await apiFetch(
    `/assinaturas/checkout/${encodeURIComponent(
      checkoutToken,
    )}/sincronizar`,
    {
      method: 'POST',
      signal,
    },
  )

  return lerResposta<CheckoutData>(
    resposta,
    'Não foi possível confirmar a assinatura.',
  )
}
async function lerResposta<T>(
  resposta: Response,
  mensagemPadrao: string,
): Promise<T> {
  const corpo: unknown = await resposta
    .json()
    .catch(() => null)

  if (!resposta.ok) {
    throw new Error(
      extrairMensagem(corpo, mensagemPadrao),
    )
  }

  if (corpo === null) {
    throw new Error(
      'O servidor respondeu sem conteúdo.',
    )
  }

  return corpo as T
}

function extrairMensagem(
  corpo: unknown,
  mensagemPadrao: string,
) {
  if (!corpo || typeof corpo !== 'object') {
    return mensagemPadrao
  }

  if (
    'erro' in corpo &&
    typeof corpo.erro === 'string'
  ) {
    return corpo.erro
  }

  if (
    'message' in corpo &&
    typeof corpo.message === 'string'
  ) {
    return corpo.message
  }

  if (
    'mensagem' in corpo &&
    typeof corpo.mensagem === 'string'
  ) {
    return corpo.mensagem
  }

  return mensagemPadrao
}
