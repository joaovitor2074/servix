export type ProvedorPagamento =
  | 'MANUAL'
  | 'SIMULADO'
  | 'MERCADO_PAGO'
  | 'ASAAS'

export type AmbientePagamento = 'TESTE' | 'PRODUCAO'

export type StatusConfiguracaoServidor =
  | 'CONFIGURADA'
  | 'NAO_CONFIGURADA'
  | 'ERRO'

export type StatusIntegracaoMercadoPago =
  | 'CONECTADA'
  | 'EXPIRADA'
  | 'ERRO'
  | 'BLOQUEADA'
  | 'DESCONECTADA'

export type OrigemIntegracaoMercadoPago = 'OAUTH' | null

export interface ConfiguracaoPagamento {
  id?: number
  provedor: ProvedorPagamento
  status: string
  ambiente: AmbientePagamento
  ativo: boolean
  pixHabilitado: boolean
  versao: number
  atualizadoEm: string | null
}

export interface AtualizarConfiguracaoPagamentoInput {
  versaoEsperada: number
  provedor: ProvedorPagamento
  ambiente: AmbientePagamento
  ativo: boolean
  pixHabilitado: boolean
}

export interface ProvedorPagamentoDisponivel {
  provedor: ProvedorPagamento
  nome: string
  disponivel: boolean
  ambientes: AmbientePagamento[]
  configuracaoServidor?: StatusConfiguracaoServidor
  motivoIndisponibilidade?: string
}

export interface IntegracaoMercadoPago {
  conectado: boolean
  status: StatusIntegracaoMercadoPago
  mercadoPagoUserId?: string
  conectadoEm?: string
  tokenExpiraEm?: string
  origem: OrigemIntegracaoMercadoPago
  oauthDisponivel: boolean
  liveMode?: boolean
  motivoIndisponibilidade?: string
}

export interface ResumoConfiguracaoPagamento {
  configuracao: ConfiguracaoPagamento
  provedoresDisponiveis: ProvedorPagamentoDisponivel[]
  integracaoMercadoPago: IntegracaoMercadoPago
}

export interface InicioOAuthMercadoPago {
  authorizationUrl: string
}
