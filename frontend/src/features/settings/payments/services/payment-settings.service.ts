import { apiFetch } from '../../../../shared/services/api'
import type {
  AmbientePagamento,
  AtualizarConfiguracaoPagamentoInput,
  ConfiguracaoPagamento,
  InicioOAuthMercadoPago,
  IntegracaoMercadoPago,
  OrigemIntegracaoMercadoPago,
  ProvedorPagamento,
  ProvedorPagamentoDisponivel,
  ResumoConfiguracaoPagamento,
  StatusConfiguracaoServidor,
  StatusIntegracaoMercadoPago,
} from '../types/payment-settings.types'

interface BuscarConfiguracaoOptions {
  signal?: AbortSignal
}

const PROVEDORES: ProvedorPagamento[] = [
  'MANUAL',
  'SIMULADO',
  'MERCADO_PAGO',
  'ASAAS',
]

const AMBIENTES: AmbientePagamento[] = ['TESTE', 'PRODUCAO']

const STATUS_CONFIGURACAO_SERVIDOR: StatusConfiguracaoServidor[] = [
  'CONFIGURADA',
  'NAO_CONFIGURADA',
  'ERRO',
]

const STATUS_INTEGRACAO_MERCADO_PAGO: StatusIntegracaoMercadoPago[] = [
  'CONECTADA',
  'EXPIRADA',
  'ERRO',
  'BLOQUEADA',
  'DESCONECTADA',
]

const ORIGENS_INTEGRACAO_MERCADO_PAGO: Exclude<
  OrigemIntegracaoMercadoPago,
  null
>[] = ['OAUTH']

const PROVEDORES_PADRAO: ProvedorPagamentoDisponivel[] = [
  {
    provedor: 'MANUAL',
    nome: 'Pagamento manual',
    disponivel: true,
    ambientes: ['TESTE', 'PRODUCAO'],
  },
  {
    provedor: 'SIMULADO',
    nome: 'Gateway simulado',
    disponivel: true,
    ambientes: ['TESTE'],
  },
  {
    provedor: 'MERCADO_PAGO',
    nome: 'Mercado Pago',
    disponivel: false,
    ambientes: ['TESTE'],
    configuracaoServidor: 'NAO_CONFIGURADA',
    motivoIndisponibilidade:
      'A conexão OAuth ainda não foi configurada no backend.',
  },
  {
    provedor: 'ASAAS',
    nome: 'Asaas',
    disponivel: false,
    ambientes: ['TESTE', 'PRODUCAO'],
  },
]

export class ConflitoConfiguracaoPagamentoError extends Error {
  constructor() {
    super('Outra pessoa alterou estas configurações. Recarregue os dados antes de salvar novamente.')
    this.name = 'ConflitoConfiguracaoPagamentoError'
  }
}

export async function buscarConfiguracaoPagamento(
  options: BuscarConfiguracaoOptions = {},
): Promise<ResumoConfiguracaoPagamento> {
  const resposta = await apiFetch('/configuracoes/pagamentos', {
    signal: options.signal,
  })
  const corpo = await lerJson(resposta)

  if (!resposta.ok) {
    throw new Error(obterMensagemResposta(
      resposta.status,
      corpo,
      'Não foi possível carregar as configurações de pagamento',
    ))
  }

  return montarResumoConfiguracao(corpo)
}

export async function atualizarConfiguracaoPagamento(
  dados: AtualizarConfiguracaoPagamentoInput,
): Promise<ResumoConfiguracaoPagamento> {
  const resposta = await apiFetch('/configuracoes/pagamentos', {
    method: 'PATCH',
    body: JSON.stringify(dados),
  })
  const corpo = await lerJson(resposta)

  if (
    resposta.status === 409 &&
    ehRegistro(corpo) &&
    corpo.codigo === 'CONFIGURACAO_PAGAMENTO_CONFLITANTE'
  ) {
    throw new ConflitoConfiguracaoPagamentoError()
  }

  if (!resposta.ok) {
    throw new Error(obterMensagemResposta(
      resposta.status,
      corpo,
      'Não foi possível salvar as configurações de pagamento',
    ))
  }

  return montarResumoConfiguracao(corpo)
}

