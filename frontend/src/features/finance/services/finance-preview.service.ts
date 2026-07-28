import { apiFetch } from '../../../shared/services/api'
import { FINANCEIRO_PREVIEW_HABILITADO } from '../config/finance-preview.config'
import {
  somarValoresMonetarios,
  subtrairValoresMonetarios,
} from '../utils/finance-formatters'
import type {
  AuditoriaFinanceira,
  CategoriaFinanceira,
  CentroCustoFinanceiro,
  ContaFinanceira,
  CriarAjusteFinanceiroInput,
  CriarCategoriaFinanceiraInput,
  CriarCentroCustoFinanceiroInput,
  CriarContaFinanceiraInput,
  CriarLancamentoFinanceiroInput,
  CriarTransferenciaFinanceiraInput,
  FinanceiroPreviewSnapshot,
  LancamentoFinanceiro,
  MovimentacaoFinanceira,
  OrigemLancamentoFinanceiro,
  PontoFluxoCaixa,
  RegistrarBaixaFinanceiraInput,
  ResumoFinanceiro,
  StatusLancamentoFinanceiro,
  TipoLancamentoFinanceiro,
  TipoMovimentacaoFinanceira,
} from '../types/finance.types'

const BASE_PATH = '/preview/financeiro'
const PREVIEW_CONFIRMATION_HEADER = 'X-Servix-Preview-Confirmation'
const PREVIEW_CONFIRMATION_VALUE = 'FINANCEIRO_PREVIEW'

interface RequestOptions {
  signal?: AbortSignal
}

type ApiTipoLancamento = 'RECEBER' | 'PAGAR'
type ApiStatusLancamento =
  | 'RASCUNHO'
  | 'PENDENTE'
  | 'PARCIAL'
  | 'QUITADO'
  | 'VENCIDO'
  | 'CANCELADO'
type ApiTipoConta = 'CAIXA' | 'CONTA_BANCARIA' | 'CARTEIRA_DIGITAL' | 'OUTRA'

interface ApiCategoriaFinanceiraDto {
  id: number
  nome: string
  tipo: 'RECEITA' | 'DESPESA'
  cor: string | null
  ativa: boolean
}

interface ApiCentroCustoFinanceiroDto {
  id: number
  nome: string
  codigo: string | null
  ativo: boolean
}

interface ApiContaFinanceiraDto {
  id: number
  nome: string
  instituicao: string | null
  tipo: ApiTipoConta
  cor: string | null
  saldoInicial: string | number
  saldoAtual: string | number
  ativa: boolean
}

interface ApiLancamentoFinanceiroDto {
  id: number
  tipo: ApiTipoLancamento
  status: ApiStatusLancamento
  statusCalculado?: ApiStatusLancamento
  vencido?: boolean
  origem: 'MANUAL' | 'ORDEM_SERVICO' | 'ORCAMENTO' | 'IMPORTACAO'
  descricao: string
  documento: string | null
  contraparte: string | null
  categoriaId: number
  centroCustoId: number | null
  contaPreferidaId: number | null
  valorOriginal: string | number
  valorTotal: string | number
  valorPago?: string | number
  totalBaixado?: string | number
  saldoAberto?: string | number
  dataCompetencia: string
  dataVencimento: string
  pagoEm?: string | null
  ultimaBaixaEm?: string | null
  movimentacoes?: Array<{
    status: 'CONFIRMADA' | 'ESTORNADA'
    valor: string | number
    movimentadoEm: string
  }>
  observacao: string | null
  canceladoEm?: string | null
  motivoCancelamento?: string | null
  versao: number
  criadoEm: string
}

interface ApiMovimentacaoFinanceiraDto {
  id: number
  contaId: number
  lancamentoId: number | null
  tipo: TipoMovimentacaoFinanceira
  status: 'CONFIRMADA' | 'ESTORNADA'
  valor: string | number
  formaPagamento: string
  descricao: string
  documento: string | null
  grupoTransferencia: string | null
  movimentadoEm: string
  estornadoEm: string | null
  motivoEstorno: string | null
  conta?: { id: number; nome: string }
  lancamento?: { id: number; descricao: string } | null
}

interface ApiAuditoriaFinanceiraDto {
  id: number
  acao: string
  entidade: string
  entidadeId: number | null
  criadoEm: string
  usuario?: { id: number; nome: string } | null
}

export class FinanceiroPreviewApiError extends Error {
  readonly status: number
  readonly codigo?: string

  constructor(message: string, status: number, codigo?: string) {
    super(message)
    this.name = 'FinanceiroPreviewApiError'
    this.status = status
    this.codigo = codigo
  }
}

let demonstracaoEmMemoria: FinanceiroPreviewSnapshot | null = null
let sequenciaDemonstracao = 0

export function resetarFinanceiroPreviewEmMemoria() {
  demonstracaoEmMemoria = null
  sequenciaDemonstracao = 0
}

export async function buscarFinanceiroPreview(
  options: RequestOptions = {},
): Promise<FinanceiroPreviewSnapshot> {
  try {
    const intervalo = obterIntervaloFluxo()
    const [
      categoriasBody,
      centrosBody,
      contasBody,
      lancamentosApi,
      movimentacoesApi,
      fluxoBody,
      auditoriaBody,
    ] =
      await Promise.all([
        obterJson(`${BASE_PATH}/categorias`, { signal: options.signal }),
        obterJson(`${BASE_PATH}/centros-custo`, { signal: options.signal }),
        obterJson(`${BASE_PATH}/contas`, { signal: options.signal }),
        listarTodosLancamentosApi(options.signal),
        listarTodasMovimentacoesApi(options.signal),
        obterJson(
          `${BASE_PATH}/fluxo-caixa?inicio=${intervalo.inicio}&fim=${intervalo.fim}`,
          { signal: options.signal },
        ),
        obterJson(`${BASE_PATH}/auditoria?pagina=1&limite=20`, {
          signal: options.signal,
        }),
      ])

    const categorias = extrairLista(categoriasBody).map(mapearCategoriaApi)
    const centrosCusto = extrairLista(centrosBody).map(mapearCentroCustoApi)
    const contas = extrairLista(contasBody).map(mapearContaApi)
    const lancamentos = lancamentosApi.map(mapearLancamentoApi)
    const movimentacoes = movimentacoesApi.map(mapearMovimentacaoApi)
    const auditoria = extrairLista(auditoriaBody).map(mapearAuditoriaApi)
    const fluxoRecebido = mapearFluxoCaixaApi(fluxoBody)
    const fluxoCaixa = fluxoRecebido.length > 0
      ? fluxoRecebido
      : calcularFluxoCaixa(lancamentos, movimentacoes)

    demonstracaoEmMemoria = null
    return {
      ambiente: 'PREVIEW',
      atualizadoEm: new Date().toISOString(),
      fonte: 'API_PREVIEW',
      resumo: calcularResumo(lancamentos, contas),
      lancamentos,
      categorias,
      centrosCusto,
      contas,
      movimentacoes,
      auditoria,
      fluxoCaixa,
    }
  } catch (error) {
    if (options.signal?.aborted) throw criarAbortError()
    if (!deveUsarDemonstracao(error)) throw error

    demonstracaoEmMemoria ??= criarDemonstracaoFinanceira()
    return clonar(demonstracaoEmMemoria)
  }
}

