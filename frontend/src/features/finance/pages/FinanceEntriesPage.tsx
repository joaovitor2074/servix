import { useMemo, useState } from 'react'
import {
  CancelFinanceEntryDialog,
  FinanceEmpty,
  FinanceError,
  FinanceIcon,
  FinanceLoading,
  FinancePageHeader,
  FinanceSourceNote,
  FinanceStatusBadge,
  NewFinanceEntryDialog,
  SettleFinanceEntryDialog,
} from '../components/FinanceShared'
import { useFinanceiroPreview } from '../hooks/useFinanceiroPreview'
import type {
  FinanceiroPreviewSnapshot,
  LancamentoFinanceiro,
  StatusLancamentoFinanceiro,
  TipoLancamentoFinanceiro,
} from '../types/finance.types'
import {
  ORIGEM_LANCAMENTO_LABELS,
  STATUS_LANCAMENTO_LABELS,
  exportarLancamentosCsv,
  formatarData,
  formatarMoeda,
  somarValoresMonetarios,
  subtrairValoresMonetarios,
  somarDias,
} from '../utils/finance-formatters'

const STATUS_FILTRO: Array<StatusLancamentoFinanceiro | 'TODOS'> = [
  'TODOS',
  'PENDENTE',
  'VENCIDO',
  'PARCIAL',
  'AGENDADO',
  'PAGO',
  'CANCELADO',
]

