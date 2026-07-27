export type StatusAssinatura =
  | 'PENDENTE'
  | 'ATIVA'
  | 'PAUSADA'
  | 'INADIMPLENTE'
  | 'CANCELADA'

export interface AssinaturaAtual {
  id: number
  empresaId: number
  planoCodigo: string
  planoNome: string
  valorMensal: number | string
  ambiente: 'TESTE' | 'PRODUCAO'
  provedor: 'SIMULADO' | 'MERCADO_PAGO_SERVIX'
  status: StatusAssinatura
  mercadoPagoAssinaturaId?: string | null
  emailPagador?: string | null
  ativadaEm?: string | null
  proximaCobrancaEm?: string | null
  ultimaSincronizacaoEm?: string | null
  canceladaEm?: string | null
  criadoEm: string
  atualizadoEm: string
}

export interface RespostaAssinaturaAtual {
  assinatura: AssinaturaAtual | null
}

export interface HistoricoAssinatura {
  id: number
  tipo: 'ATIVADA' | 'SINCRONIZADA' | 'CANCELADA' | 'REATIVACAO_SOLICITADA' | 'REATIVADA' | 'INADIMPLENCIA_DETECTADA'
  origem: 'CHECKOUT' | 'WEBHOOK' | 'SINCRONIZACAO_MANUAL' | 'CANCELAMENTO_ADMIN' | 'REATIVACAO_ADMIN'
  statusAnterior?: StatusAssinatura | null
  statusNovo: StatusAssinatura
  mercadoPagoAssinaturaId?: string | null
  requestIdProvedor?: string | null
  criadoEm: string
}

export interface EventoWebhookAssinatura {
  id: number
  requestId: string
  tipo: string
  recursoId: string
  status: 'PENDENTE' | 'PROCESSANDO' | 'PROCESSADO' | 'FALHA'
  tentativas: number
  ultimaTentativaEm?: string | null
  proximaTentativaEm?: string | null
  processadoEm?: string | null
  ultimoErro?: string | null
  alertaEmitidoEm?: string | null
  recebidoEm: string
}

export interface PainelAssinatura extends RespostaAssinaturaAtual {
  historico: HistoricoAssinatura[]
  webhooks: EventoWebhookAssinatura[]
  monitoramento: {
    falhasPendentes: number
    alerta: boolean
  }
}