async function listarTodosLancamentosApi(signal?: AbortSignal) {
  const todos: Record<string, unknown>[] = []
  let pagina = 1

  while (true) {
    const corpo = await obterJson(
      `${BASE_PATH}/lancamentos?pagina=${pagina}&limite=100`,
      { signal },
    )
    todos.push(...extrairLista(corpo))

    const paginacao = comoRegistro(comoRegistro(corpo)?.paginacao)
    const totalPaginas = Math.max(
      1,
      Math.trunc(lerNumero(paginacao?.totalPaginas, 1)),
    )
    if (totalPaginas > 1_000) {
      throw new Error('A consulta financeira excedeu o limite seguro da preview.')
    }
    if (pagina >= totalPaginas) break
    pagina += 1
  }

  return todos
}

async function listarTodasMovimentacoesApi(signal?: AbortSignal) {
  const todas: Record<string, unknown>[] = []
  let pagina = 1

  while (true) {
    const corpo = await obterJson(
      `${BASE_PATH}/movimentacoes?pagina=${pagina}&limite=100&incluirEstornadas=true`,
      { signal },
    )
    todas.push(...extrairLista(corpo))

    const paginacao = comoRegistro(comoRegistro(corpo)?.paginacao)
    const totalPaginas = Math.max(
      1,
      Math.trunc(lerNumero(paginacao?.totalPaginas, 1)),
    )
    if (totalPaginas > 1_000) {
      throw new Error('O extrato financeiro excedeu o limite seguro da preview.')
    }
    if (pagina >= totalPaginas) break
    pagina += 1
  }

  return todas
}

export async function criarLancamentoFinanceiroPreview(
  dados: CriarLancamentoFinanceiroInput,
): Promise<FinanceiroPreviewSnapshot> {
  if (demonstracaoEmMemoria) {
    const hoje = dataCivil(new Date())
    const lancamento: LancamentoFinanceiro = {
      id: `demo-lancamento-${Date.now()}`,
      tipo: dados.tipo,
      descricao: dados.descricao,
      contraparte: dados.contraparte,
      valor: dados.valor,
      valorPago: 0,
      valorBaixadoNoMes: 0,
      vencimento: dados.vencimento,
      competencia: dados.competencia,
      status: dados.vencimento < hoje ? 'VENCIDO' : 'PENDENTE',
      categoriaId: dados.categoriaId,
      centroCustoId: dados.centroCustoId,
      ...(dados.contaId ? { contaId: dados.contaId } : {}),
      origem: 'MANUAL',
      ...(dados.observacao ? { observacao: dados.observacao } : {}),
      versao: 1,
      criadoEm: new Date().toISOString(),
    }
    demonstracaoEmMemoria.lancamentos.unshift(lancamento)
    registrarAuditoriaDemonstracao(
      'LANCAMENTO_CRIADO',
      'LancamentoFinanceiro',
      lancamento.id,
    )
    return atualizarDemonstracao()
  }

  await obterJson(`${BASE_PATH}/lancamentos`, {
    method: 'POST',
    headers: cabecalhosMutacaoPreview(),
    body: JSON.stringify({
      tipo: mapearTipoLancamentoParaApi(dados.tipo),
      status: 'PENDENTE',
      descricao: dados.descricao,
      contraparte: dados.contraparte,
      categoriaId: Number(dados.categoriaId),
      centroCustoId: Number(dados.centroCustoId),
      contaPreferidaId: dados.contaId ? Number(dados.contaId) : null,
      valorOriginal: dados.valor,
      desconto: 0,
      juros: 0,
      multa: 0,
      dataCompetencia: dados.competencia,
      dataVencimento: dados.vencimento,
      ...(dados.observacao ? { observacao: dados.observacao } : {}),
    }),
  })

  return buscarFinanceiroPreview()
}

export async function registrarBaixaFinanceiraPreview(
  lancamentoId: string,
  dados: RegistrarBaixaFinanceiraInput,
): Promise<FinanceiroPreviewSnapshot> {
  if (demonstracaoEmMemoria) {
    const lancamento = demonstracaoEmMemoria.lancamentos.find(item => item.id === lancamentoId)
    if (!lancamento) throw new Error('Lançamento não encontrado na demonstração.')
    const restante = Math.max(
      subtrairValoresMonetarios(lancamento.valor, lancamento.valorPago),
      0,
    )
    if (dados.valor > restante) throw new Error('A baixa não pode superar o valor em aberto.')

    lancamento.valorPago = somarValoresMonetarios(
      lancamento.valorPago,
      dados.valor,
    )
    if (dados.pagoEm.slice(0, 7) === dataCivil(new Date()).slice(0, 7)) {
      lancamento.valorBaixadoNoMes = somarValoresMonetarios(
        lancamento.valorBaixadoNoMes,
        dados.valor,
      )
    }
    lancamento.pagoEm = dados.pagoEm
    lancamento.contaId = dados.contaId
    lancamento.status = lancamento.valorPago >= lancamento.valor ? 'PAGO' : 'PARCIAL'
    lancamento.versao += 1

    const conta = demonstracaoEmMemoria.contas.find(item => item.id === dados.contaId)
    if (conta) {
      conta.saldo = somarValoresMonetarios(
        conta.saldo,
        lancamento.tipo === 'RECEITA' ? dados.valor : -dados.valor,
      )
    }
    const movimentacao: MovimentacaoFinanceira = {
      id: `demo-movimento-${Date.now()}`,
      contaId: dados.contaId,
      contaNome: conta?.nome ?? 'Conta de demonstração',
      lancamentoId: lancamento.id,
      lancamentoDescricao: lancamento.descricao,
      tipo: lancamento.tipo === 'RECEITA' ? 'ENTRADA' : 'SAIDA',
      status: 'CONFIRMADA',
      valor: dados.valor,
      formaPagamento: 'OUTRO',
      descricao: `Baixa de ${lancamento.descricao}`,
      movimentadoEm: dados.pagoEm,
    }
    demonstracaoEmMemoria.movimentacoes.unshift(movimentacao)
    registrarAuditoriaDemonstracao(
      'BAIXA_REGISTRADA',
      'MovimentacaoFinanceira',
      movimentacao.id,
    )
    return atualizarDemonstracao()
  }

  const lancamentoAtual = await obterJson(`${BASE_PATH}/lancamentos/${Number(lancamentoId)}`)
  const dto = extrairEntidade(lancamentoAtual, 'lancamento')
  const versaoEsperada = lerNumero(dto.versao, 1)

  await obterJson(`${BASE_PATH}/lancamentos/${Number(lancamentoId)}/baixas`, {
    method: 'POST',
    headers: cabecalhosMutacaoPreview(),
    body: JSON.stringify({
      contaId: Number(dados.contaId),
      valor: dados.valor,
      formaPagamento: 'OUTRO',
      movimentadoEm: dados.pagoEm,
      versaoEsperada,
    }),
  })

  return buscarFinanceiroPreview()
}

