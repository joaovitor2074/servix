import { apiFetch } from '../../../shared/services/api'
import type { MovimentacaoEstoque, ProdutoEstoque, TipoMovimentacaoEstoque } from '../types/inventory.types'

async function ler<T>(resposta: Response): Promise<T> {
  const corpo = await resposta.json().catch(() => null) as { erro?: string } | null
  if (!resposta.ok) throw new Error(corpo?.erro ?? 'Não foi possível concluir a operação')
  return corpo as T
}

export async function listarProdutosEstoque(signal?: AbortSignal) {
  return ler<ProdutoEstoque[]>(await apiFetch('/estoque/produtos?somenteAtivos=true', { signal }))
}

export async function listarMovimentacoesEstoque(signal?: AbortSignal) {
  return ler<MovimentacaoEstoque[]>(await apiFetch('/estoque/movimentacoes?limite=30', { signal }))
}

export async function criarProdutoEstoque(dados: {
  nome: string; sku?: string; unidade: string; quantidade: number; estoqueMinimo: number; custoUnitario: number; precoVenda: number
}) {
  return ler<ProdutoEstoque>(await apiFetch('/estoque/produtos', { method: 'POST', body: JSON.stringify(dados) }))
}

export async function movimentarEstoque(dados: {
  produtoId: number; tipo: TipoMovimentacaoEstoque; quantidade: number; ordemId?: number; observacao?: string
}) {
  return ler<{ produto: ProdutoEstoque; movimentacao: MovimentacaoEstoque }>(await apiFetch('/estoque/movimentacoes', {
    method: 'POST', body: JSON.stringify(dados),
  }))
}
