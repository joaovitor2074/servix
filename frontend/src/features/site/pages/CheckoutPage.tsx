import { useEffect, useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router'
import {
  buscarCheckout,
  confirmarCheckout,
} from '../site.service'
import {
  formatarMoeda,
  SITE_LEGAL_IDENTITY_PENDING_MESSAGE,
  SITE_LEGAL_IDENTITY_READY,
} from '../site-data'
import type { CheckoutData } from '../site.types'
import { useCatalogoAssinaturas } from '../use-catalogo-assinaturas'

export default function CheckoutPage() {
  const { token = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { catalogo, erroCatalogo, carregandoCatalogo } = useCatalogoAssinaturas()
  const dadosIniciais =
    (location.state as CheckoutData | null) ?? null
  const [dados, setDados] =
    useState<CheckoutData | null>(dadosIniciais)
  const [carregando, setCarregando] = useState(!dadosIniciais)
  const [emailPagador, setEmailPagador] = useState('')
  const [aceiteCheckout, setAceiteCheckout] = useState(false)
  const [redirecionando, setRedirecionando] = useState(false)
  const [erroCarregamento, setErroCarregamento] = useState('')
  const [erroPagamento, setErroPagamento] = useState('')
  const [erroAceite, setErroAceite] = useState('')

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()

    async function carregarCheckout() {
      try {
        const checkout = await buscarCheckout(token, controller.signal)
        setDados(checkout)
        setErroCarregamento('')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setErroCarregamento(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o checkout.',
        )
      } finally {
        if (!controller.signal.aborted) setCarregando(false)
      }
    }

    void carregarCheckout()
    return () => controller.abort()
  }, [token])

  async function iniciarCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (redirecionando) return

    setErroPagamento('')
    setErroAceite('')

    const emailNormalizado = emailPagador.trim().toLowerCase()
    const modoTeste = dados?.assinatura.ambiente !== 'PRODUCAO'

    if (!modoTeste && !SITE_LEGAL_IDENTITY_READY) {
      setErroPagamento(SITE_LEGAL_IDENTITY_PENDING_MESSAGE)
      return
    }

    if (!catalogo?.checkoutDisponivel || !catalogo.versaoTermos) {
      setErroPagamento(
        erroCatalogo ||
          'Não foi possível confirmar a versão atual dos Termos. Recarregue a página.',
      )
      return
    }
    if (
      !emailValido(emailNormalizado) ||
      (modoTeste && (
        !emailNormalizado.endsWith('@testuser.com') ||
        emailNormalizado === 'test@testuser.com'
      ))
    ) {
      setErroPagamento(
        modoTeste
          ? 'Use o e-mail exato da conta Comprador exibida em Contas de teste. O endereço test@testuser.com não serve para Assinaturas.'
          : 'Informe um e-mail válido para o responsável pelo pagamento.',
      )
      return
    }

    if (!aceiteCheckout) {
      setErroAceite(
        modoTeste
          ? 'Confirme que entendeu o ambiente de teste.'
          : 'Confirme a assinatura mensal antes de continuar.',
      )
      return
    }

    setRedirecionando(true)

    try {
      const resultado = await confirmarCheckout(token, {
        emailPagador: emailNormalizado,
        versaoTermos: catalogo.versaoTermos,
        aceiteModoTeste: modoTeste,
      })

      if (resultado.status === 'ATIVA') {
        navigate(
          `/cadastro/concluido?checkout=${encodeURIComponent(token)}`,
          { replace: true },
        )
        return
      }

      if (!checkoutUrlValida(resultado.checkoutUrl)) {
        throw new Error('O Mercado Pago retornou um endereço inválido.')
      }

      window.location.assign(resultado.checkoutUrl)
    } catch (error) {
      setErroPagamento(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir o checkout seguro.',
      )
      setRedirecionando(false)
    }
  }

  if (!token) {
    return <CheckoutError message="O link de checkout é inválido." />
  }

  if (carregando && !dados) {
    return (
      <section className="checkout-page">
        <div
          className="site-container checkout-loading"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="loading-spinner" aria-hidden="true" />
          <h1>Preparando seu checkout seguro...</h1>
        </div>
      </section>
    )
  }

  if (!dados) {
    return (
      <CheckoutError
        message={
          erroCarregamento || 'Este checkout não está disponível.'
        }
      />
    )
  }

  const modoTeste = dados.assinatura.ambiente === 'TESTE'
  const identidadeLegalBloqueiaProducao =
    !modoTeste && !SITE_LEGAL_IDENTITY_READY

  return (
    <section className="checkout-page">
      <div className="site-container checkout-page__header">
        <p className="eyebrow">Última etapa</p>
        <h1>Continue no ambiente seguro do Mercado Pago.</h1>
        <p>
          O pagamento será preenchido no site do Mercado Pago. O Servix não
          receberá nem armazenará os dados do cartão.
        </p>
      </div>

      <div className="site-container checkout-layout">
        <article className="checkout-card">
          <div className="test-banner" role="status">
            <span>{modoTeste ? 'TESTE' : 'PRODUÇÃO'}</span>
            <div>
              <strong>{modoTeste ? 'Ambiente sem cobrança real' : 'Assinatura com cobrança real'}</strong>
              <p>{modoTeste
                ? 'Use exclusivamente uma conta compradora de teste.'
                : `O Mercado Pago apresentará a cobrança recorrente de ${formatarMoeda(dados.assinatura.valorMensal)} por mês.`}</p>
            </div>
          </div>

          <div className="checkout-card__section">
            <span className="checkout-card__label">Empresa</span>
            <h2>{dados.empresa.nome}</h2>
            <p>{dados.empresa.email || `${dados.empresa.slug}.servix`}</p>
          </div>

          <div className="checkout-card__section checkout-card__plan">
            <div>
              <span className="checkout-card__label">Plano selecionado</span>
              <h2>{dados.assinatura.planoNome}</h2>
              <p>Código: {dados.assinatura.planoCodigo}</p>
            </div>
            <div className="checkout-card__price">
              <strong>{formatarMoeda(dados.assinatura.valorMensal)}</strong>
              <span>/mês</span>
            </div>
          </div>

          <dl className="checkout-details">
            <div><dt>Ambiente</dt><dd>{dados.assinatura.ambiente}</dd></div>
            <div>
              <dt>Status atual</dt>
              <dd>{formatarStatus(dados.assinatura.status)}</dd>
            </div>
            <div>
              <dt>Cobrança real</dt>
              <dd>{modoTeste ? 'Não' : `${formatarMoeda(dados.assinatura.valorMensal)}/mês`}</dd>
            </div>
          </dl>

          <form className="checkout-payment-form" onSubmit={iniciarCheckout} noValidate>
            <div className="signup-field signup-field--full">
              <label htmlFor="emailPagador">
                {modoTeste ? 'E-mail do comprador de teste' : 'E-mail do pagador'}
              </label>
              <input
                id="emailPagador"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={emailPagador}
                onChange={event => {
                  setEmailPagador(event.target.value)
                  setErroPagamento('')
                }}
                placeholder={modoTeste ? 'test_user_...@testuser.com' : 'pagador@empresa.com.br'}
                disabled={redirecionando}
                required
              />
              <small>{modoTeste
                ? 'Use uma conta compradora de teste diferente do vendedor.'
                : 'Este e-mail será vinculado à assinatura no Mercado Pago.'}</small>
            </div>

            <div className="checkbox-field checkbox-field--boxed">
              <label>
                <input
                  id="aceiteCheckout"
                  type="checkbox"
                  checked={aceiteCheckout}
                  onChange={event => {
                    setAceiteCheckout(event.target.checked)
                    setErroAceite('')
                  }}
                  disabled={redirecionando}
                  aria-invalid={Boolean(erroAceite)}
                  aria-describedby={
                    erroAceite
                      ? 'aceiteCheckout-error'
                      : 'aceiteCheckout-hint'
                  }
                />
                <span>
                  {modoTeste
                    ? 'Confirmo que este é um ambiente de teste e que não usarei dados financeiros reais.'
                    : `Confirmo a assinatura recorrente de ${formatarMoeda(dados.assinatura.valorMensal)} por mês e li os Termos de Uso e a Política de Privacidade.`}
                </span>
              </label>
              <small id="aceiteCheckout-hint">
                Você será redirecionado ao Mercado Pago para continuar.
              </small>
              {erroAceite && (
                <span id="aceiteCheckout-error" className="field-error" role="alert">
                  {erroAceite}
                </span>
              )}
            </div>

            {erroPagamento && <p className="form-alert" role="alert">{erroPagamento}</p>}
            {erroCatalogo && <p className="form-alert" role="alert">{erroCatalogo}</p>}
            {identidadeLegalBloqueiaProducao && (
              <p className="form-alert" role="alert">
                {SITE_LEGAL_IDENTITY_PENDING_MESSAGE}
              </p>
            )}

            <button
              type="submit"
              className="button button--primary button--large button--full"
              disabled={
                !aceiteCheckout ||
                redirecionando ||
                carregandoCatalogo ||
                !catalogo?.checkoutDisponivel ||
                identidadeLegalBloqueiaProducao
              }
              aria-busy={redirecionando}
            >
              {redirecionando
                ? 'Abrindo Mercado Pago...'
                : 'Continuar no Mercado Pago'}
            </button>
          </form>

          <p className="checkout-card__legal">
            A empresa continuará pendente até o Mercado Pago confirmar a
            assinatura ao servidor.
          </p>
        </article>

        <aside className="checkout-aside">
          <h2>Pagamentos continuam separados</h2>
          <div><span>Assinatura</span><strong>Empresa → Servix</strong></div>
          <div><span>Orçamento</span><strong>Cliente → conta da empresa</strong></div>
          <p>
            O checkout da assinatura não utiliza a autorização OAuth que a
            empresa configura para cobrar seus próprios clientes.
          </p>
          <Link to="/planos" className="text-link">Voltar aos planos</Link>
        </aside>
      </div>
    </section>
  )
}

function CheckoutError({ message }: { message: string }) {
  return (
    <section className="state-page">
      <div className="site-container state-card">
        <span className="state-card__code">Checkout indisponível</span>
        <h1>Não foi possível continuar.</h1>
        <p role="alert">{message}</p>
        <div className="state-card__actions">
          <Link to="/cadastro" className="button button--primary">
            Recomeçar cadastro
          </Link>
          <Link to="/suporte" className="button button--secondary">
            Pedir ajuda
          </Link>
        </div>
      </div>
    </section>
  )
}

function formatarStatus(status: string) {
  return status.replaceAll('_', ' ').toLocaleLowerCase('pt-BR')
}

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function checkoutUrlValida(valor: string) {
  try {
    const url = new URL(valor)
    return (
      url.protocol === 'https:' &&
      /(^|\.)mercadopago\.com(?:\.[a-z]{2})?$/i.test(url.hostname)
    )
  } catch {
    return false
  }
}