export async function criarAjusteFinanceiroPreview(
  dados: CriarAjusteFinanceiroInput,
): Promise<FinanceiroPreviewSnapshot> {
  if (demonstracaoEmMemoria) {
    const conta = demonstracaoEmMemoria.contas.find(
      item => item.id === dados.contaId && item.ativa,
    )
    if (!conta) throw new Error('Selecione uma conta financeira ativa.')

    const movimentacao: MovimentacaoFinanceira = {
      id: criarIdDemonstracao('movimento'),
      contaId: conta.id,
      contaNome: conta.nome,
      tipo: dados.direcao === 'ENTRADA' ? 'AJUSTE_ENTRADA' : 'AJUSTE_SAIDA',
      status: 'CONFIRMADA',
      valor: dados.valor,
      formaPagamento: 'NAO_INFORMADA',
      descricao: dados.descricao,
      ...(dados.documento ? { documento: dados.documento } : {}),
      movimentadoEm: dados.movimentadoEm,
    }
    conta.saldo = somarValoresMonetarios(
      conta.saldo,
      dados.direcao === 'ENTRADA' ? dados.valor : -dados.valor,
    )
    demonstracaoEmMemoria.movimentacoes.unshift(movimentacao)
    registrarAuditoriaDemonstracao(
      'AJUSTE_REGISTRADO',
      'MovimentacaoFinanceira',
      movimentacao.id,
    )
    return atualizarDemonstracao()
  }

  await obterJson(`${BASE_PATH}/movimentacoes/ajustes`, {
    method: 'POST',
    headers: cabecalhosMutacaoPreview(),
    body: JSON.stringify({
      contaId: Number(dados.contaId),
      direcao: dados.direcao,
      valor: dados.valor,
      descricao: dados.descricao,
      ...(dados.documento ? { documento: dados.documento } : {}),
      movimentadoEm: dados.movimentadoEm,
    }),
  })
  return buscarFinanceiroPreview()
}

export async function criarTransferenciaFinanceiraPreview(
  dados: CriarTransferenciaFinanceiraInput,
): Promise<FinanceiroPreviewSnapshot> {
  if (demonstracaoEmMemoria) {
    const origem = demonstracaoEmMemoria.contas.find(
      item => item.id === dados.contaOrigemId && item.ativa,
    )
    const destino = demonstracaoEmMemoria.contas.find(
      item => item.id === dados.contaDestinoId && item.ativa,
    )
    if (!origem || !destino) throw new Error('Selecione duas contas financeiras ativas.')
    if (origem.id === destino.id) throw new Error('As contas de origem e destino devem ser diferentes.')

    const grupoTransferencia = criarIdDemonstracao('transferencia')
    const saida: MovimentacaoFinanceira = {
      id: criarIdDemonstracao('movimento-saida'),
      contaId: origem.id,
      contaNome: origem.nome,
      tipo: 'TRANSFERENCIA_SAIDA',
      status: 'CONFIRMADA',
      valor: dados.valor,
      formaPagamento: 'NAO_INFORMADA',
      descricao: dados.descricao,
      grupoTransferencia,
      movimentadoEm: dados.movimentadoEm,
    }
    const entrada: MovimentacaoFinanceira = {
      ...saida,
      id: criarIdDemonstracao('movimento-entrada'),
      contaId: destino.id,
      contaNome: destino.nome,
      tipo: 'TRANSFERENCIA_ENTRADA',
    }
    origem.saldo = subtrairValoresMonetarios(origem.saldo, dados.valor)
    destino.saldo = somarValoresMonetarios(destino.saldo, dados.valor)
    demonstracaoEmMemoria.movimentacoes.unshift(entrada, saida)
    registrarAuditoriaDemonstracao(
      'TRANSFERENCIA_ENTRADA_REGISTRADA',
      'MovimentacaoFinanceira',
      entrada.id,
    )
    registrarAuditoriaDemonstracao(
      'TRANSFERENCIA_SAIDA_REGISTRADA',
      'MovimentacaoFinanceira',
      saida.id,
    )
    return atualizarDemonstracao()
  }

  await obterJson(`${BASE_PATH}/transferencias`, {
    method: 'POST',
    headers: cabecalhosMutacaoPreview(),
    body: JSON.stringify({
      contaOrigemId: Number(dados.contaOrigemId),
      contaDestinoId: Number(dados.contaDestinoId),
      valor: dados.valor,
      descricao: dados.descricao,
      movimentadoEm: dados.movimentadoEm,
    }),
  })
  return buscarFinanceiroPreview()
}

export async function estornarMovimentacaoFinanceiraPreview(
  movimentacao: MovimentacaoFinanceira,
  motivo: string,
  versaoLancamento?: number,
): Promise<FinanceiroPreviewSnapshot> {
  if (demonstracaoEmMemoria) {
    const atual = demonstracaoEmMemoria.movimentacoes.find(
      item => item.id === movimentacao.id,
    )
    if (!atual) throw new Error('Movimentação não encontrada na demonstração.')
    if (atual.status === 'ESTORNADA') throw new Error('Esta movimentação já foi estornada.')

    const afetadas = atual.grupoTransferencia
      ? demonstracaoEmMemoria.movimentacoes.filter(
          item => item.grupoTransferencia === atual.grupoTransferencia && item.status === 'CONFIRMADA',
        )
      : [atual]
    const estornadoEm = new Date().toISOString()

    for (const item of afetadas) {
      item.status = 'ESTORNADA'
      item.estornadoEm = estornadoEm
      item.motivoEstorno = motivo
      const conta = demonstracaoEmMemoria.contas.find(contaItem => contaItem.id === item.contaId)
      if (conta) {
        conta.saldo = somarValoresMonetarios(
          conta.saldo,
          movimentacaoEhEntrada(item.tipo) ? -item.valor : item.valor,
        )
      }
      registrarAuditoriaDemonstracao(
        item.lancamentoId
          ? 'BAIXA_ESTORNADA'
          : item.grupoTransferencia
            ? 'TRANSFERENCIA_ESTORNADA'
            : 'AJUSTE_ESTORNADO',
        'MovimentacaoFinanceira',
        item.id,
      )
    }

    if (atual.lancamentoId) {
      const lancamento = demonstracaoEmMemoria.lancamentos.find(
        item => item.id === atual.lancamentoId,
      )
      if (!lancamento) throw new Error('Lançamento relacionado não encontrado.')
      atualizarBaixasDemonstracao(lancamento)
      lancamento.versao += 1
    }
    return atualizarDemonstracao()
  }

  if (movimentacao.lancamentoId) {
    if (!versaoLancamento) {
      throw new Error('Não foi possível determinar a versão atual do lançamento.')
    }
    await obterJson(
      `${BASE_PATH}/lancamentos/${Number(movimentacao.lancamentoId)}/baixas/${Number(movimentacao.id)}/estornar`,
      {
        method: 'POST',
        headers: cabecalhosMutacaoPreview(),
        body: JSON.stringify({ motivo, versaoEsperada: versaoLancamento }),
      },
    )
  } else {
    await obterJson(`${BASE_PATH}/movimentacoes/${Number(movimentacao.id)}/estornar`, {
      method: 'POST',
      headers: cabecalhosMutacaoPreview(),
      body: JSON.stringify({ motivo }),
    })
  }
  return buscarFinanceiroPreview()
}

export async function cancelarLancamentoFinanceiroPreview(
  lancamento: LancamentoFinanceiro,
  motivo: string,
): Promise<FinanceiroPreviewSnapshot> {
  if (demonstracaoEmMemoria) {
    const atual = demonstracaoEmMemoria.lancamentos.find(item => item.id === lancamento.id)
    if (!atual) throw new Error('Lançamento não encontrado na demonstração.')
    const possuiBaixas = demonstracaoEmMemoria.movimentacoes.some(
      item => item.lancamentoId === atual.id && item.status === 'CONFIRMADA',
    )
    if (possuiBaixas) throw new Error('Estorne as baixas antes de cancelar o lançamento.')
    if (atual.status === 'CANCELADO') throw new Error('Este lançamento já foi cancelado.')
    atual.status = 'CANCELADO'
    atual.canceladoEm = new Date().toISOString()
    atual.motivoCancelamento = motivo
    atual.versao += 1
    registrarAuditoriaDemonstracao(
      'LANCAMENTO_CANCELADO',
      'LancamentoFinanceiro',
      atual.id,
    )
    return atualizarDemonstracao()
  }

  await obterJson(`${BASE_PATH}/lancamentos/${Number(lancamento.id)}/cancelar`, {
    method: 'POST',
    headers: cabecalhosMutacaoPreview(),
    body: JSON.stringify({ motivo, versaoEsperada: lancamento.versao }),
  })
  return buscarFinanceiroPreview()
}

