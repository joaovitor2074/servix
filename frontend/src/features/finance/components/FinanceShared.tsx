import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useFinanceDialogBehavior } from '../hooks/useFinanceDialogBehavior'
import {
  cancelarLancamentoFinanceiroPreview,
  criarLancamentoFinanceiroPreview,
  registrarBaixaFinanceiraPreview,
} from '../services/finance-preview.service'
import type {
  ContaFinanceira,
  FinanceiroPreviewSnapshot,
  FonteDadosFinanceiros,
  LancamentoFinanceiro,
  StatusLancamentoFinanceiro,
  TipoLancamentoFinanceiro,
} from '../types/finance.types'
import {
  STATUS_LANCAMENTO_LABELS,
  formatarMoeda,
  obterMensagemErro,
  paraDataInput,
  subtrairValoresMonetarios,
} from '../utils/finance-formatters'

export function FinancePageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <header className="finance-page-header">
      <div>
        <span className="finance-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="finance-page-header__actions">{actions}</div>}
    </header>
  )
}

export function FinanceSourceNote({
  fonte,
  atualizadoEm,
}: {
  fonte: FonteDadosFinanceiros
  atualizadoEm: string
}) {
  if (fonte === 'DEMONSTRACAO_LOCAL') {
    return (
      <div className="finance-source-note finance-source-note--demo" role="status">
        <FinanceIcon name="info" />
        <span>
          <strong>Dados demonstrativos temporários.</strong>{' '}
          A API de preview não respondeu; alterações ficam apenas nesta sessão e
          não são persistidas.
        </span>
      </div>
    )
  }

  return (
    <div className="finance-source-note" role="status">
      <span className="finance-live-dot" aria-hidden="true" />
      <span>
        Conectado à API de preview · atualizado às{' '}
        {new Intl.DateTimeFormat('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(atualizadoEm))}
      </span>
    </div>
  )
}

export function FinanceStatusBadge({
  status,
}: {
  status: StatusLancamentoFinanceiro
}) {
  return (
    <span className={`finance-status finance-status--${status.toLowerCase()}`}>
      {STATUS_LANCAMENTO_LABELS[status]}
    </span>
  )
}

export function FinanceLoading() {
  return (
    <div className="finance-loading" aria-busy="true">
      <span className="sr-only">Carregando dados financeiros</span>
      <div className="finance-skeleton finance-skeleton--header" />
      <div className="finance-skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="finance-skeleton finance-skeleton--metric" key={index} />
        ))}
      </div>
      <div className="finance-skeleton finance-skeleton--content" />
    </div>
  )
}

export function FinanceError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <section className="finance-feedback" role="alert">
      <span className="finance-feedback__icon"><FinanceIcon name="warning" /></span>
      <h1>Não foi possível abrir o financeiro</h1>
      <p>{message}</p>
      <button type="button" onClick={onRetry}>Tentar novamente</button>
    </section>
  )
}

export function FinanceEmpty({
  title,
  description,
  icon = 'inbox',
}: {
  title: string
  description: string
  icon?: FinanceIconName
}) {
  return (
    <div className="finance-empty">
      <span><FinanceIcon name={icon} /></span>
      <strong>{title}</strong>
      <small>{description}</small>
    </div>
  )
}

