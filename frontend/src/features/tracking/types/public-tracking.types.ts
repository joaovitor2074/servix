import type { StatusOrdem } from '../../../shared/types/ordem.types'

export type StatusPagamentoPublico =
  | 'PENDENTE'
  | 'PARCIAL'
  | 'PAGO'
  | 'ESTORNADO'

export interface EmpresaAcompanhamentoPublico {
  nome: string
  telefone: string | null
  email: string | null
}

export interface PagamentoAcompanhamentoPublico {
  status: StatusPagamentoPublico
  valorTotal: string
  totalPago: string
  saldo: string
}

export interface HistoricoAcompanhamentoPublico {
  status: StatusOrdem
  statusDescricao: string
  mensagemPublica: string | null
  criadoEm: string
}

export interface OrdemAcompanhamentoPublico {
  empresa: EmpresaAcompanhamentoPublico
  numero: number
  equipamento: string
  status: StatusOrdem
  statusDescricao: string
  previsaoDeEntrega: string | null
  valorAprovado: string
  pagamento: PagamentoAcompanhamentoPublico
  historico: HistoricoAcompanhamentoPublico[]
}