export async function criarCategoriaFinanceiraPreview(
  dados: CriarCategoriaFinanceiraInput,
): Promise<FinanceiroPreviewSnapshot> {
  if (demonstracaoEmMemoria) {
    demonstracaoEmMemoria.categorias.push({
      id: criarIdDemonstracao('categoria'),
      nome: dados.nome,
      tipo: dados.tipo,
      cor: dados.cor,
      ativa: true,
    })
    const categoria = demonstracaoEmMemoria.categorias.at(-1)
    if (categoria) registrarAuditoriaDemonstracao('CATEGORIA_CRIADA', 'CategoriaFinanceira', categoria.id)
    return atualizarDemonstracao()
  }

  await obterJson(`${BASE_PATH}/categorias`, {
    method: 'POST',
    headers: cabecalhosMutacaoPreview(),
    body: JSON.stringify(dados),
  })
  return buscarFinanceiroPreview()
}

export async function criarCentroCustoFinanceiroPreview(
  dados: CriarCentroCustoFinanceiroInput,
): Promise<FinanceiroPreviewSnapshot> {
  if (demonstracaoEmMemoria) {
    demonstracaoEmMemoria.centrosCusto.push({
      id: criarIdDemonstracao('centro'),
      nome: dados.nome,
      codigo: dados.codigo,
      ativo: true,
    })
    const centro = demonstracaoEmMemoria.centrosCusto.at(-1)
    if (centro) registrarAuditoriaDemonstracao('CENTRO_CUSTO_CRIADO', 'CentroCustoFinanceiro', centro.id)
    return atualizarDemonstracao()
  }

  await obterJson(`${BASE_PATH}/centros-custo`, {
    method: 'POST',
    headers: cabecalhosMutacaoPreview(),
    body: JSON.stringify(dados),
  })
  return buscarFinanceiroPreview()
}

export async function criarContaFinanceiraPreview(
  dados: CriarContaFinanceiraInput,
): Promise<FinanceiroPreviewSnapshot> {
  if (demonstracaoEmMemoria) {
    demonstracaoEmMemoria.contas.push({
      id: criarIdDemonstracao('conta'),
      nome: dados.nome,
      instituicao: dados.instituicao,
      tipo: dados.tipo,
      saldo: dados.saldo,
      cor: dados.cor,
      ativa: true,
    })
    const conta = demonstracaoEmMemoria.contas.at(-1)
    if (conta) registrarAuditoriaDemonstracao('CONTA_CRIADA', 'ContaFinanceira', conta.id)
    return atualizarDemonstracao()
  }

  await obterJson(`${BASE_PATH}/contas`, {
    method: 'POST',
    headers: cabecalhosMutacaoPreview(),
    body: JSON.stringify({
      nome: dados.nome,
      instituicao: dados.instituicao,
      tipo: mapearTipoContaParaApi(dados.tipo),
      saldoInicial: dados.saldo,
      dataSaldoInicial: dataCivil(new Date()),
      cor: dados.cor,
    }),
  })
  return buscarFinanceiroPreview()
}

async function obterJson(caminho: string, opcoes: RequestInit = {}) {
  let resposta: Response | undefined
  const permiteNovaTentativa = opcoes.method?.toUpperCase() === 'POST'

  for (let tentativa = 0; tentativa <= (permiteNovaTentativa ? 1 : 0); tentativa += 1) {
    try {
      resposta = await apiFetch(caminho, opcoes)
      break
    } catch (error) {
      if (opcoes.signal?.aborted) throw criarAbortError()
      const deveRepetir =
        permiteNovaTentativa && tentativa === 0 && error instanceof TypeError
      if (!deveRepetir) throw error
    }
  }

  if (!resposta) throw new TypeError('Não foi possível acessar a API financeira.')

  const texto = await resposta.text()
  let corpo: unknown = null
  if (texto) {
    try {
      corpo = JSON.parse(texto) as unknown
    } catch {
      corpo = texto
    }
  }

  if (!resposta.ok) {
    const registro = comoRegistro(corpo)
    throw new FinanceiroPreviewApiError(
      typeof registro?.erro === 'string'
        ? registro.erro
        : 'Não foi possível acessar o financeiro de preview.',
      resposta.status,
      typeof registro?.codigo === 'string' ? registro.codigo : undefined,
    )
  }

  return corpo
}

function cabecalhosMutacaoPreview() {
  return {
    [PREVIEW_CONFIRMATION_HEADER]: PREVIEW_CONFIRMATION_VALUE,
    'Idempotency-Key': criarChaveIdempotencia(),
  }
}

function criarChaveIdempotencia() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
    return `servix-preview-${[...bytes]
      .map(valor => valor.toString(16).padStart(2, '0'))
      .join('')}`
  }

  throw new Error('Não foi possível gerar uma chave segura para a operação.')
}

function deveUsarDemonstracao(error: unknown) {
  if (!FINANCEIRO_PREVIEW_HABILITADO) return false
  if (error instanceof FinanceiroPreviewApiError) {
    return [404, 501, 503].includes(error.status)
  }
  return error instanceof TypeError
}

function extrairLista(corpo: unknown): Record<string, unknown>[] {
  if (Array.isArray(corpo)) return corpo.filter(ehRegistro)
  const registro = comoRegistro(corpo)
  if (!registro) return []

  for (const chave of ['dados', 'itens', 'categorias', 'centrosCusto', 'contas', 'lancamentos', 'movimentacoes', 'pontos', 'periodos', 'fluxoCaixa']) {
    const valor = registro[chave]
    if (Array.isArray(valor)) return valor.filter(ehRegistro)
  }

  return []
}

function extrairEntidade(corpo: unknown, chave: string) {
  const registro = comoRegistro(corpo)
  const aninhado = comoRegistro(registro?.[chave])
  return aninhado ?? registro ?? {}
}

function mapearCategoriaApi(registro: Record<string, unknown>): CategoriaFinanceira {
  const dto = registro as unknown as ApiCategoriaFinanceiraDto
  return {
    id: String(dto.id),
    nome: dto.nome,
    tipo: dto.tipo,
    cor: dto.cor ?? (dto.tipo === 'RECEITA' ? '#08a45c' : '#d35454'),
    ativa: dto.ativa,
  }
}

function mapearCentroCustoApi(registro: Record<string, unknown>): CentroCustoFinanceiro {
  const dto = registro as unknown as ApiCentroCustoFinanceiroDto
  return {
    id: String(dto.id),
    nome: dto.nome,
    codigo: dto.codigo ?? `CC-${dto.id}`,
    ativo: dto.ativo,
  }
}

function mapearContaApi(registro: Record<string, unknown>): ContaFinanceira {
  const dto = registro as unknown as ApiContaFinanceiraDto
  return {
    id: String(dto.id),
    nome: dto.nome,
    instituicao: dto.instituicao ?? 'Instituição não informada',
    tipo: mapearTipoContaDaApi(dto.tipo),
    saldo: lerNumero(dto.saldoAtual ?? dto.saldoInicial),
    cor: dto.cor ?? '#0648d8',
    ativa: dto.ativa,
  }
}