export function NewFinanceEntryDialog({
  snapshot,
  defaultType = 'RECEITA',
  onClose,
  onSaved,
}: {
  snapshot: FinanceiroPreviewSnapshot
  defaultType?: TipoLancamentoFinanceiro
  onClose: () => void
  onSaved: (snapshot: FinanceiroPreviewSnapshot) => void
}) {
  const [tipo, setTipo] = useState<TipoLancamentoFinanceiro>(defaultType)
  const [descricao, setDescricao] = useState('')
  const [contraparte, setContraparte] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState(paraDataInput())
  const [competencia, setCompetencia] = useState(paraDataInput())
  const [categoriaId, setCategoriaId] = useState(
    () => snapshot.categorias.find(item => item.ativa && item.tipo === defaultType)?.id ?? '',
  )
  const [centroCustoId, setCentroCustoId] = useState(
    () => snapshot.centrosCusto.find(item => item.ativo)?.id ?? '',
  )
  const [contaId, setContaId] = useState(
    () => snapshot.contas.find(item => item.ativa)?.id ?? '',
  )
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const descricaoRef = useRef<HTMLInputElement>(null)

  const categorias = useMemo(
    () => snapshot.categorias.filter(item => item.ativa && item.tipo === tipo),
    [snapshot.categorias, tipo],
  )
  const categoriaSelecionada = categorias.some(item => item.id === categoriaId)
    ? categoriaId
    : categorias[0]?.id ?? ''

  const dialogRef = useFinanceDialogBehavior(onClose, salvando, descricaoRef)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')

    const valorNumerico = Number(valor)
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      setErro('Informe um valor maior que zero.')
      return
    }

    setSalvando(true)
    try {
      const dados = await criarLancamentoFinanceiroPreview({
        tipo,
        descricao: descricao.trim(),
        contraparte: contraparte.trim(),
        valor: valorNumerico,
        vencimento,
        competencia,
        categoriaId: categoriaSelecionada,
        centroCustoId,
        ...(contaId ? { contaId } : {}),
        ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
      })
      onSaved(dados)
    } catch (error) {
      setErro(obterMensagemErro(error))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="finance-dialog-backdrop">
      <section
        ref={dialogRef}
        className="finance-dialog finance-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-finance-entry-title"
        tabIndex={-1}
      >
        <header className="finance-dialog__header">
          <div>
            <span className="finance-eyebrow">Simulação financeira</span>
            <h2 id="new-finance-entry-title">Novo lançamento</h2>
            <p>O lançamento será criado somente no ambiente de teste.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} disabled={salvando}>
            <FinanceIcon name="close" />
          </button>
        </header>

        <form className="finance-form" onSubmit={handleSubmit}>
          <fieldset className="finance-type-selector">
            <legend>Tipo de lançamento</legend>
            <label className={tipo === 'RECEITA' ? 'is-active' : ''}>
              <input
                type="radio"
                name="tipo"
                value="RECEITA"
                checked={tipo === 'RECEITA'}
                onChange={() => setTipo('RECEITA')}
              />
              <FinanceIcon name="arrow-down" />
              Conta a receber
            </label>
            <label className={tipo === 'DESPESA' ? 'is-active' : ''}>
              <input
                type="radio"
                name="tipo"
                value="DESPESA"
                checked={tipo === 'DESPESA'}
                onChange={() => setTipo('DESPESA')}
              />
              <FinanceIcon name="arrow-up" />
              Conta a pagar
            </label>
          </fieldset>

          <div className="finance-form__grid">
            <label className="finance-form__field finance-form__field--wide">
              <span>Descrição</span>
              <input
                ref={descricaoRef}
                value={descricao}
                maxLength={120}
                required
                placeholder="Ex.: Manutenção preventiva — OS #1058"
                onChange={event => setDescricao(event.target.value)}
              />
            </label>

            <label className="finance-form__field finance-form__field--wide">
              <span>{tipo === 'RECEITA' ? 'Cliente' : 'Fornecedor'}</span>
              <input
                value={contraparte}
                maxLength={100}
                required
                placeholder={tipo === 'RECEITA' ? 'Nome do cliente' : 'Nome do fornecedor'}
                onChange={event => setContraparte(event.target.value)}
              />
            </label>

            <label className="finance-form__field">
              <span>Valor</span>
              <span className="finance-money-input">
                <small>R$</small>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={valor}
                  required
                  placeholder="0,00"
                  onChange={event => setValor(event.target.value)}
                />
              </span>
            </label>

            <label className="finance-form__field">
              <span>Vencimento</span>
              <input
                type="date"
                value={vencimento}
                required
                onChange={event => setVencimento(event.target.value)}
              />
            </label>

            <label className="finance-form__field">
              <span>Competência</span>
              <input
                type="date"
                value={competencia}
                required
                onChange={event => setCompetencia(event.target.value)}
              />
            </label>

            <label className="finance-form__field">
              <span>Categoria</span>
              <select value={categoriaSelecionada} required onChange={event => setCategoriaId(event.target.value)}>
                {categorias.map(categoria => (
                  <option value={categoria.id} key={categoria.id}>{categoria.nome}</option>
                ))}
              </select>
            </label>

            <label className="finance-form__field">
              <span>Centro de custo</span>
              <select value={centroCustoId} required onChange={event => setCentroCustoId(event.target.value)}>
                {snapshot.centrosCusto.filter(item => item.ativo).map(centro => (
                  <option value={centro.id} key={centro.id}>{centro.nome}</option>
                ))}
              </select>
            </label>

            <label className="finance-form__field">
              <span>Conta prevista</span>
              <select value={contaId} onChange={event => setContaId(event.target.value)}>
                <option value="">Definir na baixa</option>
                {snapshot.contas.filter(item => item.ativa).map(conta => (
                  <option value={conta.id} key={conta.id}>{conta.nome}</option>
                ))}
              </select>
            </label>

            <label className="finance-form__field finance-form__field--full">
              <span>Observação <small>(opcional)</small></span>
              <textarea
                rows={3}
                value={observacao}
                maxLength={500}
                placeholder="Inclua detalhes úteis para a equipe financeira"
                onChange={event => setObservacao(event.target.value)}
              />
            </label>
          </div>

          {erro && <p className="finance-form__error" role="alert">{erro}</p>}

          <footer className="finance-dialog__footer">
            <span><FinanceIcon name="flask" /> Nenhum dinheiro será movimentado.</span>
            <div>
              <button type="button" className="finance-button finance-button--ghost" onClick={onClose} disabled={salvando}>
                Cancelar
              </button>
              <button type="submit" className="finance-button finance-button--primary" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Criar no preview'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function SettleFinanceEntryDialog({
  lancamento,
  contas,
  onClose,
  onSaved,
}: {
  lancamento: LancamentoFinanceiro
  contas: ContaFinanceira[]
  onClose: () => void
  onSaved: (snapshot: FinanceiroPreviewSnapshot) => void
}) {
  const restante = Math.max(
    subtrairValoresMonetarios(lancamento.valor, lancamento.valorPago),
    0,
  )
  const [valor, setValor] = useState(String(restante))
  const [pagoEm, setPagoEm] = useState(paraDataInput())
  const [contaId, setContaId] = useState(lancamento.contaId ?? contas[0]?.id ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const contaRef = useRef<HTMLSelectElement>(null)

  const dialogRef = useFinanceDialogBehavior(onClose, salvando, contaRef)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    const valorNumerico = Number(valor)

    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0 || valorNumerico > restante) {
      setErro(`Informe um valor entre R$ 0,01 e ${formatarMoeda(restante)}.`)
      return
    }

    setSalvando(true)
    try {
      const dados = await registrarBaixaFinanceiraPreview(lancamento.id, {
        contaId,
        valor: valorNumerico,
        pagoEm,
      })
      onSaved(dados)
    } catch (error) {
      setErro(obterMensagemErro(error))
    } finally {
      setSalvando(false)
    }
  }

  const verbo = lancamento.tipo === 'RECEITA' ? 'recebimento' : 'pagamento'

  return (
    <div className="finance-dialog-backdrop">
      <section ref={dialogRef} className="finance-dialog" role="dialog" aria-modal="true" aria-labelledby="settle-entry-title" tabIndex={-1}>
        <header className="finance-dialog__header">
          <div>
            <span className="finance-eyebrow">Baixa simulada</span>
            <h2 id="settle-entry-title">Registrar {verbo}</h2>
            <p>{lancamento.descricao}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} disabled={salvando}>
            <FinanceIcon name="close" />
          </button>
        </header>

        <form className="finance-form" onSubmit={handleSubmit}>
          <div className="finance-settle-summary">
            <span>Valor original <strong>{formatarMoeda(lancamento.valor)}</strong></span>
            <span>Já baixado <strong>{formatarMoeda(lancamento.valorPago)}</strong></span>
            <span>Em aberto <strong>{formatarMoeda(restante)}</strong></span>
          </div>

          <div className="finance-form__grid">
            <label className="finance-form__field finance-form__field--full">
              <span>Conta</span>
              <select ref={contaRef} value={contaId} required onChange={event => setContaId(event.target.value)}>
                {contas.filter(item => item.ativa).map(conta => (
                  <option value={conta.id} key={conta.id}>{conta.nome} · {formatarMoeda(conta.saldo)}</option>
                ))}
              </select>
            </label>
            <label className="finance-form__field">
              <span>Valor da baixa</span>
              <input type="number" min="0.01" max={restante} step="0.01" value={valor} required onChange={event => setValor(event.target.value)} />
            </label>
            <label className="finance-form__field">
              <span>Data</span>
              <input type="date" value={pagoEm} required onChange={event => setPagoEm(event.target.value)} />
            </label>
          </div>

          {erro && <p className="finance-form__error" role="alert">{erro}</p>}

          <footer className="finance-dialog__footer">
            <span><FinanceIcon name="flask" /> Simulação sem efeito bancário.</span>
            <div>
              <button type="button" className="finance-button finance-button--ghost" onClick={onClose} disabled={salvando}>Cancelar</button>
              <button type="submit" className="finance-button finance-button--primary" disabled={salvando}>
                {salvando ? 'Registrando...' : `Simular ${verbo}`}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