export async function iniciarOAuthMercadoPago(): Promise<InicioOAuthMercadoPago> {
  const resposta = await apiFetch(
    '/configuracoes/pagamentos/mercado-pago/oauth/iniciar',
    { method: 'POST' },
  )
  const corpo = await lerJson(resposta)

  if (!resposta.ok) {
    throw new Error(obterMensagemResposta(
      resposta.status,
      corpo,
      'Não foi possível iniciar a conexão com o Mercado Pago',
    ))
  }

  if (
    !ehRegistro(corpo) ||
    typeof corpo.authorizationUrl !== 'string' ||
    !corpo.authorizationUrl.trim()
  ) {
    throw new Error('O servidor não retornou um endereço de autorização válido')
  }

  let authorizationUrl: URL
  try {
    authorizationUrl = new URL(corpo.authorizationUrl.trim())
  } catch {
    throw new Error('O servidor não retornou um endereço de autorização válido')
  }

  if (
    authorizationUrl.protocol !== 'https:' ||
    authorizationUrl.hostname !== 'auth.mercadopago.com'
  ) {
    throw new Error('O endereço de autorização do Mercado Pago é inválido')
  }

  return { authorizationUrl: authorizationUrl.toString() }
}

export async function desconectarMercadoPago(): Promise<void> {
  const resposta = await apiFetch(
    '/configuracoes/pagamentos/mercado-pago',
    { method: 'DELETE' },
  )

  if (resposta.ok) return

  const corpo = await lerJson(resposta)
  throw new Error(obterMensagemResposta(
    resposta.status,
    corpo,
    'Não foi possível desconectar a conta do Mercado Pago',
  ))
}

async function lerJson(resposta: Response): Promise<unknown> {
  try {
    return await resposta.json()
  } catch {
    return null
  }
}

function extrairConfiguracao(corpo: unknown): unknown {
  if (!ehRegistro(corpo)) return corpo
  return 'configuracao' in corpo ? corpo.configuracao : corpo
}

function montarResumoConfiguracao(
  corpo: unknown,
): ResumoConfiguracaoPagamento {
  const provedoresDisponiveis = extrairProvedoresDisponiveis(corpo)

  return {
    configuracao: normalizarConfiguracao(extrairConfiguracao(corpo)),
    provedoresDisponiveis,
    integracaoMercadoPago: extrairIntegracaoMercadoPago(
      corpo,
      provedoresDisponiveis,
    ),
  }
}

function normalizarConfiguracao(valor: unknown): ConfiguracaoPagamento {
  if (!ehRegistro(valor)) {
    throw new Error('O servidor retornou uma configuração de pagamento inválida')
  }

  const provedor = lerOpcao(valor.provedor, PROVEDORES, 'MANUAL')
  const ambiente = lerOpcao(valor.ambiente, AMBIENTES, 'TESTE')

  return {
    id: typeof valor.id === 'number' ? valor.id : undefined,
    provedor,
    ambiente,
    status: typeof valor.status === 'string' ? valor.status : 'NAO_CONFIGURADO',
    ativo: valor.ativo === true,
    pixHabilitado: valor.pixHabilitado === true,
    versao:
      typeof valor.versao === 'number' && valor.versao > 0 ? valor.versao : 1,
    atualizadoEm:
      typeof valor.atualizadoEm === 'string' ? valor.atualizadoEm : null,
  }
}

function extrairProvedoresDisponiveis(
  corpo: unknown,
): ProvedorPagamentoDisponivel[] {
  if (!ehRegistro(corpo) || !Array.isArray(corpo.provedoresDisponiveis)) {
    return PROVEDORES_PADRAO
  }

  const provedores = corpo.provedoresDisponiveis
    .map(normalizarProvedorDisponivel)
    .filter((item): item is ProvedorPagamentoDisponivel => item !== null)

  return provedores.length > 0 ? provedores : PROVEDORES_PADRAO
}