function mapearMovimentacaoApi(
  registro: Record<string, unknown>,
): MovimentacaoFinanceira {
  const dto = registro as unknown as ApiMovimentacaoFinanceiraDto
  return {
    id: String(dto.id),
    contaId: String(dto.contaId),
    contaNome: dto.conta?.nome ?? `Conta #${dto.contaId}`,
    ...(dto.lancamentoId ? { lancamentoId: String(dto.lancamentoId) } : {}),
    ...(dto.lancamento?.descricao
      ? { lancamentoDescricao: dto.lancamento.descricao }
      : {}),
    tipo: dto.tipo,
    status: dto.status,
    valor: lerNumero(dto.valor),
    formaPagamento: dto.formaPagamento,
    descricao: dto.descricao,
    ...(dto.documento ? { documento: dto.documento } : {}),
    ...(dto.grupoTransferencia
      ? { grupoTransferencia: dto.grupoTransferencia }
      : {}),
    movimentadoEm: dto.movimentadoEm,
    ...(dto.estornadoEm ? { estornadoEm: dto.estornadoEm } : {}),
    ...(dto.motivoEstorno ? { motivoEstorno: dto.motivoEstorno } : {}),
  }
}

function mapearAuditoriaApi(
  registro: Record<string, unknown>,
): AuditoriaFinanceira {
  const dto = registro as unknown as ApiAuditoriaFinanceiraDto
  return {
    id: String(dto.id),
    acao: dto.acao,
    entidade: dto.entidade,
    ...(dto.entidadeId ? { entidadeId: String(dto.entidadeId) } : {}),
    usuarioNome: dto.usuario?.nome ?? 'Sistema',
    criadoEm: dto.criadoEm,
  }
}

function mapearLancamentoApi(registro: Record<string, unknown>): LancamentoFinanceiro {
  const dto = registro as unknown as ApiLancamentoFinanceiroDto
  const valor = lerNumero(dto.valorTotal ?? dto.valorOriginal)
  const movimentacoesConfirmadas = (dto.movimentacoes ?? [])
    .filter(item => item.status === 'CONFIRMADA')
  const valorMovimentacoes = somarValoresMonetarios(
    ...movimentacoesConfirmadas.map(item => lerNumero(item.valor)),
  )
  const saldoAberto = lerNumero(dto.saldoAberto, Number.NaN)
  const valorPagoRecebido = lerNumero(
    dto.valorPago ?? dto.totalBaixado ?? (movimentacoesConfirmadas.length > 0 ? valorMovimentacoes : undefined),
    Number.NaN,
  )
  const valorPago = Number.isFinite(valorPagoRecebido)
    ? valorPagoRecebido
    : Number.isFinite(saldoAberto)
      ? Math.max(subtrairValoresMonetarios(valor, saldoAberto), 0)
      : dto.status === 'QUITADO'
        ? valor
        : 0
  const vencimento = dataCivil(dto.dataVencimento)
  const ultimaMovimentacao = movimentacoesConfirmadas
    .sort((a, b) => b.movimentadoEm.localeCompare(a.movimentadoEm))[0]
  const dataBaixa = dto.pagoEm ?? dto.ultimaBaixaEm ?? ultimaMovimentacao?.movimentadoEm
  const mesAtual = dataCivil(new Date()).slice(0, 7)
  const valorBaixadoNoMes = somarValoresMonetarios(
    ...movimentacoesConfirmadas
      .filter(item => dataCivil(item.movimentadoEm).slice(0, 7) === mesAtual)
      .map(item => lerNumero(item.valor)),
  )

  return {
    id: String(dto.id),
    tipo: dto.tipo === 'RECEBER' ? 'RECEITA' : 'DESPESA',
    descricao: dto.descricao,
    contraparte: dto.contraparte ?? 'Não informado',
    ...(dto.documento ? { documento: dto.documento } : {}),
    valor,
    valorPago,
    valorBaixadoNoMes,
    vencimento,
    competencia: dataCivil(dto.dataCompetencia),
    ...(dataBaixa ? { pagoEm: dataCivil(dataBaixa) } : {}),
    status: mapearStatusDaApi(dto.statusCalculado ?? dto.status, vencimento, dto.vencido),
    categoriaId: String(dto.categoriaId),
    centroCustoId: dto.centroCustoId ? String(dto.centroCustoId) : '',
    ...(dto.contaPreferidaId ? { contaId: String(dto.contaPreferidaId) } : {}),
    origem: mapearOrigemDaApi(dto.origem),
    ...(dto.documento ? { referencia: dto.documento } : {}),
    ...(dto.observacao ? { observacao: dto.observacao } : {}),
    ...(dto.canceladoEm ? { canceladoEm: dto.canceladoEm } : {}),
    ...(dto.motivoCancelamento
      ? { motivoCancelamento: dto.motivoCancelamento }
      : {}),
    versao: dto.versao ?? 1,
    criadoEm: dto.criadoEm,
  }
}

function mapearPontoFluxoApi(registro: Record<string, unknown>): PontoFluxoCaixa {
  const periodo = lerTexto(registro.periodo ?? registro.mes ?? registro.data, dataCivil(new Date()))
  const saldosIniciais = lerNumero(registro.saldosIniciais)
  const realizadoEntradas = lerNumero(
    registro.realizadoEntradas ?? registro.receitas ?? registro.entradas,
  )
  const realizadoSaidas = lerNumero(
    registro.realizadoSaidas ?? registro.despesas ?? registro.saidas,
  )
  const previstoEntradas = lerNumero(registro.previstoEntradas)
  const previstoSaidas = lerNumero(registro.previstoSaidas)
  const saldoRealizadoPadrao = subtrairValoresMonetarios(
    somarValoresMonetarios(saldosIniciais, realizadoEntradas),
    realizadoSaidas,
  )
  const saldoPrevistoPadrao = subtrairValoresMonetarios(
    somarValoresMonetarios(saldoRealizadoPadrao, previstoEntradas),
    previstoSaidas,
  )

  return {
    periodo: periodo.slice(0, 7),
    rotulo: lerTexto(registro.rotulo, rotuloMes(periodo)),
    saldosIniciais,
    realizadoEntradas,
    realizadoSaidas,
    previstoEntradas,
    previstoSaidas,
    saldoRealizadoAcumulado: lerNumero(
      registro.saldoRealizadoAcumulado,
      saldoRealizadoPadrao,
    ),
    saldoPrevistoAcumulado: lerNumero(
      registro.saldoPrevistoAcumulado,
      saldoPrevistoPadrao,
    ),
  }
}

