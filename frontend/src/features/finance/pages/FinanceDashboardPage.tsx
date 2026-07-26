import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  FinanceError,
  FinanceIcon,
  FinanceLoading,
  FinancePageHeader,
  FinanceSourceNote,
  FinanceStatusBadge,
  NewFinanceEntryDialog,
} from '../components/FinanceShared'
import { useFinanceiroPreview } from '../hooks/useFinanceiroPreview'
import type {
  FinanceiroPreviewSnapshot,
} from '../types/finance.types'
import {
  formatarDataCurta,
  formatarMes,
  formatarMoeda,
  somarValoresMonetarios,
  subtrairValoresMonetarios,
} from '../utils/finance-formatters'

export default function FinanceDashboardPage() {
  const { dados, carregando, erro, recarregar, atualizarDados } = useFinanceiroPreview()
  const [criandoLancamento, setCriandoLancamento] = useState(false)

  const proximosLancamentos = useMemo(() => {
    if (!dados) return []
    return dados.lancamentos
      .filter(item => !['PAGO', 'CANCELADO'].includes(item.status))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, 6)
  }, [dados])

  if (carregando && !dados) return <FinanceLoading />
  if (erro && !dados) return <FinanceError message={erro} onRetry={() => void recarregar()} />
  if (!dados) return null

  const { resumo } = dados

  return (
    <div className="finance-page finance-overview">
      <FinancePageHeader
        eyebrow="Controle financeiro"
        title="Visão geral"
        description={`Acompanhe o caixa previsto e realizado de ${formatarMes()}.`}
        actions={
          <>
            <button className="finance-button finance-button--ghost" type="button" onClick={() => void recarregar()}>
              Atualizar
            </button>
            <button className="finance-button finance-button--primary" type="button" onClick={() => setCriandoLancamento(true)}>
              <FinanceIcon name="plus" /> Novo lançamento
            </button>
          </>
        }
      />

      <FinanceSourceNote fonte={dados.fonte} atualizadoEm={dados.atualizadoEm} />

      <section className="finance-metrics" aria-label="Indicadores financeiros">
        <FinanceMetric
          label="Saldo disponível"
          value={resumo.saldoDisponivel}
          hint={`${dados.contas.filter(item => item.ativa).length} contas ativas`}
          tone="blue"
          icon={<FinanceIcon name="wallet" />}
        />
        <FinanceMetric
          label="A receber"
          value={resumo.contasAReceber}
          hint={`${formatarMoeda(resumo.vencidoAReceber)} em atraso`}
          tone="green"
          icon={<FinanceIcon name="arrow-down" />}
          to="/financeiro/contas-a-receber"
        />
        <FinanceMetric
          label="A pagar"
          value={resumo.contasAPagar}
          hint={`${formatarMoeda(resumo.vencidoAPagar)} em atraso`}
          tone="red"
          icon={<FinanceIcon name="arrow-up" />}
          to="/financeiro/contas-a-pagar"
        />
        <FinanceMetric
          label="Resultado previsto"
          value={resumo.resultadoPrevisto}
          hint="Recebíveis menos compromissos"
          tone={resumo.resultadoPrevisto >= 0 ? 'purple' : 'red'}
          icon={<FinanceIcon name="chart" />}
        />
      </section>

      <div className="finance-dashboard-grid">
        <section className="finance-card finance-card--flow">
          <FinanceCardHeader
            eyebrow="Projeção"
            title="Fluxo de caixa"
            description="Entradas e saídas previstas nos últimos e próximos meses."
            action={<Link to="/financeiro/fluxo-de-caixa">Ver fluxo completo</Link>}
          />
          <CashFlowChart dados={dados} />
        </section>

        <section className="finance-card finance-card--accounts">
          <FinanceCardHeader
            eyebrow="Disponível agora"
            title="Saldos por conta"
            description="Posição consolidada do ambiente de teste."
            action={<Link to="/financeiro/cadastros">Gerenciar</Link>}
          />
          <div className="finance-account-list">
            {dados.contas.filter(item => item.ativa).map(conta => (
              <div className="finance-account-row" key={conta.id}>
                <span className="finance-account-row__icon" style={{ '--account-color': conta.cor } as CSSProperties}>
                  <FinanceIcon name={conta.tipo === 'CAIXA' ? 'wallet' : 'bank'} />
                </span>
                <span>
                  <strong>{conta.nome}</strong>
                  <small>{conta.instituicao}</small>
                </span>
                <strong>{formatarMoeda(conta.saldo)}</strong>
              </div>
            ))}
          </div>
          <footer className="finance-account-total">
            <span>Saldo consolidado</span>
            <strong>{formatarMoeda(resumo.saldoDisponivel)}</strong>
          </footer>
        </section>

        <section className="finance-card finance-card--schedule">
          <FinanceCardHeader
            eyebrow="Agenda financeira"
            title="Próximos vencimentos"
            description="Prioridades ordenadas pela data de vencimento."
          />
          <div className="finance-schedule-list">
            {proximosLancamentos.map(item => (
              <Link
                className="finance-schedule-row"
                to={item.tipo === 'RECEITA' ? '/financeiro/contas-a-receber' : '/financeiro/contas-a-pagar'}
                key={item.id}
              >
                <span className={`finance-schedule-row__type finance-schedule-row__type--${item.tipo.toLowerCase()}`}>
                  <FinanceIcon name={item.tipo === 'RECEITA' ? 'arrow-down' : 'arrow-up'} />
                </span>
                <span className="finance-schedule-row__main">
                  <strong>{item.descricao}</strong>
                  <small>{item.contraparte}</small>
                </span>
                <time dateTime={item.vencimento}>{formatarDataCurta(item.vencimento)}</time>
                <strong className={`finance-value finance-value--${item.tipo.toLowerCase()}`}>
                  {item.tipo === 'DESPESA' ? '− ' : '+ '}{formatarMoeda(
                    subtrairValoresMonetarios(item.valor, item.valorPago),
                  )}
                </strong>
                <FinanceStatusBadge status={item.status} />
              </Link>
            ))}
          </div>
          <footer className="finance-card__footer-links">
            <Link to="/financeiro/contas-a-receber">Ver contas a receber</Link>
            <Link to="/financeiro/contas-a-pagar">Ver contas a pagar</Link>
          </footer>
        </section>

        <section className="finance-card finance-card--month">
          <FinanceCardHeader
            eyebrow="Realizado no mês"
            title="Entradas e saídas"
            description="Somente lançamentos já baixados."
          />
          <div className="finance-month-summary">
            <div>
              <span className="finance-month-summary__icon finance-month-summary__icon--green"><FinanceIcon name="arrow-down" /></span>
              <span><small>Recebido</small><strong>{formatarMoeda(resumo.recebidoNoMes)}</strong></span>
            </div>
            <div>
              <span className="finance-month-summary__icon finance-month-summary__icon--red"><FinanceIcon name="arrow-up" /></span>
              <span><small>Pago</small><strong>{formatarMoeda(resumo.pagoNoMes)}</strong></span>
            </div>
          </div>
          <div className="finance-month-result">
            <span>Resultado realizado</span>
            <strong>{formatarMoeda(subtrairValoresMonetarios(
              resumo.recebidoNoMes,
              resumo.pagoNoMes,
            ))}</strong>
          </div>
          <Link className="finance-card__full-link" to="/financeiro/fluxo-de-caixa">
            Conferir movimentações <FinanceIcon name="chevron" />
          </Link>
        </section>
      </div>

      {criandoLancamento && (
        <NewFinanceEntryDialog
          snapshot={dados}
          onClose={() => setCriandoLancamento(false)}
          onSaved={(snapshot: FinanceiroPreviewSnapshot) => {
            atualizarDados(snapshot)
            setCriandoLancamento(false)
          }}
        />
      )}
    </div>
  )
}

