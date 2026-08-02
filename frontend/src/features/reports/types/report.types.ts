import type { StatusOrdem } from '../../../shared/types/ordem.types'

export interface RelatorioOperacional {
  periodo: { inicio: string; fim: string }
  indicadores: {
    totalOrdens: number; ordensEntregues: number; taxaConclusao: number; valorServicos: number; totalRecebido: number; custoPecas: number; lucroEstimado: number; ticketMedio: number; tempoMedioDias: number; produtosEstoqueBaixo: number; garantiasAtivas: number
  }
  porStatus: Record<StatusOrdem, number>
  tecnicos: Array<{ id: number; nome: string; ordens: number; entregues: number; valor: number }>
  equipamentos: Array<{ nome: string; quantidade: number }>
}