function mapearFluxoCaixaApi(corpo: unknown): PontoFluxoCaixa[] {
  const raiz = comoRegistro(corpo)
  const fluxo = comoRegistro(raiz?.fluxo) ?? raiz
  const dias = Array.isArray(fluxo?.dias)
    ? fluxo.dias.filter(ehRegistro)
    : extrairLista(corpo)

  if (dias.length === 0) return []

  const agrupado = new Map<string, {
    saldosIniciais: number
    realizadoEntradas: number
    realizadoSaidas: number
    previstoEntradas: number
    previstoSaidas: number
    ultimaData: string
    saldoRealizadoAcumulado: number
    saldoPrevistoAcumulado: number
  }>()
  for (const dia of dias) {
    const data = lerTexto(
      dia.data ?? dia.periodo ?? dia.mes,
      dataCivil(new Date()),
    )
    const periodo = data.slice(0, 7)
    const atual = agrupado.get(periodo) ?? {
      saldosIniciais: 0,
      realizadoEntradas: 0,
      realizadoSaidas: 0,
      previstoEntradas: 0,
      previstoSaidas: 0,
      ultimaData: '',
      saldoRealizadoAcumulado: 0,
      saldoPrevistoAcumulado: 0,
    }
    atual.saldosIniciais = somarValoresMonetarios(
      atual.saldosIniciais,
      lerNumero(dia.saldosIniciais),
    )
    atual.realizadoEntradas = somarValoresMonetarios(
      atual.realizadoEntradas,
      lerNumero(dia.realizadoEntradas),
    )
    atual.realizadoSaidas = somarValoresMonetarios(
      atual.realizadoSaidas,
      lerNumero(dia.realizadoSaidas),
    )
    atual.previstoEntradas = somarValoresMonetarios(
      atual.previstoEntradas,
      lerNumero(dia.previstoEntradas),
    )
    atual.previstoSaidas = somarValoresMonetarios(
      atual.previstoSaidas,
      lerNumero(dia.previstoSaidas),
    )
    if (data >= atual.ultimaData) {
      atual.ultimaData = data
      atual.saldoRealizadoAcumulado = lerNumero(dia.saldoRealizadoAcumulado)
      atual.saldoPrevistoAcumulado = lerNumero(dia.saldoPrevistoAcumulado)
    }
    agrupado.set(periodo, atual)
  }

  return [...agrupado.entries()]
    .sort(([periodoA], [periodoB]) => periodoA.localeCompare(periodoB))
    .map(([periodo, valores]) => mapearPontoFluxoApi({
      periodo,
      ...valores,
    }))
}

function mapearTipoLancamentoParaApi(tipo: TipoLancamentoFinanceiro): ApiTipoLancamento {
  return tipo === 'RECEITA' ? 'RECEBER' : 'PAGAR'
}

function mapearStatusDaApi(
  status: ApiStatusLancamento,
  vencimento: string,
  vencido?: boolean,
): StatusLancamentoFinanceiro {
  if (status === 'QUITADO') return 'PAGO'
  if (status === 'RASCUNHO') return 'AGENDADO'
  if (vencido || ((status === 'PENDENTE' || status === 'PARCIAL') && vencimento < dataCivil(new Date()))) return 'VENCIDO'
  return status
}

function mapearOrigemDaApi(origem: ApiLancamentoFinanceiroDto['origem']): OrigemLancamentoFinanceiro {
  return origem
}

function mapearTipoContaDaApi(tipo: ApiTipoConta): ContaFinanceira['tipo'] {
  if (tipo === 'CONTA_BANCARIA') return 'CONTA_CORRENTE'
  return tipo
}

function mapearTipoContaParaApi(tipo: ContaFinanceira['tipo']): ApiTipoConta {
  if (tipo === 'CONTA_CORRENTE') return 'CONTA_BANCARIA'
  return tipo
}

function calcularResumo(
  lancamentos: LancamentoFinanceiro[],
  contas: ContaFinanceira[],
): ResumoFinanceiro {
  const abertos = lancamentos.filter(item => !['PAGO', 'CANCELADO'].includes(item.status))
  const receitas = abertos.filter(item => item.tipo === 'RECEITA')
  const despesas = abertos.filter(item => item.tipo === 'DESPESA')
  const somarAberto = (itens: LancamentoFinanceiro[]) =>
    somarValoresMonetarios(...itens.map(item =>
      Math.max(subtrairValoresMonetarios(item.valor, item.valorPago), 0),
    ))
  const baixadosNoMes = lancamentos.filter(item => item.valorBaixadoNoMes > 0)
  const recebidoNoMes = baixadosNoMes
    .filter(item => item.tipo === 'RECEITA')
    .map(item => item.valorBaixadoNoMes)
  const pagoNoMes = baixadosNoMes
    .filter(item => item.tipo === 'DESPESA')
    .map(item => item.valorBaixadoNoMes)
  const recebidoNoMesTotal = somarValoresMonetarios(...recebidoNoMes)
  const pagoNoMesTotal = somarValoresMonetarios(...pagoNoMes)
  const contasAReceber = somarAberto(receitas)
  const contasAPagar = somarAberto(despesas)

  return {
    saldoDisponivel: somarValoresMonetarios(
      ...contas.filter(item => item.ativa).map(item => item.saldo),
    ),
    contasAReceber,
    contasAPagar,
    resultadoPrevisto: subtrairValoresMonetarios(contasAReceber, contasAPagar),
    vencidoAReceber: somarAberto(receitas.filter(item => item.status === 'VENCIDO')),
    vencidoAPagar: somarAberto(despesas.filter(item => item.status === 'VENCIDO')),
    recebidoNoMes: recebidoNoMesTotal,
    pagoNoMes: pagoNoMesTotal,
  }
}

function calcularFluxoCaixa(
  lancamentos: LancamentoFinanceiro[],
  movimentacoes: MovimentacaoFinanceira[],
): PontoFluxoCaixa[] {
  const hoje = new Date()
  let saldoRealizadoAcumulado = 0
  let saldoPrevistoAcumulado = 0

  return Array.from({ length: 6 }, (_, index) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - 3 + index, 1)
    const periodo = dataCivil(data).slice(0, 7)
    const movimentosDoMes = movimentacoes.filter(
      item => item.status === 'CONFIRMADA' && dataCivil(item.movimentadoEm).slice(0, 7) === periodo,
    )
    const realizadoEntradas = movimentosDoMes
      .filter(item => movimentacaoEhEntrada(item.tipo))
      .map(item => item.valor)
    const realizadoSaidas = movimentosDoMes
      .filter(item => !movimentacaoEhEntrada(item.tipo))
      .map(item => item.valor)
    const compromissosDoMes = lancamentos.filter(
      item =>
        item.vencimento.slice(0, 7) === periodo &&
        !['PAGO', 'CANCELADO'].includes(item.status),
    )
    const previstoEntradas = compromissosDoMes
      .filter(item => item.tipo === 'RECEITA')
      .map(item => Math.max(
        subtrairValoresMonetarios(item.valor, item.valorPago),
        0,
      ))
    const previstoSaidas = compromissosDoMes
      .filter(item => item.tipo === 'DESPESA')
      .map(item => Math.max(
        subtrairValoresMonetarios(item.valor, item.valorPago),
        0,
      ))

    const totalRealizadoEntradas = somarValoresMonetarios(...realizadoEntradas)
    const totalRealizadoSaidas = somarValoresMonetarios(...realizadoSaidas)
    const totalPrevistoEntradas = somarValoresMonetarios(...previstoEntradas)
    const totalPrevistoSaidas = somarValoresMonetarios(...previstoSaidas)

    saldoRealizadoAcumulado = subtrairValoresMonetarios(
      somarValoresMonetarios(saldoRealizadoAcumulado, totalRealizadoEntradas),
      totalRealizadoSaidas,
    )
    saldoPrevistoAcumulado = subtrairValoresMonetarios(
      somarValoresMonetarios(
        saldoPrevistoAcumulado,
        totalRealizadoEntradas,
        totalPrevistoEntradas,
      ),
      totalRealizadoSaidas,
      totalPrevistoSaidas,
    )

    return {
      periodo,
      rotulo: rotuloMes(periodo),
      saldosIniciais: 0,
      realizadoEntradas: totalRealizadoEntradas,
      realizadoSaidas: totalRealizadoSaidas,
      previstoEntradas: totalPrevistoEntradas,
      previstoSaidas: totalPrevistoSaidas,
      saldoRealizadoAcumulado,
      saldoPrevistoAcumulado,
    }
  })
}

function movimentacaoEhEntrada(tipo: TipoMovimentacaoFinanceira) {
  return ['ENTRADA', 'TRANSFERENCIA_ENTRADA', 'AJUSTE_ENTRADA'].includes(tipo)
}

