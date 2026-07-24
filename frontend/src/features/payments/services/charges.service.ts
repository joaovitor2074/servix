import { apiFetch } from '../../../shared/services/api'
import type {
  ListaCobrancasResposta,
  StatusCobranca,
} from '../types/charge.types'

interface ListarCobrancasFiltros {
  orcamentoId?: number
  ordemId?: number
  status?: StatusCobranca
  pagina?: number
  limite?: number
}

interface RequestOptions {
  signal?: AbortSignal
}

export async function listarCobrancas(
  filtros: ListarCobrancasFiltros,
  options: RequestOptions = {},
): Promise<ListaCobrancasResposta> {
  const parametros = new URLSearchParams()

  if (filtros.orcamentoId) {
    parametros.set('orcamentoId', String(filtros.orcamentoId))
  }
  if (filtros.ordemId) parametros.set('ordemId', String(filtros.ordemId))
  if (filtros.status) parametros.set('status', filtros.status)
  if (filtros.pagina) parametros.set('pagina', String(filtros.pagina))
  if (filtros.limite) parametros.set('limite', String(filtros.limite))

  const resposta = await apiFetch(`/cobrancas?${parametros.toString()}`, {
    signal: options.signal,
  })
  const corpo: unknown = await resposta.json()

  if (!resposta.ok) {
    const mensagem =
      typeof corpo === 'object' &&
      corpo !== null &&
      'erro' in corpo &&
      typeof corpo.erro === 'string'
        ? corpo.erro
        : 'Não foi possível carregar as cobranças.'

    throw new Error(mensagem)
  }

  return corpo as ListaCobrancasResposta
}
