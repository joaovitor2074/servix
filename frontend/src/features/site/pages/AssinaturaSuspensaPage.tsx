import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { buscarUsuarioAtual } from '../../auth/services/auth.service'
import type { UsuarioAutenticado } from '../../auth/types/auth.types'
import {
  buscarPortalAssinatura,
  iniciarReativacaoAssinatura,
  sincronizarRecuperacaoAssinatura,
  type PortalAssinatura,
} from '../subscription-recovery.service'
import './AssinaturaSuspensaPage.css'

interface AssinaturaSuspensaPageProps {
  usuario: UsuarioAutenticado | null
  onUsuarioAtualizado: (usuario: UsuarioAutenticado) => void
  onLogout: () => void
}

export default function AssinaturaSuspensaPage({
  usuario,
  onUsuarioAtualizado,
  onLogout,
}: AssinaturaSuspensaPageProps) {
  const navigate = useNavigate()
  const [portal, setPortal] = useState<PortalAssinatura | null>(null)
  const [carregando, setCarregando] = useState(Boolean(usuario))
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async (signal?: AbortSignal) => {
    if (!usuario || usuario.papel !== 'ADMIN') return
    try {
      const resultado = await buscarPortalAssinatura(signal)
      setPortal(resultado)
      setErro('')

      if (resultado.statusEmpresa === 'ATIVA') {
        const atualizado = await buscarUsuarioAtual()
        onUsuarioAtualizado(atualizado)
        navigate('/dashboard', { replace: true })
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setErro(error instanceof Error ? error.message : 'Não foi possível carregar a assinatura.')
    } finally {
      setCarregando(false)
    }
  }, [navigate, onUsuarioAtualizado, usuario])

  useEffect(() => {
    const controller = new AbortController()
    const inicial = window.setTimeout(() => void carregar(controller.signal), 0)

    const aguardandoWebhook = portal?.assinatura?.status === 'PENDENTE'
    const timer = aguardandoWebhook
      ? window.setInterval(() => void carregar(), 5_000)
      : null

    return () => {
      controller.abort()
      window.clearTimeout(inicial)
      if (timer) window.clearInterval(timer)
    }
  }, [carregar, portal?.assinatura?.status])

  if (usuario?.empresa.status === 'ATIVA') {
    return <Navigate to="/dashboard" replace />
  }

  if (!usuario) {
    return (
      <section className="state-page">
        <div className="site-container state-card">
          <span className="state-card__code">Assinatura não ativa</span>
          <h1>Entre como administrador para recuperar a assinatura.</h1>
          <p>O acesso aos dados internos continua bloqueado durante todo o processo.</p>
          <div className="state-card__actions">
            <Link to="/login" className="button button--primary">Entrar</Link>
            <Link to="/suporte" className="button button--secondary">Falar com o suporte</Link>
          </div>
        </div>
      </section>
    )
  }

  if (usuario.papel !== 'ADMIN') {
    return (
      <section className="state-page">
        <div className="site-container state-card">
          <span className="state-card__code">Acesso restrito</span>
          <h1>Somente o administrador pode recuperar a assinatura.</h1>
          <p>Saia desta conta e entre com o usuário administrador da empresa.</p>
          <div className="state-card__actions">
            <button type="button" className="button button--primary" onClick={onLogout}>Sair</button>
            <Link to="/suporte" className="button button--secondary">Falar com o suporte</Link>
          </div>
        </div>
      </section>
    )
  }

  async function handleReativar(gerarNovoCheckout = false) {
    setProcessando(true)
    setErro('')
    try {
      const resultado = await iniciarReativacaoAssinatura(gerarNovoCheckout)
      if (!resultado.checkoutUrl) throw new Error('O checkout não foi retornado.')
      window.location.assign(resultado.checkoutUrl)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível iniciar a reativação.')
      setProcessando(false)
    }
  }

  async function handleSincronizar() {
    setProcessando(true)
    setErro('')
    try {
      const resultado = await sincronizarRecuperacaoAssinatura()
      if (resultado.assinatura?.status === 'ATIVA') {
        const atualizado = await buscarUsuarioAtual()
        onUsuarioAtualizado(atualizado)
        navigate('/dashboard', { replace: true })
        return
      }
      await carregar()
      setErro('O Mercado Pago ainda não confirmou a assinatura. Aguarde alguns segundos e tente novamente.')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível verificar a assinatura.')
    } finally {
      setProcessando(false)
    }
  }

  const assinatura = portal?.assinatura
  const aguardando = assinatura?.status === 'PENDENTE'
  const podeReativar = assinatura?.status === 'CANCELADA'

  return (
    <section className="subscription-recovery-page">
      <div className="site-container subscription-recovery">
        <header className="subscription-recovery__header">
          <div>
            <span>Portal de assinatura</span>
            <h1>Acesso protegido enquanto a assinatura não está ativa.</h1>
            <p>Os dados operacionais permanecem bloqueados. A liberação acontece somente depois da confirmação do webhook do Mercado Pago.</p>
          </div>
          <button type="button" onClick={onLogout}>Sair da conta</button>
        </header>

        {erro && <div className="subscription-recovery__alert" role="alert">{erro}</div>}

        {carregando ? (
          <div className="subscription-recovery__loading" role="status">Carregando assinatura...</div>
        ) : !assinatura ? (
          <div className="subscription-recovery__panel">
            <h2>Assinatura não encontrada</h2>
            <p>Fale com o suporte para revisar o cadastro da empresa.</p>
          </div>
        ) : (
          <div className="subscription-recovery__grid">
            <section className="subscription-recovery__panel">
              <span className={`recovery-status recovery-status--${assinatura.status.toLowerCase()}`}>
                {rotuloStatus(assinatura.status)}
              </span>
              <h2>{assinatura.planoNome}</h2>
              <strong className="subscription-recovery__price">{formatarMoeda(assinatura.valorMensal)}<small>/mês</small></strong>
              <dl>
                <div><dt>Situação</dt><dd>{rotuloStatus(assinatura.status)}</dd></div>
                <div><dt>Cancelada em</dt><dd>{formatarData(assinatura.canceladaEm, 'Não informada')}</dd></div>
                <div><dt>Ambiente</dt><dd>{assinatura.ambiente === 'TESTE' ? 'Teste' : 'Produção'}</dd></div>
              </dl>
            </section>

            <section className="subscription-recovery__panel subscription-recovery__action">
              <span>Recuperação segura</span>
              <h2>{aguardando ? 'Aguardando confirmação' : 'Crie uma nova assinatura'}</h2>
              <p>
                {aguardando
                  ? 'Se você já concluiu o checkout, mantenha esta página aberta. Verificaremos a confirmação automaticamente.'
                  : 'Como a assinatura anterior foi cancelada, o Mercado Pago exige um novo checkout.'}
              </p>

              {aguardando && assinatura.checkoutUrl ? (
                <>
                  <a className="button button--primary" href={assinatura.checkoutUrl}>Continuar no Mercado Pago</a>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => void handleReativar(true)}
                    disabled={processando}
                  >
                    {processando ? 'Gerando novo checkout...' : 'Gerar novo checkout'}
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => void handleSincronizar()}
                    disabled={processando}
                  >
                    {processando ? 'Verificando...' : 'Já concluí, verificar agora'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => void handleReativar()}
                  disabled={!podeReativar || processando}
                >
                  {processando ? 'Gerando checkout...' : 'Reativar assinatura'}
                </button>
              )}
              {aguardando && <small className="subscription-recovery__polling">Verificando o webhook a cada 5 segundos...</small>}
              <Link to="/suporte" className="text-link">Preciso de ajuda</Link>
            </section>
          </div>
        )}
      </div>
    </section>
  )
}

function rotuloStatus(status: string) {
  return ({
    PENDENTE: 'Aguardando confirmação',
    ATIVA: 'Ativa',
    PAUSADA: 'Pausada',
    INADIMPLENTE: 'Pagamento pendente',
    CANCELADA: 'Cancelada',
  } as Record<string, string>)[status] ?? status
}

function formatarMoeda(valor: number | string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(valor))
}

function formatarData(valor: string | null | undefined, fallback: string) {
  if (!valor) return fallback
  const data = new Date(valor)
  return Number.isNaN(data.getTime())
    ? fallback
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(data)
}
