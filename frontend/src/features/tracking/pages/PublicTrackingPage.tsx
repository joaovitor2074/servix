import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useParams } from 'react-router'
import servixLogo from '../../../assets/brand/servix-logo.svg'
import { AuthLayout } from '../../../shared/layouts/AuthLayout'
import {
  STATUS_ORDEM_LABELS,
  type StatusOrdem,
} from '../../../shared/types/ordem.types'
import {
  AcompanhamentoPublicoApiError,
  buscarAcompanhamentoPublico,
} from '../services/public-tracking.service'
import type {
  OrdemAcompanhamentoPublico,
  StatusPagamentoPublico,
} from '../types/public-tracking.types'
import './PublicTrackingPage.css'

const ETAPAS_PRINCIPAIS: Array<{
  status: Exclude<StatusOrdem, 'AGUARDANDO_PECA' | 'CANCELADO'>
  titulo: string
  descricao: string
}> = [
  {
    status: 'RECEBIDO',
    titulo: 'Recebido',
    descricao: 'Serviço registrado',
  },
  {
    status: 'EM_ANALISE',
    titulo: 'Em análise',
    descricao: 'Avaliação técnica',
  },
  {
    status: 'EM_EXECUCAO',
    titulo: 'Em execução',
    descricao: 'Serviço em andamento',
  },
  {
    status: 'PRONTO',
    titulo: 'Pronto',
    descricao: 'Disponível para entrega',
  },
  {
    status: 'ENTREGUE',
    titulo: 'Entregue',
    descricao: 'Atendimento finalizado',
  },
]

const POSICAO_STATUS: Record<StatusOrdem, number> = {
  RECEBIDO: 0,
  EM_ANALISE: 1,
  EM_EXECUCAO: 2,
  AGUARDANDO_PECA: 2,
  PRONTO: 3,
  ENTREGUE: 4,
  CANCELADO: -1,
}

const PAGAMENTO_LABELS: Record<StatusPagamentoPublico, string> = {
  PENDENTE: 'Pendente',
  PARCIAL: 'Parcialmente pago',
  PAGO: 'Pago',
  ESTORNADO: 'Estornado',
}

type ModoConsulta = 'manual' | 'silenciosa'