export function CancelFinanceEntryDialog({
  lancamento,
  onClose,
  onSaved,
}: {
  lancamento: LancamentoFinanceiro
  onClose: () => void
  onSaved: (snapshot: FinanceiroPreviewSnapshot) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const motivoRef = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useFinanceDialogBehavior(onClose, salvando, motivoRef)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const motivoNormalizado = motivo.trim()
    if (motivoNormalizado.length < 3) {
      setErro('Explique o cancelamento com pelo menos 3 caracteres.')
      return
    }

    setErro('')
    setSalvando(true)
    try {
      onSaved(await cancelarLancamentoFinanceiroPreview(lancamento, motivoNormalizado))
    } catch (error) {
      setErro(obterMensagemErro(error))
      setSalvando(false)
    }
  }

  return (
    <div className="finance-dialog-backdrop">
      <section
        ref={dialogRef}
        className="finance-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-entry-title"
        aria-describedby="cancel-entry-description"
        tabIndex={-1}
      >
        <header className="finance-dialog__header">
          <div>
            <span className="finance-eyebrow">Cancelamento controlado</span>
            <h2 id="cancel-entry-title">Cancelar lançamento</h2>
            <p id="cancel-entry-description">{lancamento.descricao}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} disabled={salvando}>
            <FinanceIcon name="close" />
          </button>
        </header>

        <form className="finance-form" onSubmit={handleSubmit}>
          <p className="finance-dialog__notice">
            O lançamento ficará cancelado somente no ambiente de teste. Esta ação será registrada na auditoria.
          </p>
          <label className="finance-form__field finance-form__field--full">
            <span>Motivo do cancelamento</span>
            <textarea
              ref={motivoRef}
              rows={4}
              value={motivo}
              required
              minLength={3}
              maxLength={500}
              placeholder="Ex.: lançamento duplicado no preview"
              onChange={event => setMotivo(event.target.value)}
            />
          </label>

          {erro && <p className="finance-form__error" role="alert">{erro}</p>}

          <footer className="finance-dialog__footer">
            <span><FinanceIcon name="flask" /> Nenhuma movimentação real será alterada.</span>
            <div>
              <button type="button" className="finance-button finance-button--ghost" onClick={onClose} disabled={salvando}>Voltar</button>
              <button type="submit" className="finance-button finance-button--danger" disabled={salvando}>
                {salvando ? 'Cancelando...' : 'Cancelar no preview'}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

export type FinanceIconName =
  | 'arrow-down'
  | 'arrow-up'
  | 'bank'
  | 'calendar'
  | 'chart'
  | 'check'
  | 'chevron'
  | 'close'
  | 'download'
  | 'filter'
  | 'flask'
  | 'folder'
  | 'inbox'
  | 'info'
  | 'plus'
  | 'search'
  | 'settings'
  | 'wallet'
  | 'warning'

export function FinanceIcon({ name }: { name: FinanceIconName }) {
  const paths: Record<FinanceIconName, ReactNode> = {
    'arrow-down': <><path d="M12 4v16M6 14l6 6 6-6" /></>,
    'arrow-up': <><path d="M12 20V4M6 10l6-6 6 6" /></>,
    bank: <><path d="m3 9 9-5 9 5M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    chart: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></>,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    flask: <><path d="M9 3h6M10 3v6l-5 8.5A2.3 2.3 0 0 0 7 21h10a2.3 2.3 0 0 0 2-3.5L14 9V3M7.5 15h9" /></>,
    folder: <><path d="M3 6h7l2 2h9v11H3V6Z" /></>,
    inbox: <><path d="M4 5h16l2 9v5H2v-5l2-9Z" /><path d="M2 14h6l1.5 2h5l1.5-2h6" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.7-.8-1.9.9-1.9L15 3.9l-1.9.9-1.9-.8-.7-2h-3l-.7 2-1.9.8L3 3.9.9 6l.9 1.9L1 9.8l-2 .7v3l2 .7.8 1.9L.9 18 3 20.1l1.9-.9 1.9.8.7 2h3l.7-2 1.9-.8 1.9.9 2.1-2.1-.9-1.9.8-1.9 2-.7Z" transform="translate(2) scale(.83)" /></>,
    wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h13" /><path d="M15 11h7v5h-7a2.5 2.5 0 0 1 0-5Z" /></>,
    warning: <><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></>,
  }

  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}
