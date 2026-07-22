import type { StatusOrdem } from '../../../shared/types/ordem.types'

export const STATUS_ORCAMENTO = [
  'RASCUNHO',
  'ENVIADO',
  'APROVADO',
  'REJEITADO',
  'EXPIRADO',
  'CONVERTIDO',
  'CANCELADO',
] as const

export type StatusOrcamento = (typeof STATUS_ORCAMENTO)[number]

export const STATUS_ORCAMENTO_LABELS: Record<StatusOrcamento, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADO: 'Enviado',
  APROVADO: 'Aprovado',
  REJEITADO: 'Rejeitado',
  EXPIRADO: 'Expirado',
  CONVERTIDO: 'Convertido em ordem',
  CANCELADO: 'Cancelado',
}

export const TIPOS_ITEM_ORCAMENTO = [
  'SERVICO',
  'PECA',
  'MATERIAL',
] as const

export type TipoItemOrcamento = (typeof TIPOS_ITEM_ORCAMENTO)[number]

export const TIPO_ITEM_ORCAMENTO_LABELS: Record<TipoItemOrcamento, string> = {
  SERVICO: 'Serviço',
  PECA: 'Peça',
  MATERIAL: 'Material',
}

export interface ClienteResumoOrcamento {
  id: number
  nome: string
  telefone: string
  email?: string | null
}

export interface ItemOrcamento {
  id: number
  orcamentoId: number
  descricao: string
  quantidade: number
  valorUnitario: string
  valorTotal: string
  tipo: TipoItemOrcamento
}

export interface OrdemResumoOrcamento {
  id: number
  status?: StatusOrdem
}

export interface Orcamento {
  id: number
  empresaId: number
  clienteId: number
  numero: number
  equipamento: string
  descricaoProblema: string
  status: StatusOrcamento
  subtotal: string
  desconto: string
  total: string
  validade: string | null
  observacoes: string | null
  tokenPublico: string
  versao: number
  enviadoEm: string | null
  aprovadoEm: string | null
  convertidoEm: string | null
  criadoEm: string
  atualizadoEm: string
  cliente: ClienteResumoOrcamento
  itens: ItemOrcamento[]
  ordem: OrdemResumoOrcamento | null
}

export interface ItemOrcamentoInput {
  descricao: string
  quantidade: number
  valorUnitario: number
  tipo: TipoItemOrcamento
}

export interface CriarOrcamentoInput {
  clienteId: number
  equipamento: string
  descricaoProblema: string
  itens: ItemOrcamentoInput[]
  desconto: number
  validade: string | null
  observacoes: string | null
}

export interface AtualizarOrcamentoInput extends CriarOrcamentoInput {
  statusEsperado: 'RASCUNHO'
  versaoEsperada: number
}

export interface AlterarStatusOrcamentoInput {
  statusEsperado: StatusOrcamento
  versaoEsperada: number
  status: StatusOrcamento
}

export interface TransformarOrcamentoResposta {
  ordem: {
    id: number
    status?: StatusOrdem
  }
  jaExistente: boolean
}

export interface OrcamentoPublico {
  numero: number
  equipamento: string
  descricaoProblema: string
  status: StatusOrcamento
  subtotal: string
  desconto: string
  total: string
  validade: string | null
  observacoes?: string | null
  versao: number
  enviadoEm?: string | null
  aprovadoEm?: string | null
  criadoEm?: string
  atualizadoEm?: string
  empresa: {
    nome: string
    telefone?: string | null
    email?: string | null
  }
  cliente: {
    nome: string
  }
  itens: Array<{
    id: number
    descricao: string
    quantidade: number
    valorUnitario: string
    valorTotal: string
    tipo: TipoItemOrcamento
  }>
}