function FinanceMetric({
  label,
  value,
  hint,
  tone,
  icon,
  to,
}: {
  label: string
  value: number
  hint: string
  tone: 'blue' | 'green' | 'red' | 'purple'
  icon: ReactNode
  to?: string
}) {
  const content = (
    <>
      <span className="finance-metric__icon">{icon}</span>
      <span className="finance-metric__copy">
        <small>{label}</small>
        <strong>{formatarMoeda(value)}</strong>
        <span>{hint}</span>
      </span>
      {to && <FinanceIcon name="chevron" />}
    </>
  )

  return to ? (
    <Link className={`finance-metric finance-metric--${tone}`} to={to}>{content}</Link>
  ) : (
    <div className={`finance-metric finance-metric--${tone}`}>{content}</div>
  )
}

function FinanceCardHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="finance-card__header">
      <div>
        <span className="finance-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && <div>{action}</div>}
    </header>
  )
}

function CashFlowChart({ dados }: { dados: FinanceiroPreviewSnapshot }) {
  const maiorValor = Math.max(
    ...dados.fluxoCaixa.flatMap(item => [
      item.realizadoEntradas,
      item.realizadoSaidas,
      item.previstoEntradas,
      item.previstoSaidas,
    ]),
    1,
  )
  const altura = (valor: number) =>
    `${Math.max((valor / maiorValor) * 100, valor > 0 ? 4 : 0)}%`

  return (
    <div className="finance-chart">
      <div className="finance-chart__legend" aria-hidden="true">
        <span><i className="finance-chart__dot finance-chart__dot--income" />Entrada realizada</span>
        <span><i className="finance-chart__dot finance-chart__dot--income-forecast" />Entrada prevista</span>
        <span><i className="finance-chart__dot finance-chart__dot--expense" />Saída realizada</span>
        <span><i className="finance-chart__dot finance-chart__dot--expense-forecast" />Saída prevista</span>
      </div>
      <div className="finance-chart__plot" role="img" aria-label="Gráfico de entradas e saídas realizadas e previstas por mês">
        {dados.fluxoCaixa.map(item => {
          const resultado = subtrairValoresMonetarios(
            somarValoresMonetarios(
              item.realizadoEntradas,
              item.previstoEntradas,
            ),
            item.realizadoSaidas,
            item.previstoSaidas,
          )
          return (
          <div className="finance-chart__column" key={item.periodo}>
            <div className="finance-chart__bars">
              <span
                className="finance-chart__bar finance-chart__bar--income"
                style={{ height: altura(item.realizadoEntradas) }}
                title={`Entrada realizada: ${formatarMoeda(item.realizadoEntradas)}`}
              />
              <span
                className="finance-chart__bar finance-chart__bar--income-forecast"
                style={{ height: altura(item.previstoEntradas) }}
                title={`Entrada prevista: ${formatarMoeda(item.previstoEntradas)}`}
              />
              <span
                className="finance-chart__bar finance-chart__bar--expense"
                style={{ height: altura(item.realizadoSaidas) }}
                title={`Saída realizada: ${formatarMoeda(item.realizadoSaidas)}`}
              />
              <span
                className="finance-chart__bar finance-chart__bar--expense-forecast"
                style={{ height: altura(item.previstoSaidas) }}
                title={`Saída prevista: ${formatarMoeda(item.previstoSaidas)}`}
              />
            </div>
            <strong>{item.rotulo}</strong>
            <small>{formatarMoeda(resultado)}</small>
          </div>
        )})}
      </div>
    </div>
  )
}
