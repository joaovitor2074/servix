// Mantém no frontend os mesmos valores do enum StatusOrdem definido no Prisma.
export const STATUS_ORDEM = [
  'ABERTA',
  'EM_ANALISE',
  'AGUARDANDO_APROVACAO',
  'APROVADA',
  'EM_ANDAMENTO',
  'AGUARDANDO_PECA',
  'CONCLUIDA',
  'ENTREGUE',
  'CANCELADA',
] as const

export type StatusOrdem = (typeof STATUS_ORDEM)[number]

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
