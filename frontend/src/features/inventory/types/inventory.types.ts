export type TipoMovimentacaoEstoque = 'ENTRADA' | 'SAIDA_ORDEM' | 'AJUSTE_ENTRADA' | 'AJUSTE_SAIDA' | 'ESTORNO'

export interface ProdutoEstoque {
  id: number
  nome: string
  sku: string | null
  unidade: string
  quantidade: number
  estoqueMinimo: number
  custoUnitario: string
  precoVenda: string
  ativo: boolean
  estoqueBaixo: boolean
  atualizadoEm: string
}

export interface MovimentacaoEstoque {
  id: number
  tipo: TipoMovimentacaoEstoque
  quantidade: number
  saldoAnterior: number
  saldoPosterior: number
  custoUnitario: string
  observacao: string | null
  criadoEm: string
  produto: { id: number; nome: string; sku: string | null; unidade: string }
  ordem: { id: number; numero: number } | null
  criadoPor: { id: number; nome: string } | null
}
