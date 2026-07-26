import { useMemo, useRef, useState, type FormEvent } from 'react'
import {
  FinanceEmpty,
  FinanceError,
  FinanceIcon,
  FinanceLoading,
  FinancePageHeader,
  FinanceSourceNote,
} from '../components/FinanceShared'
import { useFinanceiroPreview } from '../hooks/useFinanceiroPreview'
import { useFinanceDialogBehavior } from '../hooks/useFinanceDialogBehavior'
import {
  criarAjusteFinanceiroPreview,
  criarTransferenciaFinanceiraPreview,
  estornarMovimentacaoFinanceiraPreview,
} from '../services/finance-preview.service'
import type {
  AuditoriaFinanceira,
  ContaFinanceira,
  CriarAjusteFinanceiroInput,
  FinanceiroPreviewSnapshot,
  MovimentacaoFinanceira,
} from '../types/finance.types'
import {
  exportarMovimentacoesCsv,
  formatarData,
  formatarMoeda,
  obterMensagemErro,
  paraDataInput,
  somarValoresMonetarios,
  subtrairValoresMonetarios,
  tipoMovimentacaoEhEntrada,
} from '../utils/finance-formatters'

type StatusFiltro = 'TODOS' | MovimentacaoFinanceira['status']
type DialogoMovimento = 'AJUSTE' | 'TRANSFERENCIA' | null

const TIPO_MOVIMENTO_LABELS: Record<MovimentacaoFinanceira['tipo'], string> = {
  ENTRADA: 'Recebimento',
  SAIDA: 'Pagamento',
  TRANSFERENCIA_ENTRADA: 'Transferência recebida',
  TRANSFERENCIA_SAIDA: 'Transferência enviada',
  AJUSTE_ENTRADA: 'Ajuste de entrada',
  AJUSTE_SAIDA: 'Ajuste de saída',
}

const ACAO_AUDITORIA_LABELS: Record<string, string> = {
  AJUSTE_REGISTRADO: 'Ajuste registrado',
  AJUSTE_ESTORNADO: 'Ajuste estornado',
  BAIXA_REGISTRADA: 'Baixa registrada',
  BAIXA_ESTORNADA: 'Baixa estornada',
  TRANSFERENCIA_ENTRADA_REGISTRADA: 'Entrada de transferência registrada',
  TRANSFERENCIA_SAIDA_REGISTRADA: 'Saída de transferência registrada',
  TRANSFERENCIA_ESTORNADA: 'Transferência estornada',
  LANCAMENTO_CRIADO: 'Lançamento criado',
  LANCAMENTO_CANCELADO: 'Lançamento cancelado',
  CATEGORIA_CRIADA: 'Categoria criada',
  CENTRO_CUSTO_CRIADO: 'Centro de custo criado',
  CONTA_CRIADA: 'Conta criada',
}