export default function FinanceEntriesPage({
  tipo,
}: {
  tipo: TipoLancamentoFinanceiro
}) {
  const { dados, carregando, erro, recarregar, atualizarDados } = useFinanceiroPreview()
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState<StatusLancamentoFinanceiro | 'TODOS'>('TODOS')
  const [criando, setCriando] = useState(false)
  const [baixando, setBaixando] = useState<LancamentoFinanceiro | null>(null)
  const [cancelando, setCancelando] = useState<LancamentoFinanceiro | null>(null)
  const [mensagem, setMensagem] = useState('')

  const lancamentos = useMemo(() => {
    if (!dados) return []
    const termo = busca.trim().toLocaleLowerCase('pt-BR')

    return dados.lancamentos
      .filter(item => item.tipo === tipo)
      .filter(item => status === 'TODOS' || item.status === status)
      .filter(item => {
        if (!termo) return true
        return [item.descricao, item.contraparte, item.documento, item.referencia]
          .filter(Boolean)
          .some(valor => valor?.toLocaleLowerCase('pt-BR').includes(termo))
      })
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
  }, [busca, dados, status, tipo])

  if (carregando && !dados) return <FinanceLoading />
  if (erro && !dados) return <FinanceError message={erro} onRetry={() => void recarregar()} />
  if (!dados) return null

  const todosDoTipo = dados.lancamentos.filter(item => item.tipo === tipo)
  const hoje = new Date()
  const limiteSeteDias = somarDias(hoje, 7).toISOString().slice(0, 10)
  const emAberto = todosDoTipo.filter(item => !['PAGO', 'CANCELADO'].includes(item.status))
  const valorEmAberto = somarValoresMonetarios(...emAberto.map(item =>
    Math.max(subtrairValoresMonetarios(item.valor, item.valorPago), 0),
  ))
  const valorVencido = somarValoresMonetarios(...emAberto
    .filter(item => item.status === 'VENCIDO')
    .map(item => Math.max(
      subtrairValoresMonetarios(item.valor, item.valorPago),
      0,
    )))
  const proximosSeteDias = somarValoresMonetarios(...emAberto
    .filter(item => item.vencimento >= hoje.toISOString().slice(0, 10) && item.vencimento <= limiteSeteDias)
    .map(item => Math.max(
      subtrairValoresMonetarios(item.valor, item.valorPago),
      0,
    )))
  const valorBaixado = somarValoresMonetarios(
    ...todosDoTipo.map(item => item.valorPago),
  )
  const recebendo = tipo === 'RECEITA'
  const titulo = recebendo ? 'Contas a receber' : 'Contas a pagar'

  function handleSnapshotAtualizado(snapshot: FinanceiroPreviewSnapshot, mensagemSucesso: string) {
    atualizarDados(snapshot)
    setCriando(false)
    setBaixando(null)
    setCancelando(null)
    setMensagem(mensagemSucesso)
  }

  return (
    <div className="finance-page finance-entries-page">
      <FinancePageHeader
        eyebrow="Lançamentos"
        title={titulo}
        description={
          recebendo
            ? 'Controle valores previstos, atrasados e já recebidos dos clientes.'
            : 'Organize compromissos, vencimentos e pagamentos da empresa.'
        }
        actions={
          <>
            <button
              className="finance-button finance-button--ghost"
              type="button"
              onClick={() => exportarLancamentosCsv(todosDoTipo, `${recebendo ? 'contas-a-receber' : 'contas-a-pagar'}-preview.csv`)}
            >
              <FinanceIcon name="download" /> Exportar CSV
            </button>
            <button className="finance-button finance-button--primary" type="button" onClick={() => setCriando(true)}>
              <FinanceIcon name="plus" /> Novo lançamento
            </button>
          </>
        }
      />

      <FinanceSourceNote fonte={dados.fonte} atualizadoEm={dados.atualizadoEm} />

      {mensagem && (
        <div className="finance-success" role="status">
          <FinanceIcon name="check" />
          <span>{mensagem}</span>
          <button type="button" aria-label="Fechar mensagem" onClick={() => setMensagem('')}>
            <FinanceIcon name="close" />
          </button>
        </div>
      )}

      <section className="finance-entry-summary" aria-label={`Resumo de ${titulo.toLocaleLowerCase('pt-BR')}`}>
        <EntrySummaryCard label="Total em aberto" value={valorEmAberto} hint={`${emAberto.length} lançamentos`} tone="blue" />
        <EntrySummaryCard label="Vencido" value={valorVencido} hint="Requer atenção" tone="red" />
        <EntrySummaryCard label="Próximos 7 dias" value={proximosSeteDias} hint="Agenda imediata" tone="amber" />
        <EntrySummaryCard label={recebendo ? 'Total recebido' : 'Total pago'} value={valorBaixado} hint="No período demonstrado" tone="green" />
      </section>

      <section className="finance-entry-card">
        <div className="finance-entry-filters">
          <label className="finance-search-field">
            <span className="sr-only">Buscar lançamentos</span>
            <FinanceIcon name="search" />
            <input
              type="search"
              value={busca}
              placeholder={`Buscar por ${recebendo ? 'cliente' : 'fornecedor'}, descrição ou referência`}
              onChange={event => setBusca(event.target.value)}
            />
            {busca && (
              <button type="button" aria-label="Limpar busca" onClick={() => setBusca('')}>
                <FinanceIcon name="close" />
              </button>
            )}
          </label>

          <label className="finance-select-field">
            <FinanceIcon name="filter" />
            <span className="sr-only">Filtrar por status</span>
            <select value={status} onChange={event => setStatus(event.target.value as StatusLancamentoFinanceiro | 'TODOS')}>
              {STATUS_FILTRO.map(item => (
                <option value={item} key={item}>
                  {item === 'TODOS' ? 'Todos os status' : STATUS_LANCAMENTO_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="finance-entry-card__summary">
          <span><strong>{lancamentos.length}</strong> lançamentos encontrados</span>
          {(busca || status !== 'TODOS') && (
            <button type="button" onClick={() => { setBusca(''); setStatus('TODOS') }}>
              Limpar filtros
            </button>
          )}
        </div>

        {lancamentos.length === 0 ? (
          <FinanceEmpty
            title="Nenhum lançamento encontrado"
            description="Ajuste os filtros ou crie um novo lançamento no ambiente de teste."
          />
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria / origem</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map(item => {
                  const categoria = dados.categorias.find(categoriaItem => categoriaItem.id === item.categoriaId)
                  const restante = subtrairValoresMonetarios(
                    item.valor,
                    item.valorPago,
                  )
                  const podeBaixar = !['PAGO', 'CANCELADO'].includes(item.status) && restante > 0
                  const possuiBaixa = item.valorPago > 0 || dados.movimentacoes.some(
                    movimento => movimento.lancamentoId === item.id && movimento.status === 'CONFIRMADA',
                  )
                  const podeCancelar = !['PAGO', 'CANCELADO'].includes(item.status) && !possuiBaixa

                  return (
                    <tr key={item.id}>
                      <td data-label="Descrição">
                        <span className="finance-table__description">
                          <span className={`finance-table__type finance-table__type--${item.tipo.toLowerCase()}`}>
                            <FinanceIcon name={item.tipo === 'RECEITA' ? 'arrow-down' : 'arrow-up'} />
                          </span>
                          <span>
                            <strong>{item.descricao}</strong>
                            <small>{item.contraparte}{item.referencia ? ` · ${item.referencia}` : ''}</small>
                          </span>
                        </span>
                      </td>
                      <td data-label="Categoria / origem">
                        <span className="finance-table__stack">
                          <strong>{categoria?.nome ?? 'Sem categoria'}</strong>
                          <small>{ORIGEM_LANCAMENTO_LABELS[item.origem]}</small>
                        </span>
                      </td>
                      <td data-label="Vencimento"><time dateTime={item.vencimento}>{formatarData(item.vencimento)}</time></td>
                      <td data-label="Status">
                        <span className="finance-table__stack">
                          <FinanceStatusBadge status={item.status} />
                          {item.status === 'PARCIAL' && <small>{formatarMoeda(item.valorPago)} baixado</small>}
                        </span>
                      </td>
                      <td data-label="Valor">
                        <span className="finance-table__amount">
                          <strong>{formatarMoeda(item.valor)}</strong>
                          {item.valorPago > 0 && item.status !== 'PAGO' && <small>{formatarMoeda(restante)} aberto</small>}
                        </span>
                      </td>
                      <td data-label="Ações">
                        <span className="finance-table__actions">
                          {podeBaixar && (
                            <button className="finance-table__action" type="button" onClick={() => setBaixando(item)}>
                              Dar baixa
                            </button>
                          )}
                          {podeCancelar && (
                            <button className="finance-table__action finance-table__action--danger" type="button" onClick={() => setCancelando(item)}>
                              Cancelar
                            </button>
                          )}
                          {!podeBaixar && !podeCancelar && (
                            <span className="finance-table__done" aria-label="Lançamento concluído"><FinanceIcon name="check" /></span>
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {criando && (
        <NewFinanceEntryDialog
          snapshot={dados}
          defaultType={tipo}
          onClose={() => setCriando(false)}
          onSaved={snapshot => handleSnapshotAtualizado(snapshot, 'Lançamento criado com sucesso no ambiente de teste.')}
        />
      )}

      {baixando && (
        <SettleFinanceEntryDialog
          lancamento={baixando}
          contas={dados.contas}
          onClose={() => setBaixando(null)}
          onSaved={snapshot => handleSnapshotAtualizado(snapshot, 'Baixa simulada registrada com sucesso.')}
        />
      )}

      {cancelando && (
        <CancelFinanceEntryDialog
          lancamento={cancelando}
          onClose={() => setCancelando(null)}
          onSaved={snapshot => handleSnapshotAtualizado(snapshot, 'Lançamento cancelado no ambiente de teste.')}
        />
      )}
    </div>
  )
}

function EntrySummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint: string
  tone: 'blue' | 'red' | 'amber' | 'green'
}) {
  return (
    <article className={`finance-entry-summary__card finance-entry-summary__card--${tone}`}>
      <span>{label}</span>
      <strong>{formatarMoeda(value)}</strong>
      <small>{hint}</small>
    </article>
  )
}
