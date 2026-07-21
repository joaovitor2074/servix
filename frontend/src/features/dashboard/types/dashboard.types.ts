import type { StatusOrdem } from '../../../shared/types/ordem.types'

export interface OrdemRecente {
  id: number
  equipamento: string
  status: StatusOrdem
  criadoEm: string
  cliente: {
    id: number
    nome: string
  }
}

export interface ResumoDashboard {
  clientes: {
    total: number
  }
  ordens: {
    total: number
    porStatus: Record<StatusOrdem, number>
    recentes: OrdemRecente[]
  }
}
