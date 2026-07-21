import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { UsuarioAutenticado } from '../../auth/types/auth.types'
import { buscarResumoDashboard } from '../services/dashboard.service'
import {
  STATUS_ORDEM,
  type ResumoDashboard,
  type StatusOrdem,
} from '../types/dashboard.types'
import './DashboardPage.css'

interface DashboardPageProps {
  usuario: UsuarioAutenticado
}

export default function DashboardPage({
  usuario,
}: DashboardPageProps) {
  const [resumo, setResumo] = useState<ResumoDashboard | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregarResumo = useCallback(async (signal?: AbortSignal) => {
    // Adia as alterações de estado para depois do início da tarefa assíncrona.
    // Isso também permite que o cleanup do StrictMode cancele a primeira carga.
    await Promise.resolve()

    if (signal?.aborted) return

    setCarregando(true)
    setErro('')

    try {
      const resultado = await buscarResumoDashboard({ signal })
      setResumo(resultado)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return

      setErro(
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro inesperado',
      )
    } finally {
      if (!signal?.aborted) {
        setCarregando(false)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    // A primeira carga começa com `carregando` igual a true. Os estados são
    // atualizados somente quando a requisição assíncrona termina.
    void buscarResumoDashboard({ signal: controller.signal })
      .then(resultado => {
        setResumo(resultado)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErro(obterMensagemErro(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCarregando(false)
        }
      })

    return () => controller.abort()
  }, [])

  if (carregando && !resumo) {
    return <DashboardSkeleton />
  }

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

  const emAtendimento =
    resumo.ordens.porStatus.ABERTA +
    resumo.ordens.porStatus.EM_ANALISE +
    resumo.ordens.porStatus.APROVADA +
    resumo.ordens.porStatus.EM_ANDAMENTO

  const aguardando =
    resumo.ordens.porStatus.AGUARDANDO_APROVACAO +
    resumo.ordens.porStatus.AGUARDANDO_PECA

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <span className="dashboard__eyebrow">Visão geral</span>
          <h1>Olá, {obterPrimeiroNome(usuario.nome)}</h1>
          <p>Acompanhe os principais números da sua assistência.</p>
        </div>

        {erro && (
          <button
            className="dashboard__refresh"
            type="button"
            onClick={() => void carregarResumo()}
          >
            <RefreshIcon />
            Atualizar novamente
          </button>
        )}
      </header>

      <section className="dashboard-metrics" aria-label="Indicadores">
        <MetricCard
          label="Ordens totais"
          value={resumo.ordens.total}
          tone="blue"
          icon={<OrdersIcon />}
        />
        <MetricCard
          label="Em atendimento"
          value={emAtendimento}
          tone="orange"
          icon={<ToolsIcon />}
        />
        <MetricCard
          label="Aguardando"
          value={aguardando}
          tone="purple"
          icon={<ClockIcon />}
        />
        <MetricCard
          label="Clientes"
          value={resumo.clientes.total}
          tone="green"
          icon={<UsersIcon />}
        />
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-card dashboard-recent">
          <div className="dashboard-card__header">
            <div>
              <h2>Ordens recentes</h2>
              <p>Os últimos atendimentos cadastrados.</p>
            </div>
          </div>

          {resumo.ordens.recentes.length === 0 ? (
            <div className="dashboard-empty">
              <OrdersIcon />
              <strong>Nenhuma ordem cadastrada</strong>
              <span>As novas ordens aparecerão aqui.</span>
            </div>
          ) : (
            <div className="dashboard-recent__list">
              {resumo.ordens.recentes.map(ordem => (
                <article className="dashboard-order" key={ordem.id}>
                  <div className="dashboard-order__number">
                    #{ordem.id}
                  </div>
                  <div className="dashboard-order__main">
                    <strong>{ordem.equipamento}</strong>
                    <span>{ordem.cliente.nome}</span>
                  </div>
                  <StatusBadge status={ordem.status} />
                  <time dateTime={ordem.criadoEm}>
                    {formatarData(ordem.criadoEm)}
                  </time>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-card dashboard-status">
          <div className="dashboard-card__header">
            <div>
              <h2>Ordens por status</h2>
              <p>Distribuição atual dos atendimentos.</p>
            </div>
          </div>

          <div className="dashboard-status__list">
            {STATUS_ORDEM.map(status => (
              <StatusRow
                key={status}
                status={status}
                value={resumo.ordens.porStatus[status]}
                total={resumo.ordens.total}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

interface MetricCardProps {
  label: string
  value: number
  tone: 'blue' | 'orange' | 'purple' | 'green'
  icon: ReactNode
}

function MetricCard({ label, value, tone, icon }: MetricCardProps) {
  return (
    <article className={`dashboard-metric dashboard-metric--${tone}`}>
      <div className="dashboard-metric__icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value.toLocaleString('pt-BR')}</strong>
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: StatusOrdem }) {
  return (
    <span className={`status-badge status-badge--${status.toLowerCase()}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

interface StatusRowProps {
  status: StatusOrdem
  value: number
  total: number
}

function StatusRow({ status, value, total }: StatusRowProps) {
  const percent = total === 0 ? 0 : Math.round((value / total) * 100)

  return (
    <div className="dashboard-status__item">
      <div className="dashboard-status__text">
        <span>{STATUS_LABELS[status]}</span>
        <strong>{value}</strong>
      </div>
      <div
        className="dashboard-status__track"
        role="progressbar"
        aria-label={STATUS_LABELS[status]}
        aria-valuemin={0}
        aria-valuemax={Math.max(total, 1)}
        aria-valuenow={value}
      >
        <span
          className={`dashboard-status__bar dashboard-status__bar--${status.toLowerCase()}`}
          style={{ width: `${percent}%` }}
        />
      </div>
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
          <div
            className="dashboard-skeleton dashboard-skeleton--metric"
            key={index}
          />
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-skeleton dashboard-skeleton--panel" />
        <div className="dashboard-skeleton dashboard-skeleton--panel" />
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<StatusOrdem, string> = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em análise',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  APROVADA: 'Aprovada',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_PECA: 'Aguardando peça',
  CONCLUIDA: 'Concluída',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
}

function obterPrimeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || 'usuário'
}

function formatarData(data: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(data))
}

function obterMensagemErro(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado'
}

interface IconProps {
  children: ReactNode
}

function Icon({ children }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function OrdersIcon() {
  return (
    <Icon>
      <path d="M7 4h10M7 8h10M7 12h6M5 20h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z" />
    </Icon>
  )
}

function ToolsIcon() {
  return (
    <Icon>
      <path d="m14.7 6.3 3-3a5 5 0 0 1-6.4 6.4L5 16l3 3 6.3-6.3a5 5 0 0 1 6.4-6.4l-3 3-3-3Z" />
    </Icon>
  )
}

function ClockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  )
}

function UsersIcon() {
  return (
    <Icon>
      <path d="M16 19v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 17.5V19" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M17 11a3.5 3.5 0 0 1 4 3.5V16" />
    </Icon>
  )
}

function RefreshIcon() {
  return (
    <Icon>
      <path d="M20 6v5h-5M4 18v-5h5" />
      <path d="M6.1 9a7 7 0 0 1 11.7-2.2L20 11M4 13l2.2 4.2A7 7 0 0 0 17.9 15" />
    </Icon>
  )
}

function WarningIcon() {
  return (
    <Icon>
      <path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 8v5M12 17h.01" />
    </Icon>
  )
}