function atualizarDemonstracao() {
  if (!demonstracaoEmMemoria) throw new Error('Demonstração financeira não iniciada.')
  demonstracaoEmMemoria.atualizadoEm = new Date().toISOString()
  demonstracaoEmMemoria.resumo = calcularResumo(
    demonstracaoEmMemoria.lancamentos,
    demonstracaoEmMemoria.contas,
  )
  demonstracaoEmMemoria.fluxoCaixa = calcularFluxoCaixa(
    demonstracaoEmMemoria.lancamentos,
    demonstracaoEmMemoria.movimentacoes,
  )
  return clonar(demonstracaoEmMemoria)
}

function atualizarBaixasDemonstracao(lancamento: LancamentoFinanceiro) {
  if (!demonstracaoEmMemoria) return
  const confirmadas = demonstracaoEmMemoria.movimentacoes.filter(
    item => item.lancamentoId === lancamento.id && item.status === 'CONFIRMADA',
  )
  lancamento.valorPago = somarValoresMonetarios(
    ...confirmadas.map(item => item.valor),
  )
  const mesAtual = dataCivil(new Date()).slice(0, 7)
  lancamento.valorBaixadoNoMes = somarValoresMonetarios(
    ...confirmadas
      .filter(item => dataCivil(item.movimentadoEm).slice(0, 7) === mesAtual)
      .map(item => item.valor),
  )
  const ultimaBaixa = [...confirmadas]
    .sort((a, b) => b.movimentadoEm.localeCompare(a.movimentadoEm))[0]
  if (ultimaBaixa) lancamento.pagoEm = dataCivil(ultimaBaixa.movimentadoEm)
  else delete lancamento.pagoEm

  if (lancamento.valorPago >= lancamento.valor) lancamento.status = 'PAGO'
  else if (lancamento.valorPago > 0) lancamento.status = 'PARCIAL'
  else lancamento.status = lancamento.vencimento < dataCivil(new Date()) ? 'VENCIDO' : 'PENDENTE'
}

function registrarAuditoriaDemonstracao(
  acao: string,
  entidade: string,
  entidadeId: string,
) {
  if (!demonstracaoEmMemoria) return
  demonstracaoEmMemoria.auditoria.unshift({
    id: criarIdDemonstracao('auditoria'),
    acao,
    entidade,
    entidadeId,
    usuarioNome: 'Administrador de teste',
    criadoEm: new Date().toISOString(),
  })
  demonstracaoEmMemoria.auditoria = demonstracaoEmMemoria.auditoria.slice(0, 20)
}

function criarIdDemonstracao(prefixo: string) {
  sequenciaDemonstracao += 1
  return `demo-${prefixo}-${Date.now()}-${sequenciaDemonstracao}`
}

function criarDemonstracaoFinanceira(): FinanceiroPreviewSnapshot {
  const categorias: CategoriaFinanceira[] = [
    { id: 'demo-cat-servicos', nome: 'Serviços técnicos', tipo: 'RECEITA', cor: '#08a45c', ativa: true },
    { id: 'demo-cat-pecas-venda', nome: 'Venda de peças', tipo: 'RECEITA', cor: '#1c74e9', ativa: true },
    { id: 'demo-cat-contratos', nome: 'Contratos recorrentes', tipo: 'RECEITA', cor: '#7257d5', ativa: true },
    { id: 'demo-cat-materiais', nome: 'Peças e materiais', tipo: 'DESPESA', cor: '#d35454', ativa: true },
    { id: 'demo-cat-pessoal', nome: 'Pessoal', tipo: 'DESPESA', cor: '#d67d1f', ativa: true },
    { id: 'demo-cat-estrutura', nome: 'Estrutura', tipo: 'DESPESA', cor: '#8a5a44', ativa: true },
    { id: 'demo-cat-impostos', nome: 'Impostos e taxas', tipo: 'DESPESA', cor: '#a54c87', ativa: true },
  ]
  const centrosCusto: CentroCustoFinanceiro[] = [
    { id: 'demo-cc-operacoes', nome: 'Operações', codigo: 'OPE', ativo: true },
    { id: 'demo-cc-comercial', nome: 'Comercial', codigo: 'COM', ativo: true },
    { id: 'demo-cc-administrativo', nome: 'Administrativo', codigo: 'ADM', ativo: true },
  ]
  const contas: ContaFinanceira[] = [
    { id: 'demo-conta-principal', nome: 'Conta principal', instituicao: 'Banco Itaú', tipo: 'CONTA_CORRENTE', saldo: 48620.4, cor: '#e66b18', ativa: true },
    { id: 'demo-conta-digital', nome: 'Recebimentos digitais', instituicao: 'Mercado Pago', tipo: 'CARTEIRA_DIGITAL', saldo: 18490.85, cor: '#168ad8', ativa: true },
    { id: 'demo-conta-caixa', nome: 'Caixa da oficina', instituicao: 'Caixa físico', tipo: 'CAIXA', saldo: 5318.5, cor: '#08a45c', ativa: true },
  ]
  const lancamentos = criarLancamentosDemonstracao()
  const movimentacoes = criarMovimentacoesDemonstracao(lancamentos, contas)
  const auditoria = criarAuditoriaDemonstracaoInicial(movimentacoes)

  return {
    ambiente: 'PREVIEW',
    atualizadoEm: new Date().toISOString(),
    fonte: 'DEMONSTRACAO_LOCAL',
    resumo: calcularResumo(lancamentos, contas),
    lancamentos,
    categorias,
    centrosCusto,
    contas,
    movimentacoes,
    auditoria,
    fluxoCaixa: calcularFluxoCaixa(lancamentos, movimentacoes),
  }
}

function criarAuditoriaDemonstracaoInicial(
  movimentacoes: MovimentacaoFinanceira[],
): AuditoriaFinanceira[] {
  return movimentacoes.slice(0, 10).map((item, index) => ({
    id: `demo-auditoria-inicial-${index + 1}`,
    acao: 'BAIXA_REGISTRADA',
    entidade: 'MovimentacaoFinanceira',
    entidadeId: item.id,
    usuarioNome: index % 3 === 0 ? 'Sistema de preview' : 'Administrador de teste',
    criadoEm: item.movimentadoEm.includes('T')
      ? item.movimentadoEm
      : `${item.movimentadoEm}T12:00:00-03:00`,
  }))
}

function criarMovimentacoesDemonstracao(
  lancamentos: LancamentoFinanceiro[],
  contas: ContaFinanceira[],
): MovimentacaoFinanceira[] {
  return lancamentos
    .filter(item => item.valorPago > 0 && item.pagoEm)
    .map<MovimentacaoFinanceira>((item, index) => {
      const contaId = item.contaId ?? contas[0]?.id ?? 'demo-conta-principal'
      const conta = contas.find(contaItem => contaItem.id === contaId)
      return {
        id: `demo-mov-${index + 1}`,
        contaId,
        contaNome: conta?.nome ?? 'Conta de demonstração',
        lancamentoId: item.id,
        lancamentoDescricao: item.descricao,
        tipo: item.tipo === 'RECEITA' ? 'ENTRADA' : 'SAIDA',
        status: 'CONFIRMADA',
        valor: item.valorPago,
        formaPagamento: 'OUTRO',
        descricao: `Baixa de ${item.descricao}`,
        movimentadoEm: item.pagoEm ?? item.vencimento,
      }
    })
    .sort((a, b) => b.movimentadoEm.localeCompare(a.movimentadoEm))
}

