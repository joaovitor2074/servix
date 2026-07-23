import type { FormaPagamento } from '../../../shared/types/ordem.types'

export const STATUS_COBRANCA = [
  'PENDENTE',
  'PAGA',
  'EXPIRADA',
  'CANCELADA',
  'ESTORNADA',
] as const

export type StatusCobranca = (typeof STATUS_COBRANCA)[number]

export const STATUS_COBRANCA_LABELS: Record<StatusCobranca, string> = {
  PENDENTE: 'Pendente',
  PAGA: 'Paga',
  EXPIRADA: 'Expirada',
  CANCELADA: 'Cancelada',
  ESTORNADA: 'Estornada',
}

export interface CobrancaInterna {
  id: number
  ordemId: number | null
  orcamentoId: number
  provedor: 'MANUAL' | 'SIMULADO' | 'MERCADO_PAGO' | 'ASAAS'
  ambiente: 'TESTE' | 'PRODUCAO'
  formaPagamento: FormaPagamento
  status: StatusCobranca
  valor: string
  identificadorExterno: string | null
  codigoPix: string | null
  qrCodeBase64: string | null
  expiraEm: string | null
  pagaEm: string | null
  canceladaEm: string | null
  estornadaEm: string | null
  criadoEm: string
  atualizadoEm: string
  pagamento: {
    id: number
    status: 'CONFIRMADO' | 'ESTORNADO'
    pagoEm: string
  } | null
}

export interface ListaCobrancasResposta {
  cobrancas: CobrancaInterna[]
  paginacao: {
    pagina: number
    limite: number
    total: number
    totalPaginas: number
  }
}
