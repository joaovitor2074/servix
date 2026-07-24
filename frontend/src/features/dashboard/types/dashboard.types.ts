import type {
  FormaPagamento,
  StatusOrdem,
} from '../../../shared/types/ordem.types'

export interface OrdemDashboard {
  id: number
  numero: number
  equipamento: string
  status: StatusOrdem
  criadoEm: string
  atualizadoEm: string
  previsaoDeEntrega: string | null
  cliente: {
    id: number
    nome: string
  }
}

export interface OrdemRecente {
  id: number
  numero: number
  equipamento: string
  status: StatusOrdem
  criadoEm: string
  cliente: {
    id: number
    nome: string
  }
}

export type TipoPendenciaDashboard =
  | 'AGUARDANDO_PECA'
  | 'AGUARDANDO_PAGAMENTO'
  | 'AGUARDANDO_ENTREGA'

export interface PendenciaDashboard extends OrdemDashboard {
  tipo: TipoPendenciaDashboard
  pagamento: {
    status: 'PENDENTE' | 'PARCIAL' | 'PAGO' | 'ESTORNADO'
    valorTotal: string
    totalPago: string
    totalEstornado: string
    saldo: string
  } | null
}

export interface ResumoDashboard {
  clientes: {
    total: number
  }
  ordens: {
    total: number
    abertas: number
    aguardandoPeca: number
    prontasParaFinalizar: number
    porStatus: Record<StatusOrdem, number>
    recentes: OrdemRecente[]
    emAberto: OrdemDashboard[]
    pendencias: PendenciaDashboard[]
  }
  orcamentos: {
    aguardandoCliente: number
    aprovadosParaOrdem: number
  }
  cobrancas: {
    pendentes: number
    listaPendentes: CobrancaPendenteDashboard[]
  }
}

export interface CobrancaPendenteDashboard {
  id: number
  valor: string
  formaPagamento: FormaPagamento
  status: 'PENDENTE'
  criadoEm: string
  expiraEm: string | null
  orcamento: {
    id: number
    numero: number
    equipamento: string
    cliente: {
      id: number
      nome: string
    }
  }
  ordem: {
    id: number
    status: StatusOrdem
  } | null
}
