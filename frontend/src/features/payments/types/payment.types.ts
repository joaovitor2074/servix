import type {
  FormaPagamento,
  StatusOrdem,
} from '../../../shared/types/ordem.types'

export type StatusRegistroPagamento = 'CONFIRMADO' | 'ESTORNADO'
export type StatusResumoPagamento = 'PENDENTE' | 'PARCIAL' | 'PAGO' | 'ESTORNADO'

export interface UsuarioPagamento {
  id: number
  nome: string
  papel: 'ADMIN' | 'ATENDENTE' | 'TECNICO'
}

export interface Pagamento {
  id: number
  ordemId: number
  valor: string
  formaPagamento: FormaPagamento
  status: StatusRegistroPagamento
  origem: 'MANUAL' | 'MIGRACAO'
  observacao: string | null
  pagoEm: string
  estornadoEm: string | null
  motivoEstorno: string | null
  criadoEm: string
  registradoPor: UsuarioPagamento | null
  estornadoPor: UsuarioPagamento | null
}

export interface ResumoPagamento {
  status: StatusResumoPagamento
  valorTotal: string
  totalPago: string
  totalEstornado: string
  saldo: string
}

export interface ListaPagamentosResposta {
  pagamentos: Pagamento[]
  resumo: ResumoPagamento
  statusOrdem: StatusOrdem
  versaoOrdem: number
}

export interface MutacaoPagamentoResposta {
  pagamento: Pagamento
  resumo: ResumoPagamento
  versaoOrdem: number
}

export interface RegistrarPagamentoInput {
  statusEsperado: StatusOrdem
  versaoEsperada: number
  valor: number
  formaPagamento: Exclude<FormaPagamento, 'NAO_INFORMADA'>
  pagoEm?: string
  observacao?: string | null
}

export interface EstornarPagamentoInput {
  statusEsperado: StatusOrdem
  versaoEsperada: number
  motivo: string
}
