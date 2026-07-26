import { useMemo, useState } from 'react'
import {
  FinanceEmpty,
  FinanceError,
  FinanceIcon,
  FinanceLoading,
  FinancePageHeader,
  FinanceSourceNote,
} from '../components/FinanceShared'
import { useFinanceiroPreview } from '../hooks/useFinanceiroPreview'
import type {
  LancamentoFinanceiro,
  MovimentacaoFinanceira,
  PontoFluxoCaixa,
  TipoLancamentoFinanceiro,
} from '../types/finance.types'
import {
  exportarMovimentacoesCsv,
  formatarDataCurta,
  formatarMoeda,
  somarValoresMonetarios,
  subtrairValoresMonetarios,
  tipoMovimentacaoEhEntrada,
} from '../utils/finance-formatters'

type VisaoMovimentacao = 'TODOS' | 'REALIZADO' | 'PREVISTO'

interface ItemExtrato {
  id: string
  origem: 'REALIZADO' | 'PREVISTO'
  tipo: TipoLancamentoFinanceiro
  descricao: string
  detalhe: string
  data: string
  valor: number
}

export default function FinanceCashFlowPage() {
  const { dados, carregando, erro, recarregar } = useFinanceiroPreview()
  const [quantidadeMeses, setQuantidadeMeses] = useState<3 | 6>(6)
  const [visao, setVisao] = useState<VisaoMovimentacao>('TODOS')

  const realizados = useMemo(
    () => dados
      ? dados.movimentacoes
        .filter(item => item.status === 'CONFIRMADA')
        .map(mapearMovimentacaoRealizada)
        .sort(ordenarExtrato)
      : [],
    [dados],
  )

  const previstos = useMemo(
    () => dados
      ? dados.lancamentos
        .filter(item => !['PAGO', 'CANCELADO'].includes(item.status))
        .filter(item =>
          subtrairValoresMonetarios(item.valor, item.valorPago) > 0,
        )
        .map(mapearCompromissoPrevisto)
        .sort(ordenarExtrato)
      : [],
    [dados],
  )

  if (carregando && !dados) return <FinanceLoading />
  if (erro && !dados) return <FinanceError message={erro} onRetry={() => void recarregar()} />
  if (!dados) return null

  const fluxoExibido = dados.fluxoCaixa.slice(-quantidadeMeses)
  const totais = somarFluxo(fluxoExibido)
  const saldoProjetado = subtrairValoresMonetarios(
    somarValoresMonetarios(
      dados.resumo.saldoDisponivel,
      totais.previstoEntradas,
    ),
    totais.previstoSaidas,
  )
  const resultadoRealizado = subtrairValoresMonetarios(
    totais.realizadoEntradas,
    totais.realizadoSaidas,
  )
  const itensVisiveis = visao === 'REALIZADO'
    ? realizados
    : visao === 'PREVISTO'
      ? previstos
      : [...realizados, ...previstos].sort(ordenarExtrato)

  return (
    <div className="finance-page finance-cashflow-page">
      <FinancePageHeader
        eyebrow="Planejamento"
        title="Fluxo de caixa"
        description="Compare movimentações realizadas com compromissos previstos sem misturar os dois cenários."
        actions={
          <button
            className="finance-button finance-button--ghost"
            type="button"
            onClick={() => exportarMovimentacoesCsv(
              dados.movimentacoes.filter(item => item.status === 'CONFIRMADA'),
              'extrato-financeiro-realizado-preview.csv',
            )}
          >
            <FinanceIcon name="download" /> Exportar extrato realizado
          </button>
        }
      />

      <FinanceSourceNote fonte={dados.fonte} atualizadoEm={dados.atualizadoEm} />

      <section className="finance-cash-position" aria-label="Posição do caixa">
        <div className="finance-cash-position__main">
          <span className="finance-cash-position__icon"><FinanceIcon name="wallet" /></span>
          <span>
            <small>Saldo atual consolidado</small>
            <strong>{formatarMoeda(dados.resumo.saldoDisponivel)}</strong>
            <em>{dados.contas.filter(item => item.ativa).length} contas incluídas</em>
          </span>
        </div>
        <div>
          <small>Resultado realizado</small>
          <strong className={resultadoRealizado >= 0 ? 'finance-value--receita' : 'finance-value--despesa'}>
            {formatarMoeda(resultadoRealizado)}
          </strong>
        </div>
        <div>
          <small>Entradas previstas</small>
          <strong className="finance-value--receita">+ {formatarMoeda(totais.previstoEntradas)}</strong>
        </div>
        <div>
          <small>Saídas previstas</small>
          <strong className="finance-value--despesa">− {formatarMoeda(totais.previstoSaidas)}</strong>
        </div>
        <div>
          <small>Saldo após compromissos</small>
          <strong>{formatarMoeda(saldoProjetado)}</strong>
        </div>
      </section>

      <section className="finance-card finance-cashflow-chart-card">
        <header className="finance-card__header finance-card__header--controls">
          <div>
            <span className="finance-eyebrow">Evolução mensal</span>
            <h2>Realizado e previsto</h2>
            <p>Barras sólidas são movimentações confirmadas; barras tracejadas são compromissos em aberto.</p>
          </div>
          <div className="finance-segmented" aria-label="Período do gráfico">
            <button type="button" className={quantidadeMeses === 3 ? 'is-active' : ''} aria-pressed={quantidadeMeses === 3} onClick={() => setQuantidadeMeses(3)}>3 meses</button>
            <button type="button" className={quantidadeMeses === 6 ? 'is-active' : ''} aria-pressed={quantidadeMeses === 6} onClick={() => setQuantidadeMeses(6)}>6 meses</button>
          </div>
        </header>

        <DetailedCashFlowChart dados={fluxoExibido} />

        <div className="finance-flow-table-wrap">
          <table className="finance-flow-table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Saldos iniciais</th>
                <th>Entradas realizadas</th>
                <th>Saídas realizadas</th>
                <th>Entradas previstas</th>
                <th>Saídas previstas</th>
                <th>Saldo projetado</th>
              </tr>
            </thead>
            <tbody>
              {fluxoExibido.map(item => (
                <tr key={item.periodo}>
                  <td><strong>{item.rotulo}</strong></td>
                  <td>{formatarMoeda(item.saldosIniciais)}</td>
                  <td className="finance-value--receita">{formatarMoeda(item.realizadoEntradas)}</td>
                  <td className="finance-value--despesa">{formatarMoeda(item.realizadoSaidas)}</td>
                  <td className="finance-value--receita">{formatarMoeda(item.previstoEntradas)}</td>
                  <td className="finance-value--despesa">{formatarMoeda(item.previstoSaidas)}</td>
                  <td><strong>{formatarMoeda(item.saldoPrevistoAcumulado)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="finance-card finance-movements-card">
        <header className="finance-card__header finance-card__header--controls">
          <div>
            <span className="finance-eyebrow">Extrato gerencial</span>
            <h2>Movimentações e compromissos</h2>
            <p>O realizado vem do extrato financeiro; o previsto vem dos lançamentos ainda em aberto.</p>
          </div>
          <div className="finance-segmented" aria-label="Tipo de movimentação">
            {(['TODOS', 'REALIZADO', 'PREVISTO'] as VisaoMovimentacao[]).map(item => (
              <button
                type="button"
                key={item}
                className={visao === item ? 'is-active' : ''}
                aria-pressed={visao === item}
                onClick={() => setVisao(item)}
              >
                {item === 'TODOS' ? 'Todas' : item === 'REALIZADO' ? 'Realizadas' : 'Previstas'}
              </button>
            ))}
          </div>
        </header>

        {itensVisiveis.length === 0 ? (
          <FinanceEmpty title="Nenhuma movimentação nesta visão" description="Selecione outro filtro para consultar o extrato gerencial." />
        ) : visao === 'TODOS' ? (
          <div className="finance-movement-groups">
            <MovementGroup title="Movimentações realizadas" hint={`${realizados.length} registros confirmados`} itens={realizados} />
            <MovementGroup title="Compromissos previstos" hint={`${previstos.length} lançamentos em aberto`} itens={previstos} />
          </div>
        ) : (
          <div className="finance-movement-list">
            {itensVisiveis.slice(0, 20).map(item => <MovementRow item={item} key={`${item.origem}-${item.id}`} />)}
          </div>
        )}
      </section>
    </div>
  )
}

function DetailedCashFlowChart({ dados }: { dados: PontoFluxoCaixa[] }) {
  const maior = Math.max(
    ...dados.flatMap(item => [
      item.realizadoEntradas,
      item.realizadoSaidas,
      item.previstoEntradas,
      item.previstoSaidas,
    ]),
    1,
  )

  return (
    <div className="finance-detailed-chart">
      <div className="finance-chart__legend">
        <span><i className="finance-chart__dot finance-chart__dot--income" />Entrada realizada</span>
        <span><i className="finance-chart__dot finance-chart__dot--income-forecast" />Entrada prevista</span>
        <span><i className="finance-chart__dot finance-chart__dot--expense" />Saída realizada</span>
        <span><i className="finance-chart__dot finance-chart__dot--expense-forecast" />Saída prevista</span>
      </div>
      <div className="finance-detailed-chart__plot" role="img" aria-label="Comparação mensal entre entradas e saídas realizadas e previstas">
        {dados.map(item => (
          <div className="finance-detailed-chart__group" key={item.periodo}>
            <div className="finance-detailed-chart__bars">
              <ChartBar value={item.realizadoEntradas} max={maior} type="income" title={`Entrada realizada ${formatarMoeda(item.realizadoEntradas)}`} />
              <ChartBar value={item.previstoEntradas} max={maior} type="income-forecast" title={`Entrada prevista ${formatarMoeda(item.previstoEntradas)}`} />
              <ChartBar value={item.realizadoSaidas} max={maior} type="expense" title={`Saída realizada ${formatarMoeda(item.realizadoSaidas)}`} />
              <ChartBar value={item.previstoSaidas} max={maior} type="expense-forecast" title={`Saída prevista ${formatarMoeda(item.previstoSaidas)}`} />
            </div>
            <strong>{item.rotulo}</strong>
            <small>Projetado {formatarMoeda(item.saldoPrevistoAcumulado)}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChartBar({
  value,
  max,
  type,
  title,
}: {
  value: number
  max: number
  type: 'income' | 'income-forecast' | 'expense' | 'expense-forecast'
  title: string
}) {
  return (
    <span
      className={`finance-detailed-chart__bar finance-detailed-chart__bar--${type}`}
      style={{ height: `${Math.max((value / max) * 100, value > 0 ? 4 : 0)}%` }}
      title={title}
    />
  )
}

function MovementGroup({
  title,
  hint,
  itens,
}: {
  title: string
  hint: string
  itens: ItemExtrato[]
}) {
  return (
    <section className="finance-movement-group">
      <header className="finance-movement-group__header">
        <h3>{title}</h3>
        <span>{hint}</span>
      </header>
      {itens.length === 0 ? (
        <FinanceEmpty title="Nenhum registro" description="Não há dados para esta seção no período atual." />
      ) : (
        <div className="finance-movement-list">
          {itens.slice(0, 10).map(item => <MovementRow item={item} key={`${item.origem}-${item.id}`} />)}
        </div>
      )}
    </section>
  )
}

function MovementRow({ item }: { item: ItemExtrato }) {
  return (
    <div className="finance-movement-row">
      <time dateTime={item.data}>
        <strong>{formatarDataCurta(item.data)}</strong>
      </time>
      <span className={`finance-movement-row__icon finance-movement-row__icon--${item.tipo.toLowerCase()}`}>
        <FinanceIcon name={item.tipo === 'RECEITA' ? 'arrow-down' : 'arrow-up'} />
      </span>
      <span className="finance-movement-row__main">
        <strong>{item.descricao}</strong>
        <small>{item.detalhe}</small>
      </span>
      <span className={`finance-movement-kind finance-movement-kind--${item.origem.toLowerCase()}`}>
        {item.origem === 'REALIZADO' ? 'Realizado' : 'Previsto'}
      </span>
      <strong className={`finance-value--${item.tipo.toLowerCase()}`}>
        {item.tipo === 'RECEITA' ? '+' : '−'} {formatarMoeda(item.valor)}
      </strong>
    </div>
  )
}

function mapearMovimentacaoRealizada(item: MovimentacaoFinanceira): ItemExtrato {
  const entrada = tipoMovimentacaoEhEntrada(item.tipo)
  return {
    id: item.id,
    origem: 'REALIZADO',
    tipo: entrada ? 'RECEITA' : 'DESPESA',
    descricao: item.descricao,
    detalhe: `${item.contaNome} · ${formatarFormaPagamento(item.formaPagamento)}`,
    data: item.movimentadoEm,
    valor: item.valor,
  }
}

function mapearCompromissoPrevisto(item: LancamentoFinanceiro): ItemExtrato {
  return {
    id: item.id,
    origem: 'PREVISTO',
    tipo: item.tipo,
    descricao: item.descricao,
    detalhe: `${item.contraparte} · vence ${formatarDataCurta(item.vencimento)}`,
    data: item.vencimento,
    valor: Math.max(
      subtrairValoresMonetarios(item.valor, item.valorPago),
      0,
    ),
  }
}

function formatarFormaPagamento(valor: string) {
  const texto = valor.toLocaleLowerCase('pt-BR').replaceAll('_', ' ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function ordenarExtrato(a: ItemExtrato, b: ItemExtrato) {
  return b.data.localeCompare(a.data)
}

function somarFluxo(dados: PontoFluxoCaixa[]) {
  return {
    realizadoEntradas: somarValoresMonetarios(
      ...dados.map(item => item.realizadoEntradas),
    ),
    realizadoSaidas: somarValoresMonetarios(
      ...dados.map(item => item.realizadoSaidas),
    ),
    previstoEntradas: somarValoresMonetarios(
      ...dados.map(item => item.previstoEntradas),
    ),
    previstoSaidas: somarValoresMonetarios(
      ...dados.map(item => item.previstoSaidas),
    ),
  }
}
