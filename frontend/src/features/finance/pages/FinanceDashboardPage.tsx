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

  const { resumo, resumoServicos } = dados
  const indicadoresServicos = resumoServicos.indicadores
  const totalVencido = somarValoresMonetarios(resumo.vencidoAReceber, resumo.vencidoAPagar)
  const saldoVencido = subtrairValoresMonetarios(resumo.vencidoAReceber, resumo.vencidoAPagar)

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

      <section className="finance-attention" aria-labelledby="finance-attention-title">
        <div className="finance-attention__heading">
          <span className="finance-attention__icon"><FinanceIcon name="warning" /></span>
          <div>
            <span className="finance-eyebrow">Radar financeiro</span>
            <h2 id="finance-attention-title">
              {totalVencido > 0 ? 'Valores vencidos pedem atenção' : 'Nenhum valor vencido no momento'}
            </h2>
            <p>
              {totalVencido > 0
                ? 'Priorize cobranças e compromissos para manter o caixa previsível.'
                : 'Seu calendário financeiro está em dia. Continue acompanhando os próximos vencimentos.'}
            </p>
          </div>
        </div>
        <div className="finance-attention__numbers">
          <div><span>A receber vencido</span><strong className="is-income">{formatarMoeda(resumo.vencidoAReceber)}</strong></div>
          <div><span>A pagar vencido</span><strong className="is-expense">{formatarMoeda(resumo.vencidoAPagar)}</strong></div>
          <div><span>Saldo dos atrasos</span><strong className={saldoVencido >= 0 ? 'is-income' : 'is-expense'}>{formatarMoeda(saldoVencido)}</strong></div>
        </div>
        <div className="finance-attention__actions">
          <Link to="/financeiro/contas-a-receber">Revisar recebimentos <FinanceIcon name="chevron" /></Link>
          <Link to="/financeiro/contas-a-pagar">Revisar pagamentos <FinanceIcon name="chevron" /></Link>
        </div>
      </section>

      <section className="finance-service-overview" aria-labelledby="finance-services-title">
        <header className="finance-service-overview__header">
          <div>
            <span className="finance-eyebrow">Serviços da assistência</span>
            <h2 id="finance-services-title">Quanto os serviços movimentaram</h2>
            <p>
              Soma das ordens não canceladas e dos pagamentos confirmados.
              Consulta somente leitura no ambiente PREVIEW.
            </p>
          </div>
          <span className="finance-service-overview__badge">
            <FinanceIcon name="flask" /> PREVIEW · SOMENTE LEITURA
          </span>
        </header>

        <div className="finance-metrics finance-service-metrics">
          <FinanceMetric
            label="Valor de todos os serviços"
            value={indicadoresServicos.valorTotalServicos}
            hint={`${indicadoresServicos.quantidadeServicos} ordens não canceladas`}
            tone="blue"
            icon={<FinanceIcon name="chart" />}
          />
          <FinanceMetric
            label="Entrou hoje"
            value={indicadoresServicos.recebidoHoje}
            hint="Pagamentos confirmados · horário de Brasília"
            tone="green"
            icon={<FinanceIcon name="arrow-down" />}
          />
          <FinanceMetric
            label="Recebido neste mês"
            value={indicadoresServicos.recebidoNoMes}
            hint={`${formatarMoeda(indicadoresServicos.totalRecebido)} recebido no total`}
            tone="purple"
            icon={<FinanceIcon name="calendar" />}
          />
          <FinanceMetric
            label="Falta receber"
            value={indicadoresServicos.aReceber}
            hint={`${indicadoresServicos.servicosEmAberto} serviços em aberto`}
            tone="red"
            icon={<FinanceIcon name="wallet" />}
          />
        </div>

        <div className="finance-service-facts">
          <div><span>Ticket médio por serviço</span><strong>{formatarMoeda(indicadoresServicos.ticketMedio)}</strong></div>
          <div><span>Total já recebido</span><strong>{formatarMoeda(indicadoresServicos.totalRecebido)}</strong></div>
          <div><span>Atualizado</span><strong>{formatarDataCurta(resumoServicos.geradoEm)}</strong></div>
        </div>

        <section className="finance-card finance-card--services">
          <FinanceCardHeader
            eyebrow="Ordens recentes"
            title="Serviços e saldos"
            description="Compare o valor da ordem, o que já entrou e o saldo que ainda falta receber."
          />
          {resumoServicos.servicosRecentes.length === 0 ? (
            <div className="finance-services-empty">
              <FinanceIcon name="inbox" />
              <strong>Nenhum serviço cadastrado</strong>
              <span>As ordens aparecerão aqui assim que forem criadas.</span>
            </div>
          ) : (
            <div className="finance-services-table-wrap">
              <table className="finance-services-table">
                <thead>
                  <tr>
                    <th>Ordem</th>
                    <th>Cliente e aparelho</th>
                    <th>Status</th>
                    <th>Valor</th>
                    <th>Recebido</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoServicos.servicosRecentes.map(servico => (
                    <tr key={servico.id}>
                      <td data-label="Ordem"><Link to={`/ordens/${servico.id}`}>#{servico.numero}</Link></td>
                      <td data-label="Cliente e aparelho"><strong>{servico.cliente}</strong><small>{servico.equipamento}</small></td>
                      <td data-label="Status"><span className={`finance-service-status finance-service-status--${servico.status.toLowerCase()}`}>{rotuloStatusServico(servico.status)}</span></td>
                      <td data-label="Valor">{formatarMoeda(servico.valor)}</td>
                      <td data-label="Recebido" className="finance-value">{formatarMoeda(servico.totalPago)}</td>
                      <td data-label="Saldo" className={servico.saldo > 0 ? 'finance-service-balance--open' : 'finance-service-balance--paid'}>{formatarMoeda(servico.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>

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

function rotuloStatusServico(status: FinanceiroPreviewSnapshot['resumoServicos']['servicosRecentes'][number]['status']) {
  return {
    RECEBIDO: 'Recebido',
    EM_ANALISE: 'Em análise',
    EM_EXECUCAO: 'Em execução',
    AGUARDANDO_PECA: 'Aguardando peça',
    PRONTO: 'Pronto',
    ENTREGUE: 'Entregue',
    CANCELADO: 'Cancelado',
  }[status]
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
