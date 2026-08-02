export type ModoEnvioWhatsApp = 'LINK_MANUAL' | 'CLOUD_API'

export interface ConfiguracaoWhatsApp {
  id: number
  empresaId: number
  ativo: boolean
  modoEnvio: ModoEnvioWhatsApp
  telefoneEmpresa: string | null
  incluirLink: boolean
  templateOrcamento: string
  templateRecebido: string
  templateEmAnalise: string
  templateEmExecucao: string
  templateAguardandoPeca: string
  templatePronto: string
  templateEntregue: string
  templateGarantia: string
  apiPhoneNumberId: string | null
  apiBusinessAccountId: string | null
  apiAccessTokenAtualizadoEm: string | null
  versao: number
  possuiApiAccessToken: boolean
  integracaoApiDisponivelNoServidor: boolean
  graphApiVersion: string
}

export type AtualizarConfiguracaoWhatsApp = Omit<
  ConfiguracaoWhatsApp,
  | 'id'
  | 'empresaId'
  | 'apiAccessTokenAtualizadoEm'
  | 'versao'
  | 'possuiApiAccessToken'
  | 'integracaoApiDisponivelNoServidor'
  | 'graphApiVersion'
> & {
  versaoEsperada: number
  apiAccessToken?: string
  removerApiAccessToken?: boolean
}

export interface TesteConexaoWhatsApp {
  conectado: true
  nomeVerificado: string | null
  telefone: string | null
  qualidade: string | null
}