function criarLancamentosDemonstracao(): LancamentoFinanceiro[] {
  const base = new Date()
  const criar = (
    id: string,
    tipo: TipoLancamentoFinanceiro,
    descricao: string,
    contraparte: string,
    valor: number,
    dias: number,
    status: StatusLancamentoFinanceiro,
    categoriaId: string,
    centroCustoId: string,
    opcoes: Partial<LancamentoFinanceiro> = {},
  ): LancamentoFinanceiro => ({
    id,
    tipo,
    descricao,
    contraparte,
    valor,
    valorPago: status === 'PAGO' ? valor : 0,
    valorBaixadoNoMes: 0,
    vencimento: dataCivil(somarDias(base, dias)),
    competencia: dataCivil(somarDias(base, dias)),
    ...(status === 'PAGO' ? { pagoEm: dataCivil(somarDias(base, dias + 1)) } : {}),
    status,
    categoriaId,
    centroCustoId,
    origem: 'MANUAL',
    versao: 1,
    criadoEm: somarDias(base, dias - 10).toISOString(),
    ...opcoes,
  })

  const lancamentos = [
    criar('demo-fin-01', 'RECEITA', 'Manutenção de equipamentos', 'Padaria Central', 8800, -75, 'PAGO', 'demo-cat-servicos', 'demo-cc-operacoes', { origem: 'ORDEM_SERVICO', referencia: 'OS #1021', contaId: 'demo-conta-principal' }),
    criar('demo-fin-02', 'DESPESA', 'Compra de componentes', 'Eletro Parts', 3420, -70, 'PAGO', 'demo-cat-materiais', 'demo-cc-operacoes', { contaId: 'demo-conta-principal' }),
    criar('demo-fin-03', 'RECEITA', 'Contrato mensal de suporte', 'Rede Bom Preço', 4800, -45, 'PAGO', 'demo-cat-contratos', 'demo-cc-comercial', { origem: 'RECORRENCIA', contaId: 'demo-conta-digital' }),
    criar('demo-fin-04', 'DESPESA', 'Aluguel da oficina', 'Imóveis Horizonte', 6200, -40, 'PAGO', 'demo-cat-estrutura', 'demo-cc-administrativo', { origem: 'RECORRENCIA', contaId: 'demo-conta-principal' }),
    criar('demo-fin-05', 'RECEITA', 'Reparo de câmara fria', 'Mercado Boa Compra', 5700, -18, 'PAGO', 'demo-cat-servicos', 'demo-cc-operacoes', { origem: 'ORDEM_SERVICO', referencia: 'OS #1046', contaId: 'demo-conta-digital' }),
    criar('demo-fin-06', 'DESPESA', 'Lote de placas eletrônicas', 'Tech Componentes', 2980, -15, 'PAGO', 'demo-cat-materiais', 'demo-cc-operacoes', { contaId: 'demo-conta-principal' }),
    criar('demo-fin-07', 'RECEITA', 'Instalação e configuração', 'Clínica Nova Vida', 9800, -4, 'PARCIAL', 'demo-cat-servicos', 'demo-cc-operacoes', { valorPago: 4000, pagoEm: dataCivil(somarDias(base, -6)), origem: 'ORDEM_SERVICO', referencia: 'OS #1052', contaId: 'demo-conta-principal' }),
    criar('demo-fin-08', 'RECEITA', 'Manutenção corretiva', 'Restaurante Avenida', 2650, -9, 'VENCIDO', 'demo-cat-servicos', 'demo-cc-operacoes', { origem: 'ORDEM_SERVICO', referencia: 'OS #1050' }),
    criar('demo-fin-09', 'DESPESA', 'Internet e telefonia', 'Conecta Telecom', 1180, -3, 'VENCIDO', 'demo-cat-estrutura', 'demo-cc-administrativo', { origem: 'RECORRENCIA' }),
    criar('demo-fin-10', 'DESPESA', 'Folha de pagamento', 'Equipe Servix', 10500, 2, 'AGENDADO', 'demo-cat-pessoal', 'demo-cc-administrativo', { origem: 'RECORRENCIA', contaId: 'demo-conta-principal' }),
    criar('demo-fin-11', 'RECEITA', 'Revisão preventiva', 'Hotel Estação', 12400, 3, 'PENDENTE', 'demo-cat-servicos', 'demo-cc-operacoes', { origem: 'ORDEM_SERVICO', referencia: 'OS #1058' }),
    criar('demo-fin-12', 'DESPESA', 'Peças para estoque', 'Eletro Parts', 2350, 5, 'PENDENTE', 'demo-cat-materiais', 'demo-cc-operacoes'),
    criar('demo-fin-13', 'RECEITA', 'Venda de kit de peças', 'Oficina São Lucas', 6900, 8, 'PENDENTE', 'demo-cat-pecas-venda', 'demo-cc-comercial', { origem: 'ORCAMENTO', referencia: 'ORC #308' }),
    criar('demo-fin-14', 'DESPESA', 'Aluguel da oficina', 'Imóveis Horizonte', 6200, 9, 'PENDENTE', 'demo-cat-estrutura', 'demo-cc-administrativo', { origem: 'RECORRENCIA' }),
    criar('demo-fin-15', 'DESPESA', 'Impostos do período', 'Receita Federal', 2860, 18, 'PENDENTE', 'demo-cat-impostos', 'demo-cc-administrativo'),
    criar('demo-fin-16', 'RECEITA', 'Contrato mensal de suporte', 'Rede Bom Preço', 4800, 22, 'PENDENTE', 'demo-cat-contratos', 'demo-cc-comercial', { origem: 'RECORRENCIA' }),
    criar('demo-fin-17', 'RECEITA', 'Projeto de automação', 'Armazém do Vale', 18500, 37, 'PENDENTE', 'demo-cat-servicos', 'demo-cc-operacoes', { origem: 'ORCAMENTO', referencia: 'ORC #314' }),
    criar('demo-fin-18', 'DESPESA', 'Renovação de ferramentas', 'Ferramentas Brasil', 7300, 42, 'PENDENTE', 'demo-cat-materiais', 'demo-cc-operacoes'),
  ]

  const mesAtual = dataCivil(base).slice(0, 7)
  for (const lancamento of lancamentos) {
    if (lancamento.pagoEm?.slice(0, 7) === mesAtual) {
      lancamento.valorBaixadoNoMes = lancamento.valorPago
    }
  }

  return lancamentos
}

function obterIntervaloFluxo() {
  const hoje = new Date()
  return {
    inicio: dataCivil(new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1)),
    fim: dataCivil(new Date(hoje.getFullYear(), hoje.getMonth() + 3, 0)),
  }
}

function dataCivil(valor: Date | string) {
  const data = typeof valor === 'string' ? new Date(valor) : valor
  if (Number.isNaN(data.getTime())) return String(valor).slice(0, 10)
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function somarDias(data: Date, dias: number) {
  const resultado = new Date(data)
  resultado.setDate(resultado.getDate() + dias)
  return resultado
}

function rotuloMes(periodo: string) {
  const [ano, mes] = periodo.slice(0, 7).split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(new Date(ano, mes - 1, 1))
    .replace('.', '')
    .toUpperCase()
}

function lerNumero(valor: unknown, padrao = 0) {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(numero) ? numero : padrao
}

function lerTexto(valor: unknown, padrao: string) {
  return typeof valor === 'string' && valor.trim() ? valor : padrao
}

function comoRegistro(valor: unknown): Record<string, unknown> | null {
  return ehRegistro(valor) ? valor : null
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function clonar<T>(valor: T): T {
  return structuredClone(valor)
}

function criarAbortError() {
  return new DOMException('Operação cancelada', 'AbortError')
}