export default function PublicTrackingPage() {
  const { token = '' } = useParams()
  const tokenAtual = token.trim()
  const [ordemCarregada, setOrdemCarregada] = useState<{
    token: string
    dados: OrdemAcompanhamentoPublico
  } | null>(null)
  const [falhaCarga, setFalhaCarga] = useState<{
    token: string
    mensagem: string
  } | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const [erroAtualizacao, setErroAtualizacao] = useState('')
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const consultaAtual = useRef(0)
  const consultaManualAtual = useRef(0)
  const atualizacaoManualEmAndamento = useRef(false)

  // Associar resposta e erro ao token impede que dados da OS anterior apareçam
  // quando o React reaproveita o componente para outro link público.
  const ordem = ordemCarregada?.token === tokenAtual
    ? ordemCarregada.dados
    : null
  const erroCarga = falhaCarga?.token === tokenAtual
    ? falhaCarga.mensagem
    : ''
  const carregando = Boolean(tokenAtual && !ordem && !erroCarga)

  const consultar = useCallback(async (
    modo: ModoConsulta,
    signal?: AbortSignal,
  ) => {
    if (modo === 'silenciosa' && atualizacaoManualEmAndamento.current) return
    if (modo === 'manual' && atualizacaoManualEmAndamento.current) return

    const numeroConsultaManual = modo === 'manual'
      ? ++consultaManualAtual.current
      : null

    if (modo === 'manual') {
      atualizacaoManualEmAndamento.current = true
      setAtualizando(true)
    }

    const numeroConsulta = ++consultaAtual.current

    try {
      const resultado = await buscarAcompanhamentoPublico(tokenAtual, { signal })
      if (numeroConsulta !== consultaAtual.current) return

      setOrdemCarregada({ token: tokenAtual, dados: resultado })
      setFalhaCarga(null)
      setErroAtualizacao('')
      setUltimaAtualizacao(new Date())
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      if (numeroConsulta !== consultaAtual.current) return

      const mensagem = obterMensagemErro(error)
      if (modo === 'manual') {
        setErroAtualizacao(mensagem)
      }
    } finally {
      if (
        numeroConsultaManual !== null &&
        numeroConsultaManual === consultaManualAtual.current
      ) {
        atualizacaoManualEmAndamento.current = false
        setAtualizando(false)
      }
    }
  }, [tokenAtual])

  useEffect(() => {
    if (!tokenAtual) return

    const controller = new AbortController()
    const numeroConsulta = ++consultaAtual.current

    void buscarAcompanhamentoPublico(tokenAtual, { signal: controller.signal })
      .then(resultado => {
        if (numeroConsulta !== consultaAtual.current) return

        setOrdemCarregada({ token: tokenAtual, dados: resultado })
        setFalhaCarga(null)
        setErroAtualizacao('')
        setUltimaAtualizacao(new Date())
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        if (numeroConsulta !== consultaAtual.current) return
        setFalhaCarga({
          token: tokenAtual,
          mensagem: obterMensagemErro(error),
        })
      })

    return () => controller.abort()
  }, [tentativa, tokenAtual])

  const atendimentoFinalizado =
    ordem?.status === 'ENTREGUE' || ordem?.status === 'CANCELADO'

  useEffect(() => {
    if (!ordem || atendimentoFinalizado) return

    const controller = new AbortController()
    const intervalo = window.setInterval(() => {
      if (!document.hidden) {
        void consultar('silenciosa', controller.signal)
      }
    }, 30_000)

    return () => {
      window.clearInterval(intervalo)
      controller.abort()
    }
  }, [atendimentoFinalizado, consultar, ordem])

  function tentarNovamente() {
    setFalhaCarga(null)
    setTentativa(valor => valor + 1)
  }

  function atualizarAgora() {
    void consultar('manual')
  }

  return (
    <AuthLayout>
      <div className="public-tracking-page">
        <header className="public-tracking-brand">
          <img src={servixLogo} alt="Servix" />
          {ordem && <span>Acompanhamento por {ordem.empresa.nome}</span>}
        </header>

        {!token.trim() && (
          <FeedbackState
            title="Link inválido"
            message="O endereço informado não possui um token de acompanhamento válido."
          />
        )}

        {token.trim() && carregando && !ordem && <TrackingSkeleton />}

        {erroCarga && !carregando && (
          <FeedbackState
            title="Não foi possível abrir o acompanhamento"
            message={erroCarga}
            action={<button type="button" onClick={tentarNovamente}>Tentar novamente</button>}
          />
        )}

        {ordem && (
          <article className="public-tracking-card">
            <header className="public-tracking-hero">
              <div>
                <span>Ordem de serviço {formatarNumeroOrdem(ordem.numero)}</span>
                <h1>Acompanhe seu serviço</h1>
                <p>
                  Veja o andamento do atendimento de forma simples e segura.
                </p>
              </div>
              <StatusBadge
                status={ordem.status}
                label={ordem.statusDescricao || STATUS_ORDEM_LABELS[ordem.status]}
              />
            </header>

            <p className="sr-only" aria-live="polite" aria-atomic="true">
              Status do serviço: {ordem.statusDescricao || STATUS_ORDEM_LABELS[ordem.status]}.
              Previsão: {formatarPrevisao(ordem.previsaoDeEntrega)}.
              Pagamento: {PAGAMENTO_LABELS[ordem.pagamento.status]}.
            </p>

            <section className="public-tracking-overview" aria-label="Resumo da ordem de serviço">
              <InfoCard icon={<DeviceIcon />} label="Equipamento" value={ordem.equipamento} />
              <InfoCard
                icon={<CalendarIcon />}
                label="Previsão de entrega"
                value={formatarPrevisao(ordem.previsaoDeEntrega)}
              />
              <InfoCard
                icon={<ReceiptIcon />}
                label="Valor aprovado"
                value={formatarMoeda(ordem.valorAprovado)}
                tone="success"
              />
            </section>

            <section className="public-tracking-progress" aria-labelledby="public-tracking-progress-title">
              <div className="public-tracking-section-heading">
                <div>
                  <span><RouteIcon /></span>
                  <div>
                    <h2 id="public-tracking-progress-title">Andamento do serviço</h2>
                    <p>A linha do tempo é atualizada pela equipe responsável.</p>
                  </div>
                </div>
                {!atendimentoFinalizado && (
                  <span className="public-tracking-live"><i /> Atualização automática</span>
                )}
              </div>

              {ordem.status === 'CANCELADO' ? (
                <div className="public-tracking-notice public-tracking-notice--cancelled">
                  <WarningIcon />
                  <div>
                    <strong>Atendimento cancelado</strong>
                    <p>Entre em contato com a empresa caso precise de mais informações.</p>
                  </div>
                </div>
              ) : (
                <ServiceTimeline status={ordem.status} />
              )}

              {ordem.status === 'AGUARDANDO_PECA' && (
                <div className="public-tracking-notice public-tracking-notice--waiting">
                  <PackageIcon />
                  <div>
                    <strong>Aguardando peça</strong>
                    <p>O serviço está pausado enquanto a peça necessária é providenciada. A empresa atualizará o andamento assim que ela estiver disponível.</p>
                  </div>
                </div>
              )}
            </section>

            <PaymentSummary ordem={ordem} />

            <section className="public-tracking-history" aria-labelledby="public-tracking-history-title">
              <div className="public-tracking-section-heading">
                <div>
                  <span><HistoryIcon /></span>
                  <div>
                    <h2 id="public-tracking-history-title">Atualizações do atendimento</h2>
                    <p>Mensagens compartilhadas pela empresa sobre o seu serviço.</p>
                  </div>
                </div>
              </div>

              {ordem.historico.length > 0 ? (
                <ol>
                  {[...ordem.historico].reverse().map((evento, indice) => (
                    <li key={`${evento.criadoEm}-${evento.status}-${indice}`}>
                      <span aria-hidden="true"><CheckIcon /></span>
                      <div>
                        <div>
                          <strong>{evento.statusDescricao || STATUS_ORDEM_LABELS[evento.status]}</strong>
                          <time dateTime={evento.criadoEm}>{formatarDataHora(evento.criadoEm)}</time>
                        </div>
                        {evento.mensagemPublica && <p>{evento.mensagemPublica}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="public-tracking-history__empty">
                  As atualizações públicas aparecerão aqui.
                </div>
              )}
            </section>

            {erroAtualizacao && (
              <div className="public-tracking-refresh-error" role="alert">
                <WarningIcon />
                <span>{erroAtualizacao}</span>
              </div>
            )}

            <section className="public-tracking-refresh" aria-live="polite">
              <span>
                {ultimaAtualizacao
                  ? `Consultado às ${ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Aguardando atualização'}
              </span>
              <button
                type="button"
                disabled={atualizando}
                onClick={atualizarAgora}
              >
                <RefreshIcon />
                {atualizando ? 'Atualizando...' : 'Atualizar agora'}
              </button>
            </section>

            <footer className="public-tracking-contact">
              <strong>{ordem.empresa.nome}</strong>
              <span>
                {[ordem.empresa.telefone, ordem.empresa.email]
                  .filter(Boolean)
                  .join(' · ') || 'Entre em contato diretamente com a empresa em caso de dúvidas.'}
              </span>
              <small>Este link mostra somente informações públicas do seu atendimento.</small>
            </footer>
          </article>
        )}
      </div>
    </AuthLayout>
  )
}

function ServiceTimeline({ status }: { status: StatusOrdem }) {
  const posicaoAtual = POSICAO_STATUS[status]

  return (
    <ol className="public-tracking-timeline" aria-label="Etapas do serviço">
      {ETAPAS_PRINCIPAIS.map((etapa, indice) => {
        const concluida = indice < posicaoAtual || status === 'ENTREGUE'
        const atual = indice === posicaoAtual && status !== 'ENTREGUE'
        const entregue = status === 'ENTREGUE' && etapa.status === 'ENTREGUE'

        return (
          <li
            className={[
              concluida ? 'is-complete' : '',
              atual || entregue ? 'is-current' : '',
            ].filter(Boolean).join(' ')}
            key={etapa.status}
            aria-current={atual || entregue ? 'step' : undefined}
          >
            <span className="public-tracking-timeline__marker">
              {concluida || entregue ? <CheckIcon /> : <i />}
            </span>
            <div>
              <strong>{etapa.titulo}</strong>
              <small>{etapa.descricao}</small>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function PaymentSummary({ ordem }: { ordem: OrdemAcompanhamentoPublico }) {
  const { pagamento } = ordem

  return (
    <section className="public-tracking-payment" aria-labelledby="public-tracking-payment-title">
      <div className="public-tracking-section-heading">
        <div>
          <span><WalletIcon /></span>
          <div>
            <h2 id="public-tracking-payment-title">Resumo do pagamento</h2>
            <p>Acompanhe somente a situação financeira desta ordem.</p>
          </div>
        </div>
        <span className={`public-tracking-payment-status public-tracking-payment-status--${pagamento.status.toLowerCase()}`}>
          <i /> {PAGAMENTO_LABELS[pagamento.status]}
        </span>
      </div>

      <div className="public-tracking-payment__values">
        <div><span>Valor total</span><strong>{formatarMoeda(pagamento.valorTotal)}</strong></div>
        <div><span>Total pago</span><strong>{formatarMoeda(pagamento.totalPago)}</strong></div>
        <div><span>Saldo</span><strong>{formatarMoeda(pagamento.saldo)}</strong></div>
      </div>
    </section>
  )
}

function InfoCard({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: ReactNode
  label: string
  value: string
  tone?: 'default' | 'success'
}) {
  return (
    <article className={`public-tracking-info public-tracking-info--${tone}`}>
      <span>{icon}</span>
      <div><small>{label}</small><strong>{value}</strong></div>
    </article>
  )
}

function StatusBadge({ status, label }: { status: StatusOrdem; label: string }) {
  return (
    <span className={`public-tracking-status public-tracking-status--${status.toLowerCase()}`}>
      <i /> {label}
    </span>
  )
}

function FeedbackState({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <section className="public-tracking-feedback" role="alert">
      <div><WarningIcon /></div>
      <h1>{title}</h1>
      <p>{message}</p>
      {action}
    </section>
  )
}

function TrackingSkeleton() {
  return (
    <div
      className="public-tracking-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Carregando acompanhamento"
    >
      <p className="sr-only">Carregando os dados do acompanhamento.</p>
      <span />
      <div />
      <div />
      <div />
    </div>
  )
}

function obterMensagemErro(error: unknown) {
  if (error instanceof AcompanhamentoPublicoApiError && error.status === 404) {
    return 'Esta ordem de serviço não foi encontrada ou o link não está mais disponível.'
  }

  if (error instanceof AcompanhamentoPublicoApiError && error.status === 429) {
    return 'Muitas consultas foram realizadas em pouco tempo. Aguarde um momento e tente novamente.'
  }

  return error instanceof Error && error.message
    ? error.message
    : 'Não foi possível carregar o acompanhamento da ordem.'
}

function formatarNumeroOrdem(numero: number) {
  return `#${String(numero).padStart(4, '0')}`
}

function formatarMoeda(valor: string) {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return 'Valor não informado'

  return numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatarPrevisao(valor: string | null) {
  if (!valor) return 'A definir'

  const data = /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T12:00:00`)
    : new Date(valor)

  if (Number.isNaN(data.getTime())) return 'A definir'

  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatarDataHora(valor: string) {
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'Data não informada'

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DeviceIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
}

function CalendarIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
}

function ReceiptIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6M9 12h6" /></svg>
}

function RouteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path d="M8.5 16.5 16 8" /></svg>
}

function HistoryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
}

function WalletIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v13H6a2 2 0 0 1-2-2V6.5Z" /><path d="M4 8h16M15 12h6v4h-6a2 2 0 0 1 0-4Z" /></svg>
}

function PackageIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5M3 8v9l9 5 9-5V8M12 13v9" /></svg>
}

function WarningIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5M12 18h.01" /></svg>
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M7 7a7 7 0 0 1 11.5 2M17 17A7 7 0 0 1 5.5 15" /></svg>
}
