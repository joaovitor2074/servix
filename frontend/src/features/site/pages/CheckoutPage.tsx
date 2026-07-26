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
import { formatarMoeda } from '../site-data'
import type { CheckoutData } from '../site.types'

const VERSAO_TERMOS = '2026-07-25'

export default function CheckoutPage() {
  const { token = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const dadosIniciais =
    (location.state as CheckoutData | null) ?? null
  const [dados, setDados] =
    useState<CheckoutData | null>(dadosIniciais)
  const [carregando, setCarregando] = useState(!dadosIniciais)
  const [emailPagador, setEmailPagador] = useState('')
  const [aceiteModoTeste, setAceiteModoTeste] = useState(false)
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
    if (
      !emailValido(emailNormalizado) ||
      emailNormalizado === 'test@testuser.com'
    ) {
      setErroPagamento(
        'Use o e-mail exato da conta Comprador exibida em Contas de teste. O endereço test@testuser.com não serve para Assinaturas.',
      )
      return
    }

    if (!aceiteModoTeste) {
      setErroAceite('Confirme que entendeu o ambiente de teste.')
      return
    }

    setRedirecionando(true)

    try {
      const resultado = await confirmarCheckout(token, {
        emailPagador: emailNormalizado,
        versaoTermos: VERSAO_TERMOS,
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
          <h1>Preparando seu checkout de teste...</h1>
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
            <span>TESTE</span>
            <div>
              <strong>Ambiente sem cobrança real</strong>
              <p>Use exclusivamente uma conta compradora de teste.</p>
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
            <div><dt>Cobrança real agora</dt><dd>R$ 0,00</dd></div>
          </dl>

          <form className="checkout-payment-form" onSubmit={iniciarCheckout} noValidate>
            <div className="signup-field signup-field--full">
              <label htmlFor="emailPagador">E-mail do comprador de teste</label>
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
                placeholder="test_user_...@testuser.com"
                disabled={redirecionando}
                required
              />
              <small>Use uma conta compradora de teste diferente do vendedor.</small>
            </div>

            <div className="checkbox-field checkbox-field--boxed">
              <label>
                <input
                  id="aceiteModoTeste"
                  type="checkbox"
                  checked={aceiteModoTeste}
                  onChange={event => {
                    setAceiteModoTeste(event.target.checked)
                    setErroAceite('')
                  }}
                  disabled={redirecionando}
                  aria-invalid={Boolean(erroAceite)}
                  aria-describedby={
                    erroAceite
                      ? 'aceiteModoTeste-error'
                      : 'aceiteModoTeste-hint'
                  }
                />
                <span>
                  Confirmo que este é um ambiente de teste e que não usarei
                  dados financeiros reais.
                </span>
              </label>
              <small id="aceiteModoTeste-hint">
                Você será redirecionado ao Mercado Pago para continuar.
              </small>
              {erroAceite && (
                <span id="aceiteModoTeste-error" className="field-error" role="alert">
                  {erroAceite}
                </span>
              )}
            </div>

            {erroPagamento && <p className="form-alert" role="alert">{erroPagamento}</p>}

            <button
              type="submit"
              className="button button--primary button--large button--full"
              disabled={!aceiteModoTeste || redirecionando}
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