export default function FinanceMovementsPage() {
  const { dados, carregando, erro, recarregar, atualizarDados } = useFinanceiroPreview()
  const [contaId, setContaId] = useState('TODAS')
  const [status, setStatus] = useState<StatusFiltro>('TODOS')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [dialogo, setDialogo] = useState<DialogoMovimento>(null)
  const [estornando, setEstornando] = useState<MovimentacaoFinanceira | null>(null)
  const [mensagem, setMensagem] = useState('')

  const movimentacoes = useMemo(() => {
    if (!dados) return []
    return dados.movimentacoes
      .filter(item => contaId === 'TODAS' || item.contaId === contaId)
      .filter(item => status === 'TODOS' || item.status === status)
      .filter(item => !inicio || item.movimentadoEm.slice(0, 10) >= inicio)
      .filter(item => !fim || item.movimentadoEm.slice(0, 10) <= fim)
      .sort((a, b) => b.movimentadoEm.localeCompare(a.movimentadoEm))
  }, [contaId, dados, fim, inicio, status])

  if (carregando && !dados) return <FinanceLoading />
  if (erro && !dados) return <FinanceError message={erro} onRetry={() => void recarregar()} />
  if (!dados) return null

  const confirmadas = movimentacoes.filter(item => item.status === 'CONFIRMADA')
  const entradas = somarValoresMonetarios(
    ...confirmadas.filter(item => tipoMovimentacaoEhEntrada(item.tipo)).map(item => item.valor),
  )
  const saidas = somarValoresMonetarios(
    ...confirmadas.filter(item => !tipoMovimentacaoEhEntrada(item.tipo)).map(item => item.valor),
  )
  const resultado = subtrairValoresMonetarios(entradas, saidas)
  const contasAtivas = dados.contas.filter(item => item.ativa)
  const possuiFiltros = contaId !== 'TODAS' || status !== 'TODOS' || Boolean(inicio) || Boolean(fim)

  function handleSaved(snapshot: FinanceiroPreviewSnapshot, texto: string) {
    atualizarDados(snapshot)
    setDialogo(null)
    setEstornando(null)
    setMensagem(texto)
  }

  function limparFiltros() {
    setContaId('TODAS')
    setStatus('TODOS')
    setInicio('')
    setFim('')
  }

  return (
    <div className="finance-page finance-movements-page">
      <FinancePageHeader
        eyebrow="Livro-caixa"
        title="Movimentações"
        description="Acompanhe entradas e saídas confirmadas, transferências, ajustes e seus estornos."
        actions={
          <>
            <button
              className="finance-button finance-button--ghost"
              type="button"
              onClick={() => exportarMovimentacoesCsv(movimentacoes, 'livro-caixa-preview.csv')}
              disabled={movimentacoes.length === 0}
            >
              <FinanceIcon name="download" /> Exportar CSV
            </button>
            <button className="finance-button finance-button--secondary" type="button" onClick={() => setDialogo('AJUSTE')} disabled={contasAtivas.length === 0}>
              <FinanceIcon name="plus" /> Novo ajuste
            </button>
            <button className="finance-button finance-button--primary" type="button" onClick={() => setDialogo('TRANSFERENCIA')} disabled={contasAtivas.length < 2}>
              <FinanceIcon name="bank" /> Transferir
            </button>
          </>
        }
      />

      <FinanceSourceNote fonte={dados.fonte} atualizadoEm={dados.atualizadoEm} />

      {mensagem && (
        <div className="finance-success" role="status">
          <FinanceIcon name="check" />
          <span>{mensagem}</span>
          <button type="button" aria-label="Fechar mensagem" onClick={() => setMensagem('')}><FinanceIcon name="close" /></button>
        </div>
      )}

      <section className="finance-entry-summary" aria-label="Resumo das movimentações filtradas">
        <MovementSummaryCard label="Entradas confirmadas" value={entradas} tone="green" />
        <MovementSummaryCard label="Saídas confirmadas" value={saidas} tone="red" />
        <MovementSummaryCard label="Resultado do filtro" value={resultado} tone={resultado >= 0 ? 'blue' : 'amber'} />
        <MovementSummaryCard label="Movimentações" value={confirmadas.length} tone="neutral" numeric />
      </section>

      <section className="finance-entry-card">
        <div className="finance-movement-filters" aria-label="Filtros do livro-caixa">
          <label className="finance-select-field">
            <FinanceIcon name="wallet" />
            <span className="sr-only">Filtrar por conta</span>
            <select value={contaId} onChange={event => setContaId(event.target.value)}>
              <option value="TODAS">Todas as contas</option>
              {dados.contas.map(conta => <option value={conta.id} key={conta.id}>{conta.nome}</option>)}
            </select>
          </label>
          <label className="finance-select-field">
            <FinanceIcon name="filter" />
            <span className="sr-only">Filtrar por status</span>
            <select value={status} onChange={event => setStatus(event.target.value as StatusFiltro)}>
              <option value="TODOS">Todos os status</option>
              <option value="CONFIRMADA">Confirmadas</option>
              <option value="ESTORNADA">Estornadas</option>
            </select>
          </label>
          <label className="finance-date-filter">
            <span>De</span>
            <input type="date" value={inicio} max={fim || undefined} onChange={event => setInicio(event.target.value)} />
          </label>
          <label className="finance-date-filter">
            <span>Até</span>
            <input type="date" value={fim} min={inicio || undefined} onChange={event => setFim(event.target.value)} />
          </label>
        </div>

        <div className="finance-entry-card__summary">
          <span><strong>{movimentacoes.length}</strong> registros encontrados</span>
          {possuiFiltros && <button type="button" onClick={limparFiltros}>Limpar filtros</button>}
        </div>

        {movimentacoes.length === 0 ? (
          <FinanceEmpty
            title="Nenhuma movimentação encontrada"
            description="Ajuste os filtros ou registre um ajuste no ambiente de teste."
          />
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table finance-movement-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Conta</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Valor</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.map(item => {
                  const entrada = tipoMovimentacaoEhEntrada(item.tipo)
                  return (
                    <tr key={item.id} className={item.status === 'ESTORNADA' ? 'is-reversed' : ''}>
                      <td data-label="Data"><time dateTime={item.movimentadoEm}>{formatarData(item.movimentadoEm)}</time></td>
                      <td data-label="Descrição">
                        <span className="finance-table__stack">
                          <strong>{item.descricao}</strong>
                          <small>{item.lancamentoDescricao ?? item.documento ?? (item.grupoTransferencia ? 'Transferência entre contas' : 'Movimento avulso')}</small>
                        </span>
                      </td>
                      <td data-label="Conta"><strong>{item.contaNome}</strong></td>
                      <td data-label="Tipo">
                        <span className={`finance-ledger-kind finance-ledger-kind--${entrada ? 'in' : 'out'}`}>
                          <FinanceIcon name={entrada ? 'arrow-down' : 'arrow-up'} />
                          {TIPO_MOVIMENTO_LABELS[item.tipo]}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span className={`finance-movement-status finance-movement-status--${item.status.toLowerCase()}`}>
                          {item.status === 'CONFIRMADA' ? 'Confirmada' : 'Estornada'}
                        </span>
                      </td>
                      <td data-label="Valor">
                        <strong className={`finance-movement-value finance-movement-value--${entrada ? 'in' : 'out'}`}>
                          {entrada ? '+' : '−'} {formatarMoeda(item.valor)}
                        </strong>
                      </td>
                      <td data-label="Ações">
                        {item.status === 'CONFIRMADA' ? (
                          <button className="finance-table__action finance-table__action--danger" type="button" onClick={() => setEstornando(item)}>
                            Estornar
                          </button>
                        ) : (
                          <span className="finance-table__stack finance-table__reversal-note">
                            <strong>Estornada</strong>
                            {item.motivoEstorno && <small>{item.motivoEstorno}</small>}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AuditPanel itens={dados.auditoria} />

      {dialogo === 'AJUSTE' && (
        <AdjustmentDialog
          contas={contasAtivas}
          onClose={() => setDialogo(null)}
          onSaved={snapshot => handleSaved(snapshot, 'Ajuste registrado no ambiente de teste.')}
        />
      )}
      {dialogo === 'TRANSFERENCIA' && (
        <TransferDialog
          contas={contasAtivas}
          onClose={() => setDialogo(null)}
          onSaved={snapshot => handleSaved(snapshot, 'Transferência simulada entre contas registrada.')}
        />
      )}
      {estornando && (
        <ReverseMovementDialog
          movimentacao={estornando}
          snapshot={dados}
          onClose={() => setEstornando(null)}
          onSaved={snapshot => handleSaved(snapshot, estornando.grupoTransferencia ? 'Transferência estornada no ambiente de teste.' : 'Movimentação estornada no ambiente de teste.')}
        />
      )}
    </div>
  )
}

function MovementSummaryCard({
  label,
  value,
  tone,
  numeric = false,
}: {
  label: string
  value: number
  tone: 'green' | 'red' | 'blue' | 'amber' | 'neutral'
  numeric?: boolean
}) {
  return (
    <article className={`finance-entry-summary__card finance-entry-summary__card--${tone}`}>
      <span>{label}</span>
      <strong>{numeric ? value.toLocaleString('pt-BR') : formatarMoeda(value)}</strong>
      <small>Somente dados da preview</small>
    </article>
  )
}

function AuditPanel({ itens }: { itens: AuditoriaFinanceira[] }) {
  return (
    <section className="finance-audit-card" aria-labelledby="finance-audit-title">
      <header>
        <div>
          <span className="finance-eyebrow">Rastreabilidade</span>
          <h2 id="finance-audit-title">Auditoria recente</h2>
          <p>Últimas ações registradas no ambiente financeiro de teste.</p>
        </div>
        <span className="finance-audit-card__count">{itens.length} eventos</span>
      </header>
      {itens.length === 0 ? (
        <FinanceEmpty title="Nenhum evento de auditoria" description="As próximas operações da preview aparecerão aqui." icon="info" />
      ) : (
        <ol className="finance-audit-list">
          {itens.map(item => (
            <li key={item.id}>
              <span className="finance-audit-list__marker" aria-hidden="true"><FinanceIcon name="check" /></span>
              <span>
                <strong>{rotularAcaoAuditoria(item.acao)}</strong>
                <small>{item.usuarioNome} · {item.entidade}{item.entidadeId ? ` #${item.entidadeId}` : ''}</small>
              </span>
              <time dateTime={item.criadoEm}>{formatarDataHora(item.criadoEm)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function AdjustmentDialog({
  contas,
  onClose,
  onSaved,
}: {
  contas: ContaFinanceira[]
  onClose: () => void
  onSaved: (snapshot: FinanceiroPreviewSnapshot) => void
}) {
  const [contaId, setContaId] = useState(contas[0]?.id ?? '')
  const [direcao, setDirecao] = useState<CriarAjusteFinanceiroInput['direcao']>('ENTRADA')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [documento, setDocumento] = useState('')
  const [movimentadoEm, setMovimentadoEm] = useState(paraDataInput())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const contaRef = useRef<HTMLSelectElement>(null)
  const dialogRef = useFinanceDialogBehavior(onClose, salvando, contaRef)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const valorNumerico = Number(valor)
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setErro('Informe um valor maior que zero.')
      return
    }
    if (descricao.trim().length < 3) {
      setErro('Descreva o ajuste com pelo menos 3 caracteres.')
      return
    }

    setErro('')
    setSalvando(true)
    try {
      onSaved(await criarAjusteFinanceiroPreview({
        contaId,
        direcao,
        valor: valorNumerico,
        descricao: descricao.trim(),
        ...(documento.trim() ? { documento: documento.trim() } : {}),
        movimentadoEm,
      }))
    } catch (error) {
      setErro(obterMensagemErro(error))
      setSalvando(false)
    }
  }

  return (
    <div className="finance-dialog-backdrop">
      <section ref={dialogRef} className="finance-dialog" role="dialog" aria-modal="true" aria-labelledby="adjustment-dialog-title" tabIndex={-1}>
        <header className="finance-dialog__header">
          <div>
            <span className="finance-eyebrow">Livro-caixa de teste</span>
            <h2 id="adjustment-dialog-title">Novo ajuste</h2>
            <p>Corrija o saldo simulado com uma entrada ou saída identificada.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} disabled={salvando}><FinanceIcon name="close" /></button>
        </header>
        <form className="finance-form" onSubmit={handleSubmit}>
          <fieldset className="finance-type-selector">
            <legend>Direção do ajuste</legend>
            <label className={direcao === 'ENTRADA' ? 'is-active' : ''}>
              <input type="radio" name="direcao-ajuste" checked={direcao === 'ENTRADA'} onChange={() => setDirecao('ENTRADA')} />
              <FinanceIcon name="arrow-down" /> Entrada
            </label>
            <label className={direcao === 'SAIDA' ? 'is-active' : ''}>
              <input type="radio" name="direcao-ajuste" checked={direcao === 'SAIDA'} onChange={() => setDirecao('SAIDA')} />
              <FinanceIcon name="arrow-up" /> Saída
            </label>
          </fieldset>
          <div className="finance-form__grid">
            <label className="finance-form__field finance-form__field--full">
              <span>Conta</span>
              <select ref={contaRef} value={contaId} required onChange={event => setContaId(event.target.value)}>
                {contas.map(conta => <option value={conta.id} key={conta.id}>{conta.nome} · {formatarMoeda(conta.saldo)}</option>)}
              </select>
            </label>
            <label className="finance-form__field">
              <span>Valor</span>
              <input type="number" inputMode="decimal" min="0.01" step="0.01" value={valor} required onChange={event => setValor(event.target.value)} />
            </label>
            <label className="finance-form__field">
              <span>Data</span>
              <input type="date" value={movimentadoEm} required onChange={event => setMovimentadoEm(event.target.value)} />
            </label>
            <label className="finance-form__field finance-form__field--full">
              <span>Descrição</span>
              <input value={descricao} required minLength={3} maxLength={200} placeholder="Ex.: correção do saldo inicial" onChange={event => setDescricao(event.target.value)} />
            </label>
            <label className="finance-form__field finance-form__field--full">
              <span>Documento <small>(opcional)</small></span>
              <input value={documento} maxLength={80} placeholder="Referência interna" onChange={event => setDocumento(event.target.value)} />
            </label>
          </div>
          {erro && <p className="finance-form__error" role="alert">{erro}</p>}
          <footer className="finance-dialog__footer">
            <span><FinanceIcon name="flask" /> Ajuste sem efeito bancário real.</span>
            <div>
              <button type="button" className="finance-button finance-button--ghost" onClick={onClose} disabled={salvando}>Cancelar</button>
              <button type="submit" className="finance-button finance-button--primary" disabled={salvando}>{salvando ? 'Registrando...' : 'Registrar ajuste'}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

function TransferDialog({
  contas,
  onClose,
  onSaved,
}: {
  contas: ContaFinanceira[]
  onClose: () => void
  onSaved: (snapshot: FinanceiroPreviewSnapshot) => void
}) {
  const [contaOrigemId, setContaOrigemId] = useState(contas[0]?.id ?? '')
  const [contaDestinoId, setContaDestinoId] = useState(contas[1]?.id ?? '')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('Transferência entre contas')
  const [movimentadoEm, setMovimentadoEm] = useState(paraDataInput())
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const origemRef = useRef<HTMLSelectElement>(null)
  const dialogRef = useFinanceDialogBehavior(onClose, salvando, origemRef)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const valorNumerico = Number(valor)
    if (contaOrigemId === contaDestinoId) {
      setErro('Escolha contas diferentes para origem e destino.')
      return
    }
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setErro('Informe um valor maior que zero.')
      return
    }
    if (descricao.trim().length < 3) {
      setErro('Descreva a transferência com pelo menos 3 caracteres.')
      return
    }

    setErro('')
    setSalvando(true)
    try {
      onSaved(await criarTransferenciaFinanceiraPreview({
        contaOrigemId,
        contaDestinoId,
        valor: valorNumerico,
        descricao: descricao.trim(),
        movimentadoEm,
      }))
    } catch (error) {
      setErro(obterMensagemErro(error))
      setSalvando(false)
    }
  }

  return (
    <div className="finance-dialog-backdrop">
      <section ref={dialogRef} className="finance-dialog" role="dialog" aria-modal="true" aria-labelledby="transfer-dialog-title" tabIndex={-1}>
        <header className="finance-dialog__header">
          <div>
            <span className="finance-eyebrow">Movimento entre contas</span>
            <h2 id="transfer-dialog-title">Nova transferência</h2>
            <p>A saída e a entrada serão registradas juntas no livro-caixa de teste.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} disabled={salvando}><FinanceIcon name="close" /></button>
        </header>
        <form className="finance-form" onSubmit={handleSubmit}>
          <div className="finance-form__grid">
            <label className="finance-form__field finance-form__field--full">
              <span>Conta de origem</span>
              <select ref={origemRef} value={contaOrigemId} required onChange={event => setContaOrigemId(event.target.value)}>
                {contas.map(conta => <option value={conta.id} key={conta.id}>{conta.nome} · {formatarMoeda(conta.saldo)}</option>)}
              </select>
            </label>
            <label className="finance-form__field finance-form__field--full">
              <span>Conta de destino</span>
              <select value={contaDestinoId} required onChange={event => setContaDestinoId(event.target.value)}>
                {contas.map(conta => <option value={conta.id} key={conta.id}>{conta.nome}</option>)}
              </select>
            </label>
            <label className="finance-form__field">
              <span>Valor</span>
              <input type="number" inputMode="decimal" min="0.01" step="0.01" value={valor} required onChange={event => setValor(event.target.value)} />
            </label>
            <label className="finance-form__field">
              <span>Data</span>
              <input type="date" value={movimentadoEm} required onChange={event => setMovimentadoEm(event.target.value)} />
            </label>
            <label className="finance-form__field finance-form__field--full">
              <span>Descrição</span>
              <input value={descricao} required minLength={3} maxLength={200} onChange={event => setDescricao(event.target.value)} />
            </label>
          </div>
          {erro && <p className="finance-form__error" role="alert">{erro}</p>}
          <footer className="finance-dialog__footer">
            <span><FinanceIcon name="flask" /> Transferência isolada da produção.</span>
            <div>
              <button type="button" className="finance-button finance-button--ghost" onClick={onClose} disabled={salvando}>Cancelar</button>
              <button type="submit" className="finance-button finance-button--primary" disabled={salvando}>{salvando ? 'Transferindo...' : 'Transferir no preview'}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

function ReverseMovementDialog({
  movimentacao,
  snapshot,
  onClose,
  onSaved,
}: {
  movimentacao: MovimentacaoFinanceira
  snapshot: FinanceiroPreviewSnapshot
  onClose: () => void
  onSaved: (snapshot: FinanceiroPreviewSnapshot) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const motivoRef = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useFinanceDialogBehavior(onClose, salvando, motivoRef)
  const lancamento = movimentacao.lancamentoId
    ? snapshot.lancamentos.find(item => item.id === movimentacao.lancamentoId)
    : undefined

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const motivoNormalizado = motivo.trim()
    if (motivoNormalizado.length < 3) {
      setErro('Explique o estorno com pelo menos 3 caracteres.')
      return
    }

    setErro('')
    setSalvando(true)
    try {
      onSaved(await estornarMovimentacaoFinanceiraPreview(
        movimentacao,
        motivoNormalizado,
        lancamento?.versao,
      ))
    } catch (error) {
      setErro(obterMensagemErro(error))
      setSalvando(false)
    }
  }

  return (
    <div className="finance-dialog-backdrop">
      <section ref={dialogRef} className="finance-dialog" role="dialog" aria-modal="true" aria-labelledby="reverse-movement-title" aria-describedby="reverse-movement-description" tabIndex={-1}>
        <header className="finance-dialog__header">
          <div>
            <span className="finance-eyebrow">Estorno auditável</span>
            <h2 id="reverse-movement-title">Estornar movimentação</h2>
            <p id="reverse-movement-description">{movimentacao.descricao} · {formatarMoeda(movimentacao.valor)}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} disabled={salvando}><FinanceIcon name="close" /></button>
        </header>
        <form className="finance-form" onSubmit={handleSubmit}>
          <p className="finance-dialog__notice">
            {movimentacao.lancamentoId
              ? 'A baixa será estornada e o lançamento relacionado voltará ao saldo em aberto correspondente.'
              : movimentacao.grupoTransferencia
                ? 'As duas pontas desta transferência serão estornadas em conjunto.'
                : 'O ajuste será revertido no saldo da conta de teste.'}
          </p>
          <label className="finance-form__field finance-form__field--full">
            <span>Motivo do estorno</span>
            <textarea ref={motivoRef} rows={4} value={motivo} required minLength={3} maxLength={500} placeholder="Explique por que este movimento deve ser estornado" onChange={event => setMotivo(event.target.value)} />
          </label>
          {erro && <p className="finance-form__error" role="alert">{erro}</p>}
          <footer className="finance-dialog__footer">
            <span><FinanceIcon name="flask" /> A ação ficará registrada na auditoria.</span>
            <div>
              <button type="button" className="finance-button finance-button--ghost" onClick={onClose} disabled={salvando}>Voltar</button>
              <button type="submit" className="finance-button finance-button--danger" disabled={salvando}>{salvando ? 'Estornando...' : 'Estornar no preview'}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

function rotularAcaoAuditoria(acao: string) {
  if (ACAO_AUDITORIA_LABELS[acao]) return ACAO_AUDITORIA_LABELS[acao]
  const texto = acao.replaceAll('_', ' ').toLocaleLowerCase('pt-BR')
  return texto.charAt(0).toLocaleUpperCase('pt-BR') + texto.slice(1)
}

function formatarDataHora(data: string) {
  const valor = new Date(data)
  if (Number.isNaN(valor.getTime())) return formatarData(data)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(valor)
}
