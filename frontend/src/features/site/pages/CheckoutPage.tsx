import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { buscarCheckout, confirmarCheckout } from '../site.service'
import { formatarMoeda } from '../site-data'
import type { CheckoutData } from '../site.types'

export default function CheckoutPage() {
  const { token = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const dadosIniciais = (location.state as CheckoutData | null) ?? null
  const [dados, setDados] = useState<CheckoutData | null>(dadosIniciais)
  const [carregando, setCarregando] = useState(!dadosIniciais)
  const [confirmando, setConfirmando] = useState(false)
  const [aceiteModoTeste, setAceiteModoTeste] = useState(false)
  const [erro, setErro] = useState('')
  const [erroAceite, setErroAceite] = useState('')

  useEffect(() => {
    if (!token) return

    const controller = new AbortController()

    async function carregarCheckout() {
      try {
        const checkout = await buscarCheckout(token, controller.signal)
        setDados(checkout)
        setErro('')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setErro(error instanceof Error ? error.message : 'Não foi possível carregar o checkout.')
      } finally {
        if (!controller.signal.aborted) setCarregando(false)
      }
    }

    void carregarCheckout()
    return () => controller.abort()
  }, [token])

  async function handleConfirmar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')

    if (!aceiteModoTeste) {
      setErroAceite('Confirme que entendeu o modo de teste.')
      document.getElementById('aceiteModoTeste')?.focus()
      return
    }

    setErroAceite('')
    setConfirmando(true)

    try {
      const resultado = await confirmarCheckout(token)
      navigate(`/cadastro/concluido?checkout=${encodeURIComponent(token)}`, {
        replace: true,
        state: resultado,
      })
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar a assinatura de teste.',
      )
    } finally {
      setConfirmando(false)
    }
  }

  if (!token) {
    return <CheckoutError message="O link de checkout é inválido." />
  }

  if (carregando && !dados) {
    return (
      <section className="checkout-page">
        <div className="site-container checkout-loading" aria-busy="true" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <h1>Preparando seu checkout de teste...</h1>
        </div>
      </section>
    )
  }

  if (!dados) {
    return <CheckoutError message={erro || 'Este checkout não está disponível.'} />
  }

  return (
    <section className="checkout-page">
      <div className="site-container checkout-page__header">
        <p className="eyebrow">Última etapa</p>
        <h1>Confirme sua assinatura de teste.</h1>
        <p>Revise os dados abaixo. Nenhum meio de pagamento real será solicitado.</p>
      </div>

      <div className="site-container checkout-layout">
        <form className="checkout-card" onSubmit={handleConfirmar} noValidate>
          <div className="test-banner" role="status">
            <span>TESTE</span>
            <div>
              <strong>Ambiente sem cobrança</strong>
              <p>Esta confirmação não movimenta dinheiro nem agenda renovação.</p>
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
            <div><dt>Status</dt><dd>{formatarStatus(dados.assinatura.status)}</dd></div>
            <div><dt>Cobrança agora</dt><dd>R$ 0,00</dd></div>
          </dl>

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
                aria-invalid={Boolean(erroAceite)}
                aria-describedby={erroAceite ? 'aceiteModoTeste-error' : 'aceiteModoTeste-hint'}
              />
              <span>
                Confirmo que entendi: este é um ambiente de teste e não haverá
                cobrança, renovação ou transação real.
              </span>
            </label>
            <small id="aceiteModoTeste-hint">A produção será ativada somente após validação do responsável titular.</small>
            {erroAceite && <span id="aceiteModoTeste-error" className="field-error" role="alert">{erroAceite}</span>}
          </div>

          {erro && <p className="form-alert" role="alert">{erro}</p>}

          <button
            type="submit"
            className="button button--primary button--large button--full"
            disabled={confirmando}
            aria-busy={confirmando}
          >
            {confirmando ? 'Confirmando...' : 'Confirmar assinatura de teste'}
          </button>

          <p className="checkout-card__legal">
            Ao confirmar, permanecem válidos os aceites realizados no cadastro.
          </p>
        </form>

        <aside className="checkout-aside">
          <h2>Pagamentos continuam separados</h2>
          <div>
            <span>Assinatura</span>
            <strong>Empresa → Servix</strong>
          </div>
          <div>
            <span>Orçamento</span>
            <strong>Cliente → Mercado Pago da empresa</strong>
          </div>
          <p>
            O checkout do plano nunca usa a autorização OAuth da conta Mercado
            Pago de uma empresa cliente.
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
          <Link to="/cadastro" className="button button--primary">Recomeçar cadastro</Link>
          <Link to="/suporte" className="button button--secondary">Pedir ajuda</Link>
        </div>
      </div>
    </section>
  )
}

function formatarStatus(status: string) {
  return status.replaceAll('_', ' ').toLocaleLowerCase('pt-BR')
}