function extrairIntegracaoMercadoPago(
  corpo: unknown,
  provedores: ProvedorPagamentoDisponivel[],
): IntegracaoMercadoPago {
  const valor = ehRegistro(corpo) && ehRegistro(corpo.integracaoMercadoPago)
    ? corpo.integracaoMercadoPago
    : null

  if (!valor) return criarIntegracaoMercadoPagoLegada(provedores)

  const status = lerOpcao(
    valor.status,
    STATUS_INTEGRACAO_MERCADO_PAGO,
    'DESCONECTADA',
  )
  const origem = lerOpcaoOuNulo(
    valor.origem,
    ORIGENS_INTEGRACAO_MERCADO_PAGO,
  )
  const mercadoPagoUserId = lerIdentificador(valor.mercadoPagoUserId)
  const conectadoEm = lerTextoOpcional(valor.conectadoEm)
  const tokenExpiraEm = lerTextoOpcional(valor.tokenExpiraEm)
  const motivoIndisponibilidade = lerTextoOpcional(
    valor.motivoIndisponibilidade,
  )

  return {
    conectado: valor.conectado === true,
    status,
    ...(mercadoPagoUserId && { mercadoPagoUserId }),
    ...(conectadoEm && { conectadoEm }),
    ...(tokenExpiraEm && { tokenExpiraEm }),
    origem,
    oauthDisponivel: valor.oauthDisponivel === true,
    liveMode: valor.liveMode === true,
    ...(motivoIndisponibilidade && { motivoIndisponibilidade }),
  }
}

function criarIntegracaoMercadoPagoLegada(
  provedores: ProvedorPagamentoDisponivel[],
): IntegracaoMercadoPago {
  const mercadoPago = provedores.find(
    item => item.provedor === 'MERCADO_PAGO',
  )
  return {
    conectado: false,
    status: mercadoPago?.configuracaoServidor === 'ERRO'
      ? 'ERRO'
      : 'DESCONECTADA',
    origem: null,
    oauthDisponivel: false,
    liveMode: false,
    motivoIndisponibilidade: mercadoPago?.motivoIndisponibilidade,
  }
}

function normalizarProvedorDisponivel(
  valor: unknown,
): ProvedorPagamentoDisponivel | null {
  if (!ehRegistro(valor)) return null
  if (
    typeof valor.provedor !== 'string' ||
    !PROVEDORES.includes(valor.provedor as ProvedorPagamento)
  ) {
    return null
  }

  const provedor = valor.provedor as ProvedorPagamento
  const ambientes = Array.isArray(valor.ambientes)
    ? valor.ambientes.filter(
        (item): item is AmbientePagamento =>
          typeof item === 'string' &&
          AMBIENTES.includes(item as AmbientePagamento),
      )
    : []

  return {
    provedor,
    nome: typeof valor.nome === 'string' ? valor.nome : provedor,
    disponivel: valor.disponivel === true,
    ambientes: ambientes.length > 0 ? ambientes : ['TESTE'],
    configuracaoServidor: lerStatusConfiguracaoServidor(
      valor.configuracaoServidor,
      valor.disponivel === true ? 'CONFIGURADA' : 'NAO_CONFIGURADA',
    ),
    motivoIndisponibilidade:
      typeof valor.motivoIndisponibilidade === 'string' &&
      valor.motivoIndisponibilidade.trim()
        ? valor.motivoIndisponibilidade.trim()
        : undefined,
  }
}

function lerStatusConfiguracaoServidor(
  valor: unknown,
  padrao: StatusConfiguracaoServidor,
): StatusConfiguracaoServidor {
  return typeof valor === 'string' &&
    STATUS_CONFIGURACAO_SERVIDOR.includes(
      valor as StatusConfiguracaoServidor,
    )
    ? (valor as StatusConfiguracaoServidor)
    : padrao
}

function lerOpcao<T extends string>(
  valor: unknown,
  opcoes: readonly T[],
  padrao: T,
): T {
  return typeof valor === 'string' && opcoes.includes(valor as T)
    ? (valor as T)
    : padrao
}

function lerOpcaoOuNulo<T extends string>(
  valor: unknown,
  opcoes: readonly T[],
): T | null {
  return typeof valor === 'string' && opcoes.includes(valor as T)
    ? (valor as T)
    : null
}

function lerTextoOpcional(valor: unknown) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined
}

function lerIdentificador(valor: unknown) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return String(valor)
  return lerTextoOpcional(valor)
}

function obterMensagemResposta(
  status: number,
  corpo: unknown,
  padrao: string,
) {
  if (status === 403) {
    return 'Apenas administradores podem acessar as configurações de pagamento.'
  }

  if (!ehRegistro(corpo)) return padrao

  if (typeof corpo.erro === 'string') return corpo.erro
  if (typeof corpo.message === 'string') return corpo.message
  return padrao
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}
