import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { UsuarioAutenticado } from '../../auth/types/auth.types'
import {
  STATUS_ORDEM_LABELS,
  type StatusOrdem,
} from '../../../shared/types/ordem.types'
import { buscarResumoDashboard } from '../services/dashboard.service'
import type {
  PendenciaDashboard,
  ResumoDashboard,
  TipoPendenciaDashboard,
} from '../types/dashboard.types'
import './DashboardPage.css'

interface DashboardPageProps {
  usuario: UsuarioAutenticado
}

const STATUS_FLUXO: StatusOrdem[] = [
  'RECEBIDO',
  'EM_ANALISE',
  'EM_EXECUCAO',
  'AGUARDANDO_PECA',
  'PRONTO',
]

const PENDENCIA_META: Record<
  TipoPendenciaDashboard,
  { titulo: string; descricao: string; tone: 'amber' | 'red' | 'green' }
> = {
  AGUARDANDO_PECA: {
    titulo: 'Peça pendente',
    descricao: 'Aguardando compra ou chegada da peça',
    tone: 'amber',
  },
  AGUARDANDO_PAGAMENTO: {
    titulo: 'Pagamento pendente',
    descricao: 'Serviço pronto com saldo a receber',
    tone: 'red',
  },
  AGUARDANDO_ENTREGA: {
    titulo: 'Aguardando entrega',
    descricao: 'Pagamento quitado; combine a retirada',
    tone: 'green',
  },
}

