export type TipoLancamentoFinanceiro = 'RECEITA' | 'DESPESA'

export type StatusLancamentoFinanceiro =
  | 'PENDENTE'
  | 'PARCIAL'
  | 'PAGO'
  | 'VENCIDO'
  | 'AGENDADO'
  | 'CANCELADO'

export type OrigemLancamentoFinanceiro =
  | 'MANUAL'
  | 'ORDEM_SERVICO'
  | 'ORCAMENTO'
  | 'RECORRENCIA'
  | 'IMPORTACAO'

export interface CategoriaFinanceira {
  id: string
  nome: string
  tipo: TipoLancamentoFinanceiro
  cor: string
  ativa: boolean
}

export interface CentroCustoFinanceiro {
  id: string
  nome: string
  codigo: string
  ativo: boolean
}

export interface ContaFinanceira {
  id: string
  nome: string
  instituicao: string
  tipo: 'CONTA_CORRENTE' | 'CARTEIRA_DIGITAL' | 'CAIXA' | 'OUTRA'
  saldo: number
  cor: string
  ativa: boolean
}

export interface LancamentoFinanceiro {
  id: string
  tipo: TipoLancamentoFinanceiro
  descricao: string
  contraparte: string
  documento?: string
  valor: number
  valorPago: number
  valorBaixadoNoMes: number
  vencimento: string
  competencia: string
  pagoEm?: string
  status: StatusLancamentoFinanceiro
  categoriaId: string
  centroCustoId: string
  contaId?: string
  origem: OrigemLancamentoFinanceiro
  referencia?: string
  observacao?: string
  canceladoEm?: string
  motivoCancelamento?: string
  versao: number
  criadoEm: string
}

export interface PontoFluxoCaixa {
  periodo: string
  rotulo: string
  saldosIniciais: number
  realizadoEntradas: number
  realizadoSaidas: number
  previstoEntradas: number
  previstoSaidas: number
  saldoRealizadoAcumulado: number
  saldoPrevistoAcumulado: number
}

export type TipoMovimentacaoFinanceira =
  | 'ENTRADA'
  | 'SAIDA'
  | 'TRANSFERENCIA_ENTRADA'
  | 'TRANSFERENCIA_SAIDA'
  | 'AJUSTE_ENTRADA'
  | 'AJUSTE_SAIDA'

export interface MovimentacaoFinanceira {
  id: string
  contaId: string
  contaNome: string
  lancamentoId?: string
  lancamentoDescricao?: string
  tipo: TipoMovimentacaoFinanceira
  status: 'CONFIRMADA' | 'ESTORNADA'
  valor: number
  formaPagamento: string
  descricao: string
  documento?: string
  grupoTransferencia?: string
  movimentadoEm: string
  estornadoEm?: string
  motivoEstorno?: string
}

export interface AuditoriaFinanceira {
  id: string
  acao: string
  entidade: string
  entidadeId?: string
  usuarioNome: string
  criadoEm: string
}

export interface ResumoFinanceiro {
  saldoDisponivel: number
  contasAReceber: number
  contasAPagar: number
  resultadoPrevisto: number
  vencidoAReceber: number
  vencidoAPagar: number
  recebidoNoMes: number
  pagoNoMes: number
}

export interface ServicoResumoFinanceiro {
  id: string
  numero: number
  cliente: string
  equipamento: string
  status:
    | 'RECEBIDO'
    | 'EM_ANALISE'
    | 'EM_EXECUCAO'
    | 'AGUARDANDO_PECA'
    | 'PRONTO'
    | 'ENTREGUE'
    | 'CANCELADO'
  criadoEm: string
  valor: number
  totalPago: number
  saldo: number
}

export interface ResumoServicosFinanceiro {
  fusoHorario: string
  geradoEm: string
  indicadores: {
    valorTotalServicos: number
    quantidadeServicos: number
    servicosEmAberto: number
    recebidoHoje: number
    recebidoNoMes: number
    totalRecebido: number
    aReceber: number
    ticketMedio: number
  }
  servicosRecentes: ServicoResumoFinanceiro[]
}

export type FonteDadosFinanceiros = 'API_PREVIEW' | 'DEMONSTRACAO_LOCAL'

export interface FinanceiroPreviewSnapshot {
  ambiente: 'PREVIEW'
  atualizadoEm: string
  fonte: FonteDadosFinanceiros
  resumo: ResumoFinanceiro
  resumoServicos: ResumoServicosFinanceiro
  lancamentos: LancamentoFinanceiro[]
  categorias: CategoriaFinanceira[]
  centrosCusto: CentroCustoFinanceiro[]
  contas: ContaFinanceira[]
  movimentacoes: MovimentacaoFinanceira[]
  auditoria: AuditoriaFinanceira[]
  fluxoCaixa: PontoFluxoCaixa[]
}

export interface CriarLancamentoFinanceiroInput {
  tipo: TipoLancamentoFinanceiro
  descricao: string
  contraparte: string
  valor: number
  vencimento: string
  competencia: string
  categoriaId: string
  centroCustoId: string
  contaId?: string
  observacao?: string
}

export interface RegistrarBaixaFinanceiraInput {
  contaId: string
  valor: number
  pagoEm: string
}

export interface CriarAjusteFinanceiroInput {
  contaId: string
  direcao: 'ENTRADA' | 'SAIDA'
  valor: number
  descricao: string
  documento?: string
  movimentadoEm: string
}

export interface CriarTransferenciaFinanceiraInput {
  contaOrigemId: string
  contaDestinoId: string
  valor: number
  descricao: string
  movimentadoEm: string
}

export interface CriarCategoriaFinanceiraInput {
  nome: string
  tipo: TipoLancamentoFinanceiro
  cor: string
}

export interface CriarCentroCustoFinanceiroInput {
  nome: string
  codigo: string
}

export interface CriarContaFinanceiraInput {
  nome: string
  instituicao: string
  tipo: ContaFinanceira['tipo']
  saldo: number
  cor: string
}
