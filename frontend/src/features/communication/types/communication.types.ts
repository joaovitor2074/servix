interface ClienteMensagem { nome: string; telefone: string }

export type OrigemMensagemWhatsApp = 'ORDEM' | 'ORCAMENTO' | 'GARANTIA'

export interface CentralWhatsApp {
  configuracao: {
    ativo: boolean
    modoEnvio: 'LINK_MANUAL' | 'CLOUD_API'
    incluirLink: boolean
    telefoneEmpresa: string | null
  }
  ordens: Array<{
    id: number; numero: number; equipamento: string; status: string; atualizadoEm: string; tokenAcompanhamento: string; cliente: ClienteMensagem; mensagem: string
  }>
  orcamentos: Array<{
    id: number; numero: number; equipamento: string; total: string; status: string; atualizadoEm: string; tokenPublico: string; cliente: ClienteMensagem; mensagem: string
  }>
  garantias: Array<{
    id: number; codigo: string; expiraEm: string; atualizadoEm: string; mensagem: string
    ordem: { id: number; numero: number; equipamento: string; tokenAcompanhamento: string; cliente: ClienteMensagem }
  }>
  historico: Array<{
    id: number; tipo: string; modoEnvio: string; status: 'PREPARADA' | 'ENVIADA' | 'FALHA'; telefone: string; erro: string | null; criadoEm: string; registradoPor: { nome: string } | null
  }>
}

export type ResultadoEnvioWhatsApp =
  | { modoEnvio: 'LINK_MANUAL'; status: 'PREPARADA'; registroId: number; mensagem: string; url: string }
  | { modoEnvio: 'CLOUD_API'; status: 'ENVIADA'; registroId: number; providerMessageId: string | null }