export default function DashboardPage({ usuario }: DashboardPageProps) {
  const [resumo, setResumo] = useState<ResumoDashboard | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregarResumo = useCallback(async (signal?: AbortSignal) => {
    await Promise.resolve()
    if (signal?.aborted) return

    setCarregando(true)
    setErro('')

    try {
      setResumo(await buscarResumoDashboard({ signal }))
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setErro(obterMensagemErro(error))
    } finally {
      if (!signal?.aborted) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    void buscarResumoDashboard({ signal: controller.signal })
      .then(resultado => setResumo(resultado))
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErro(obterMensagemErro(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false)
      })

    return () => controller.abort()
  }, [])

  if (carregando && !resumo) return <DashboardSkeleton />

  if (erro && !resumo) {
    return (
      <section className="dashboard-feedback" role="alert">
        <div className="dashboard-feedback__icon">
          <WarningIcon />
        </div>
        <h1>Não foi possível carregar a dashboard</h1>
        <p>{erro}</p>
        <button type="button" onClick={() => void carregarResumo()}>
          Tentar novamente
        </button>
      </section>
    )
  }

  if (!resumo) return null

  const acoesComerciais =
    resumo.orcamentos.aguardandoCliente +
    resumo.orcamentos.aprovadosParaOrdem

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <span className="dashboard__eyebrow">Central de operações</span>
          <h1>Olá, {obterPrimeiroNome(usuario.nome)}</h1>
          <p>Veja o que precisa da sua atenção e acompanhe cada serviço.</p>
        </div>

        <div className="dashboard__actions">
          <Link className="dashboard__action dashboard__action--secondary" to="/ordens">
            Ver ordens
          </Link>
          <Link className="dashboard__action dashboard__action--primary" to="/orcamentos/novo">
            <PlusIcon />
            Novo orçamento
          </Link>
        </div>
      </header>

      {erro && (
        <div className="dashboard-update-warning" role="status">
          <span>Os dados podem estar desatualizados.</span>
          <button type="button" onClick={() => void carregarResumo()}>
            <RefreshIcon /> Atualizar
          </button>
        </div>
      )}

      <section className="dashboard-metrics" aria-label="Indicadores operacionais">
        <MetricCard
          label="Serviços em aberto"
          hint="Atendimentos ativos"
          value={resumo.ordens.abertas}
          tone="blue"
          to="/ordens"
          icon={<OrdersIcon />}
        />
        <MetricCard
          label="Aguardando peça"
          hint="Serviços bloqueados"
          value={resumo.ordens.aguardandoPeca}
          tone="amber"
          to="/ordens?status=AGUARDANDO_PECA"
          icon={<PackageIcon />}
        />
        <MetricCard
          label="Prontos"
          hint="Pagamento ou entrega"
          value={resumo.ordens.prontasParaFinalizar}
          tone="green"
          to="/ordens?status=PRONTO"
          icon={<CheckIcon />}
        />
        <MetricCard
          label="Ações comerciais"
          hint="Orçamentos para acompanhar"
          value={acoesComerciais}
          tone="purple"
          to="/orcamentos"
          icon={<BudgetIcon />}
        />
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-card dashboard-card--pending">
          <CardHeader
            eyebrow="Prioridades"
            title="Pendências para resolver"
            description="Serviços parados ou prontos que precisam de uma ação."
            action={<Link to="/ordens">Ver todas</Link>}
          />

          {resumo.ordens.pendencias.length === 0 ? (
            <EmptyState
              icon={<CheckIcon />}
              title="Tudo em dia por aqui"
              description="Nenhum serviço aguarda peça, pagamento ou entrega."
            />
          ) : (
            <div className="dashboard-pending-list">
              {resumo.ordens.pendencias.map(pendencia => (
                <PendingRow key={pendencia.id} pendencia={pendencia} />
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-card dashboard-card--commercial">
          <CardHeader
            eyebrow="Comercial"
            title="Próximas ações"
            description="Avance os orçamentos sem perder oportunidades."
          />

          <div className="dashboard-commercial-list">
            <CommercialAction
              count={resumo.orcamentos.aguardandoCliente}
              title="Aguardando cliente"
              description="Orçamentos enviados sem resposta"
              to="/orcamentos?status=ENVIADO"
              tone="blue"
            />
            <CommercialAction
              count={resumo.orcamentos.aprovadosParaOrdem}
              title="Gerar ordem de serviço"
              description="Orçamentos aprovados e ainda não convertidos"
              to="/orcamentos?status=APROVADO"
              tone="green"
            />
          </div>

          <div className="dashboard-commercial-footer">
            <span>{resumo.clientes.total.toLocaleString('pt-BR')} clientes cadastrados</span>
            <Link to="/clientes">Ver clientes <ArrowIcon /></Link>
          </div>
        </section>

        <section className="dashboard-card dashboard-card--open">
          <CardHeader
            eyebrow="Andamento"
            title="Serviços em aberto"
            description="Últimas ordens movimentadas pela equipe."
            action={<Link to="/ordens">Abrir lista completa</Link>}
          />

          <div className="dashboard-flow" aria-label="Etapas dos serviços em aberto">
            {STATUS_FLUXO.map(status => (
              <Link key={status} to={`/ordens?status=${status}`}>
                <span>{STATUS_ORDEM_LABELS[status]}</span>
                <strong>{resumo.ordens.porStatus[status]}</strong>
              </Link>
            ))}
          </div>

          {resumo.ordens.emAberto.length === 0 ? (
            <EmptyState
              icon={<OrdersIcon />}
              title="Nenhum serviço em aberto"
              description="Crie um orçamento para iniciar um novo atendimento."
              action={<Link to="/orcamentos/novo">Criar orçamento</Link>}
            />
          ) : (
            <div className="dashboard-open-list">
              {resumo.ordens.emAberto.map(ordem => (
                <Link className="dashboard-order" to={`/ordens/${ordem.id}`} key={ordem.id}>
                  <span className="dashboard-order__number">OS #{ordem.id}</span>
                  <span className="dashboard-order__main">
                    <strong>{ordem.equipamento}</strong>
                    <small>{ordem.cliente.nome}</small>
                  </span>
                  <StatusBadge status={ordem.status} />
                  <time dateTime={ordem.atualizadoEm}>
                    Atualizada {formatarData(ordem.atualizadoEm)}
                  </time>
                  <ArrowIcon />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  hint,
  value,
  tone,
  to,
  icon,
}: {
  label: string
  hint: string
  value: number
  tone: 'blue' | 'amber' | 'green' | 'purple'
  to: string
  icon: ReactNode
}) {
  return (
    <Link className={`dashboard-metric dashboard-metric--${tone}`} to={to}>
      <span className="dashboard-metric__icon">{icon}</span>
      <span className="dashboard-metric__copy">
        <span>{label}</span>
        <strong>{value.toLocaleString('pt-BR')}</strong>
        <small>{hint}</small>
      </span>
      <ArrowIcon />
    </Link>
  )
}

function CardHeader({
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
    <div className="dashboard-card__header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && <div className="dashboard-card__action">{action}</div>}
    </div>
  )
}

function PendingRow({ pendencia }: { pendencia: PendenciaDashboard }) {
  const meta = PENDENCIA_META[pendencia.tipo]
  const detalhePagamento =
    pendencia.tipo === 'AGUARDANDO_PAGAMENTO' && pendencia.pagamento
      ? `Saldo ${formatarMoeda(pendencia.pagamento.saldo)}`
      : meta.descricao

  return (
    <Link className="dashboard-pending" to={`/ordens/${pendencia.id}`}>
      <span className={`dashboard-pending__marker dashboard-pending__marker--${meta.tone}`} />
      <span className="dashboard-pending__content">
        <span className="dashboard-pending__topline">
          <strong>{meta.titulo}</strong>
          <small>OS #{pendencia.id}</small>
        </span>
        <span className="dashboard-pending__service">
          {pendencia.equipamento} · {pendencia.cliente.nome}
        </span>
        <span className="dashboard-pending__detail">
          {detalhePagamento} · desde {formatarData(pendencia.atualizadoEm)}
        </span>
      </span>
      <ArrowIcon />
    </Link>
  )
}

function CommercialAction({
  count,
  title,
  description,
  to,
  tone,
}: {
  count: number
  title: string
  description: string
  to: string
  tone: 'blue' | 'green'
}) {
  return (
    <Link className={`dashboard-commercial dashboard-commercial--${tone}`} to={to}>
      <strong>{count.toLocaleString('pt-BR')}</strong>
      <span>
        <b>{title}</b>
        <small>{description}</small>
      </span>
      <ArrowIcon />
    </Link>
  )
}

function StatusBadge({ status }: { status: StatusOrdem }) {
  return (
    <span className={`status-badge status-badge--${status.toLowerCase()}`}>
      {STATUS_ORDEM_LABELS[status]}
    </span>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="dashboard-empty">
      <span className="dashboard-empty__icon">{icon}</span>
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="dashboard dashboard--loading" aria-busy="true">
      <span className="sr-only">Carregando dashboard</span>
      <div className="dashboard-skeleton dashboard-skeleton--title" />
      <div className="dashboard-metrics">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="dashboard-skeleton dashboard-skeleton--metric" key={index} />
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-skeleton dashboard-skeleton--panel" />
        <div className="dashboard-skeleton dashboard-skeleton--panel" />
        <div className="dashboard-skeleton dashboard-skeleton--wide" />
      </div>
    </div>
  )
}

function obterPrimeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || 'usuário'
}

function formatarData(data: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(data))
}

function formatarMoeda(valor: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(valor))
}

function obterMensagemErro(error: unknown) {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado'
}

function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
}

function OrdersIcon() {
  return <Icon><path d="M7 4h10M7 8h10M7 12h6M5 20h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z" /></Icon>
}

function PackageIcon() {
  return <Icon><path d="m4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7M12 11v10" /></Icon>
}

function CheckIcon() {
  return <Icon><path d="m5 12 4 4L19 6" /></Icon>
}

function BudgetIcon() {
  return <Icon><path d="M7 3h10v4H7V3ZM5 5H4a1 1 0 0 0-1 1v15h18V6a1 1 0 0 0-1-1h-1M7 12h10M7 16h7" /></Icon>
}

function PlusIcon() {
  return <Icon><path d="M12 5v14M5 12h14" /></Icon>
}

function ArrowIcon() {
  return <Icon><path d="m9 18 6-6-6-6" /></Icon>
}

function RefreshIcon() {
  return <Icon><path d="M20 6v5h-5M4 18v-5h5" /><path d="M6.1 9a7 7 0 0 1 11.7-2.2L20 11M4 13l2.2 4.2A7 7 0 0 0 17.9 15" /></Icon>
}

function WarningIcon() {
  return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon>
}
