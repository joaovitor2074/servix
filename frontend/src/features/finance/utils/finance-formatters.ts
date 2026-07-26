import type {
  ContaFinanceira,
  LancamentoFinanceiro,
  MovimentacaoFinanceira,
  OrigemLancamentoFinanceiro,
  StatusLancamentoFinanceiro,
  TipoLancamentoFinanceiro,
} from '../types/finance.types'

export const STATUS_LANCAMENTO_LABELS: Record<StatusLancamentoFinanceiro, string> = {
  PENDENTE: 'Pendente',
  PARCIAL: 'Pago parcialmente',
  PAGO: 'Pago',
  VENCIDO: 'Vencido',
  AGENDADO: 'Agendado',
  CANCELADO: 'Cancelado',
}

export const TIPO_LANCAMENTO_LABELS: Record<TipoLancamentoFinanceiro, string> = {
  RECEITA: 'Receita',
  DESPESA: 'Despesa',
}

export const ORIGEM_LANCAMENTO_LABELS: Record<OrigemLancamentoFinanceiro, string> = {
  MANUAL: 'Lançamento manual',
  ORDEM_SERVICO: 'Ordem de serviço',
  ORCAMENTO: 'Orçamento',
  RECORRENCIA: 'Recorrência',
  IMPORTACAO: 'Importação',
}

export const TIPO_CONTA_LABELS: Record<ContaFinanceira['tipo'], string> = {
  CONTA_CORRENTE: 'Conta corrente',
  CARTEIRA_DIGITAL: 'Carteira digital',
  CAIXA: 'Caixa',
  OUTRA: 'Outra',
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const formatadorDataCurta = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
})

const formatadorMes = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
})

export function formatarMoeda(valor: number) {
  return formatadorMoeda.format(valor)
}

export function somarValoresMonetarios(...valores: number[]) {
  return valores.reduce(
    (totalCentavos, valor) => totalCentavos + Math.round(valor * 100),
    0,
  ) / 100
}

export function subtrairValoresMonetarios(valorInicial: number, ...valores: number[]) {
  return somarValoresMonetarios(valorInicial, ...valores.map(valor => -valor))
}

export function formatarData(data: string) {
  return formatadorData.format(criarDataLocal(data))
}

export function formatarDataCurta(data: string) {
  return formatadorDataCurta.format(criarDataLocal(data))
}

export function formatarMes(data: Date | string = new Date()) {
  const valor = typeof data === 'string' ? criarDataLocal(data) : data
  const formatado = formatadorMes.format(valor)
  return formatado.charAt(0).toUpperCase() + formatado.slice(1)
}

export function paraDataInput(data: Date = new Date()) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

export function criarDataLocal(data: string) {
  const [parteData] = data.split('T')
  const [ano, mes, dia] = parteData.split('-').map(Number)

  if (ano && mes && dia) return new Date(ano, mes - 1, dia)
  return new Date(data)
}

export function somarDias(data: Date, quantidade: number) {
  const resultado = new Date(data)
  resultado.setDate(resultado.getDate() + quantidade)
  return resultado
}

export function obterMensagemErro(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação.'
}

export function exportarLancamentosCsv(
  lancamentos: LancamentoFinanceiro[],
  nomeArquivo: string,
) {
  const cabecalho = [
    'Tipo',
    'Descrição',
    'Cliente/Fornecedor',
    'Valor',
    'Valor baixado',
    'Vencimento',
    'Status',
    'Origem',
  ]
  const linhas = lancamentos.map(item => [
    TIPO_LANCAMENTO_LABELS[item.tipo],
    item.descricao,
    item.contraparte,
    item.valor.toFixed(2).replace('.', ','),
    item.valorPago.toFixed(2).replace('.', ','),
    item.vencimento,
    STATUS_LANCAMENTO_LABELS[item.status],
    ORIGEM_LANCAMENTO_LABELS[item.origem],
  ])
  baixarCsv([cabecalho, ...linhas], nomeArquivo)
}

export function exportarMovimentacoesCsv(
  movimentacoes: MovimentacaoFinanceira[],
  nomeArquivo: string,
) {
  const cabecalho = [
    'Data',
    'Tipo',
    'Descrição',
    'Conta',
    'Valor',
    'Forma de pagamento',
    'Status',
  ]
  const linhas = movimentacoes.map(item => [
    item.movimentadoEm,
    tipoMovimentacaoEhEntrada(item.tipo) ? 'Entrada' : 'Saída',
    item.descricao,
    item.contaNome,
    item.valor.toFixed(2).replace('.', ','),
    item.formaPagamento,
    item.status === 'CONFIRMADA' ? 'Confirmada' : 'Estornada',
  ])
  baixarCsv([cabecalho, ...linhas], nomeArquivo)
}

export function tipoMovimentacaoEhEntrada(tipo: MovimentacaoFinanceira['tipo']) {
  return ['ENTRADA', 'TRANSFERENCIA_ENTRADA', 'AJUSTE_ENTRADA'].includes(tipo)
}

function baixarCsv(linhas: Array<Array<string | number>>, nomeArquivo: string) {
  // Impede que planilhas executem descrições iniciadas como fórmulas.
  const neutralizarFormula = (valor: string) =>
    /^[\s]*[=+\-@]/.test(valor) ? `'${valor}` : valor
  const escapar = (valor: string) =>
    `"${neutralizarFormula(valor).replaceAll('"', '""')}"`
  const csv = linhas
    .map(linha => linha.map(valor => escapar(String(valor))).join(';'))
    .join('\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
