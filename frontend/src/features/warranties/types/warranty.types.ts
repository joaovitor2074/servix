export type StatusGarantiaExibicao = 'ATIVA' | 'EXPIRADA' | 'UTILIZADA' | 'CANCELADA'

export interface GarantiaServico {
  id: number
  codigo: string
  status: 'ATIVA' | 'UTILIZADA' | 'CANCELADA'
  statusExibicao: StatusGarantiaExibicao
  dias: number
  inicioEm: string
  expiraEm: string
  termos: string
  acionadaEm: string | null
  observacaoAcionamento: string | null
  ordem: {
    id: number
    numero: number
    equipamento: string
    servicoRealizado: string | null
    valor: string
    cliente: { id: number; nome: string; telefone: string }
  }
  empresa?: { nome: string; telefone: string | null; email: string | null; cpfCnpj: string | null }
}
