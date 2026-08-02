import { useEffect, useState } from 'react'
import {
  buscarPainelAssinatura,
  cancelarAssinaturaAtual,
  reprocessarWebhookAssinatura,
  sincronizarAssinaturaAtual,
} from '../services/subscription-settings.service'
import type {
  AssinaturaAtual,
  EventoWebhookAssinatura,
  HistoricoAssinatura,
  StatusAssinatura,
} from '../types/subscription-settings.types'
import './SubscriptionSettingsPage.css'

const ROTULOS_STATUS: Record<StatusAssinatura, string> = {
  PENDENTE: 'Pendente',
  ATIVA: 'Ativa',
  PAUSADA: 'Pausada',
  INADIMPLENTE: 'Pagamento pendente',
  CANCELADA: 'Cancelada',
}

export default function SubscriptionSettingsPage() {
  const [assinatura, setAssinatura] = useState<AssinaturaAtual | null>(null)
  const [historico, setHistorico] = useState<HistoricoAssinatura[]>([])
  const [webhooks, setWebhooks] = useState<EventoWebhookAssinatura[]>([])
  const [falhasWebhook, setFalhasWebhook] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    void buscarPainelAssinatura(controller.signal)
      .then(resultado => {
        setAssinatura(resultado.assinatura)
        setHistorico(resultado.historico)
        setWebhooks(resultado.webhooks)
        setFalhasWebhook(resultado.monitoramento.falhasPendentes)
        setErro('')
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErro(mensagemErro(error, 'Não foi possível carregar a assinatura.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false)
      })

    return () => controller.abort()
  }, [tentativa])

  function handleTentarNovamente() {
    setCarregando(true)
    setErro('')
    setTentativa(valor => valor + 1)
  }

  async function handleSincronizar() {
    setProcessando('SINCRONIZAR')
    setErro('')
    setMensagem('')

    try {
      const atualizada = await sincronizarAssinaturaAtual()
      setAssinatura(atualizada)
      setMensagem('Status confirmado diretamente com o Mercado Pago.')
      setTentativa(valor => valor + 1)
    } catch (error) {
      setErro(mensagemErro(error, 'Não foi possível sincronizar a assinatura.'))
    } finally {
      setProcessando(null)
    }
  }

  async function handleReprocessarWebhook(eventoId: number) {
    setProcessando(`WEBHOOK_${eventoId}`)
    setErro('')
    setMensagem('')
    try {
      await reprocessarWebhookAssinatura(eventoId)
      setMensagem('Notificação reenviada para processamento.')
      setTentativa(valor => valor + 1)
    } catch (error) {
      setErro(mensagemErro(error, 'Não foi possível reprocessar a notificação.'))
    } finally {
      setProcessando(null)
    }
  }

  async function handleCancelar() {
    setProcessando('CANCELAR')
    setErro('')

    try {
      await cancelarAssinaturaAtual()
      window.location.replace('/assinatura-suspensa')
    } catch (error) {
      setErro(mensagemErro(error, 'Não foi possível cancelar a assinatura.'))
      setConfirmandoCancelamento(false)
      setProcessando(null)
    }
  }

  if (carregando) return <SubscriptionSettingsSkeleton />

  const testeGratisAtivo = Boolean(
    assinatura?.testeGratisExpiraEm &&
    !assinatura.mercadoPagoAssinaturaId,
  )

  return (
    <div className="subscription-settings">
      <header className="subscription-settings__header">
        <div>
          <span>Conta Servix</span>
          <h1>Assinatura</h1>
          <p>{testeGratisAtivo
            ? 'Acompanhe o prazo do teste. Nenhuma cobrança ou assinatura foi criada.'
            : 'Consulte a recorrência da empresa e recupere atualizações do Mercado Pago.'}</p>
        </div>
        {assinatura && <StatusBadge status={assinatura.status} testeGratis={testeGratisAtivo} />}
      </header>

      {erro && (
        <div className="subscription-settings__feedback subscription-settings__feedback--error" role="alert">
          <span>{erro}</span>
          {!assinatura && (
            <button type="button" onClick={handleTentarNovamente}>
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {mensagem && (
        <div className="subscription-settings__feedback subscription-settings__feedback--success" role="status">
          {mensagem}
        </div>
      )}

      {!assinatura ? (
        <section className="subscription-settings__empty">
          <h2>Nenhuma assinatura encontrada</h2>
          <p>Entre em contato com o suporte para revisar o cadastro desta empresa.</p>
        </section>
      ) : (
        <>
          <section className="subscription-summary-card">
            <div className="subscription-summary-card__main">
              <span className="subscription-summary-card__eyebrow">
                {testeGratisAtivo ? 'Teste gratuito' : 'Plano atual'}
              </span>
              <h2>{assinatura.planoNome}</h2>
              <strong>{formatarMoeda(assinatura.valorMensal)}<small>/mês</small></strong>
              <span className="subscription-summary-card__environment">
                {testeGratisAtivo
                  ? 'Sem cartão e sem renovação automática'
                  : `Ambiente ${assinatura.ambiente === 'TESTE' ? 'de teste' : 'de produção'}`}
              </span>
            </div>

            <dl className="subscription-summary-card__details">
              <div>
                <dt>{testeGratisAtivo ? 'Teste termina em' : 'Próxima cobrança'}</dt>
                <dd>{formatarData(
                  testeGratisAtivo ? assinatura.testeGratisExpiraEm : assinatura.proximaCobrancaEm,
                  'Não informada',
                )}</dd>
              </div>
              <div>
                <dt>{testeGratisAtivo ? 'Teste iniciado em' : 'Ativada em'}</dt>
                <dd>{formatarData(
                  testeGratisAtivo ? assinatura.testeGratisIniciadoEm : assinatura.ativadaEm,
                  testeGratisAtivo ? 'Não informada' : 'Aguardando ativação',
                )}</dd>
              </div>
              <div>
                <dt>{testeGratisAtivo ? 'E-mail da conta' : 'E-mail pagador'}</dt>
                <dd>{assinatura.emailPagador || 'Não informado'}</dd>
              </div>
              <div>
                <dt>{testeGratisAtivo ? 'Cobrança' : 'Identificador'}</dt>
                <dd className="subscription-summary-card__identifier">
                  {testeGratisAtivo
                    ? 'Nenhuma cobrança criada'
                    : assinatura.mercadoPagoAssinaturaId || 'Ainda não criado'}
                </dd>
              </div>
            </dl>
          </section>

          {!testeGratisAtivo && <>
          <section className="subscription-monitor-card">
            <div className="subscription-monitor-card__header">
              <div>
                <span>Monitoramento e recuperação</span>
                <h2>Sincronização com Mercado Pago</h2>
              </div>
              <span className={`subscription-monitor-card__signal${assinatura.ultimaSincronizacaoEm ? ' is-online' : ''}`}>
                {assinatura.ultimaSincronizacaoEm ? 'Monitorado' : 'Aguardando'}
              </span>
            </div>

            <p>
              Os webhooks atualizam o status automaticamente. Se uma notificação atrasar ou falhar,
              a sincronização manual consulta a fonte oficial e recupera o estado atual.
            </p>

            <div className="subscription-monitor-card__footer">
              <div>
                <span>Última confirmação</span>
                <strong>{formatarDataHora(assinatura.ultimaSincronizacaoEm)}</strong>
              </div>
              <button
                type="button"
                onClick={() => void handleSincronizar()}
                disabled={Boolean(processando) || assinatura.status === 'CANCELADA'}
              >
                {processando === 'SINCRONIZAR' ? 'Sincronizando...' : 'Sincronizar agora'}
              </button>
            </div>
          </section>

          <section className="subscription-audit-card">
            <div className="subscription-audit-card__header">
              <div>
                <span>Webhooks</span>
                <h2>Notificações do Mercado Pago</h2>
              </div>
              <strong className={falhasWebhook ? 'has-failures' : ''}>
                {falhasWebhook ? `${falhasWebhook} falha(s)` : 'Tudo processado'}
              </strong>
            </div>
            {webhooks.length ? (
              <div className="subscription-audit-list">
                {webhooks.map(evento => (
                  <article key={evento.id}>
                    <div>
                      <strong>{rotuloWebhook(evento.tipo)}</strong>
                      <span>{formatarDataHora(evento.recebidoEm)} · {evento.tentativas} tentativa(s)</span>
                      {evento.ultimoErro && <small>{evento.ultimoErro}</small>}
                    </div>
                    <div className="subscription-audit-list__status">
                      <span data-status={evento.status}>{evento.status}</span>
                      {evento.status === 'FALHA' && (
                        <button
                          type="button"
                          onClick={() => void handleReprocessarWebhook(evento.id)}
                          disabled={Boolean(processando)}
                        >
                          {processando === `WEBHOOK_${evento.id}` ? 'Processando...' : 'Reprocessar'}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="subscription-audit-card__empty">Nenhuma notificação registrada ainda.</p>}
          </section>

          <section className="subscription-audit-card">
            <div className="subscription-audit-card__header">
              <div>
                <span>Histórico administrativo</span>
                <h2>Ciclo da assinatura</h2>
              </div>
            </div>
            {historico.length ? (
              <div className="subscription-history-list">
                {historico.map(item => (
                  <article key={item.id}>
                    <i aria-hidden="true" />
                    <div>
                      <strong>{rotuloHistorico(item.tipo)}</strong>
                      <span>{formatarDataHora(item.criadoEm)} · {rotuloOrigem(item.origem)}</span>
                      <small>
                        {item.statusAnterior ? `${item.statusAnterior} -> ` : ''}{item.statusNovo}
                        {item.mercadoPagoAssinaturaId ? ` · Assinatura ${item.mercadoPagoAssinaturaId}` : ''}
                        {item.requestIdProvedor ? ` · Request ${item.requestIdProvedor}` : ''}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="subscription-audit-card__empty">O histórico começa na próxima atualização da assinatura.</p>}
          </section>

          <section className="subscription-danger-card">
            <div>
              <span>Zona de atenção</span>
              <h2>Cancelar assinatura</h2>
              <p>Interrompe as próximas cobranças e suspende imediatamente o acesso da empresa.</p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmandoCancelamento(true)}
              disabled={Boolean(processando) || assinatura.status !== 'ATIVA'}
            >
              Cancelar assinatura
            </button>
          </section>
          </>}
        </>
      )}

      {confirmandoCancelamento && assinatura && (
        <div className="subscription-dialog-backdrop" role="presentation">
          <section
            className="subscription-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-subscription-title"
            aria-describedby="cancel-subscription-description"
            onKeyDown={event => {
              if (event.key === 'Escape' && processando !== 'CANCELAR') {
                setConfirmandoCancelamento(false)
              }
            }}
          >
            <span>Confirmação necessária</span>
            <h2 id="cancel-subscription-title">Cancelar a assinatura do Servix?</h2>
            <p id="cancel-subscription-description">
              O Mercado Pago deixará de realizar novas cobranças. A sessão será encerrada e
              a empresa perderá acesso ao sistema imediatamente. Essa ação não pode ser desfeita.
            </p>
            <div className="subscription-dialog__actions">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmandoCancelamento(false)}
                disabled={processando === 'CANCELAR'}
              >
                Voltar
              </button>
              <button
                className="is-danger"
                type="button"
                onClick={() => void handleCancelar()}
                disabled={processando === 'CANCELAR'}
              >
                {processando === 'CANCELAR' ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function StatusBadge({
  status,
  testeGratis,
}: {
  status: StatusAssinatura
  testeGratis: boolean
}) {
  const tone = status === 'ATIVA'
    ? 'active'
    : status === 'INADIMPLENTE' || status === 'PENDENTE'
      ? 'warning'
      : 'inactive'

  return (
    <span className={`subscription-status subscription-status--${tone}`}>
      <i aria-hidden="true" />
      {testeGratis ? 'Teste gratuito' : ROTULOS_STATUS[status]}
    </span>
  )
}

function SubscriptionSettingsSkeleton() {
  return (
    <div className="subscription-settings subscription-settings--loading" aria-busy="true">
      <div />
      <div />
      <div />
    </div>
  )
}

function formatarMoeda(valor: number | string) {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(numero) ? numero : 0)
}

function formatarData(valor: string | null | undefined, fallback: string) {
  if (!valor) return fallback
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return fallback
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(data)
}

function formatarDataHora(valor: string | null | undefined) {
  if (!valor) return 'Ainda não sincronizada'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'Data indisponível'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(data)
}

function mensagemErro(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function rotuloWebhook(tipo: string) {
  return tipo === 'subscription_preapproval'
    ? 'Atualizacao da assinatura'
    : tipo === 'subscription_authorized_payment'
      ? 'Pagamento autorizado'
      : tipo
}

function rotuloHistorico(tipo: HistoricoAssinatura['tipo']) {
  return ({
    ATIVADA: 'Assinatura ativada',
    SINCRONIZADA: 'Assinatura sincronizada',
    CANCELADA: 'Assinatura cancelada',
    REATIVACAO_SOLICITADA: 'Reativação solicitada',
    REATIVADA: 'Assinatura reativada',
    INADIMPLENCIA_DETECTADA: 'Pagamento pendente detectado',
  } as const)[tipo]
}

function rotuloOrigem(origem: HistoricoAssinatura['origem']) {
  return ({
    CHECKOUT: 'Checkout',
    WEBHOOK: 'Webhook',
    SINCRONIZACAO_MANUAL: 'Sincronização manual',
    CANCELAMENTO_ADMIN: 'Administrador',
    REATIVACAO_ADMIN: 'Administrador',
  } as const)[origem]
}
