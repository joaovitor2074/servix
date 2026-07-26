import { useEffect, useState } from 'react'
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router'
import { sincronizarCheckout } from '../site.service'
import { formatarMoeda } from '../site-data'
import type { CheckoutData } from '../site.types'

export default function CadastroConcluidoPage() {
  const location = useLocation()
  const { checkoutToken = '' } = useParams()
  const [searchParams] = useSearchParams()
  // Compatibilidade com retornos criados antes de o token passar para o path.
  // O split também recupera URLs em que o provedor anexou `?preapproval_id`
  // ao valor do parâmetro checkout.
  const token = (
    checkoutToken ||
    searchParams.get('checkout') ||
    ''
  ).split(/[?&]/, 1)[0]
  const dadosIniciais = (location.state as CheckoutData | null) ?? null
  const [dados, setDados] = useState<CheckoutData | null>(dadosIniciais)
  const [carregando, setCarregando] = useState(!dadosIniciais && Boolean(token))
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (dadosIniciais?.assinatura.status === 'ATIVA' || !token) return

    const controller = new AbortController()
    let tentativa = 0
    let timeoutId: number | undefined

    async function carregarResumo() {
      try {
        const checkout = await sincronizarCheckout(token, controller.signal)
        setDados(checkout)
        setErro('')

        if (
          checkout.assinatura.status === 'PENDENTE' &&
          tentativa < 4 &&
          !controller.signal.aborted
        ) {
          tentativa += 1
          timeoutId = window.setTimeout(() => {
            void carregarResumo()
          }, 2000)
          return
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setErro(
          error instanceof Error
            ? error.message
            : 'Não foi possível validar esta confirmação.',
        )
      } finally {
        if (!controller.signal.aborted) setCarregando(false)
      }
    }

    void carregarResumo()
    return () => {
      controller.abort()
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [dadosIniciais, token])

  if (carregando) {
    return (
      <section className="completion-page">
        <div className="site-container checkout-loading" aria-busy="true" aria-live="polite">
          <span className="loading-spinner" aria-hidden="true" />
          <h1>Validando a confirmação...</h1>
        </div>
      </section>
    )
  }

  if (dados?.assinatura.status === 'PENDENTE') {
    return (
      <section className="state-page">
        <div className="site-container state-card">
          <span className="state-card__code">Confirmação em andamento</span>
          <h1>Estamos aguardando o Mercado Pago.</h1>
          <p>
            A empresa continuará protegida enquanto a assinatura não for
            confirmada. Atualize esta página em alguns instantes.
          </p>
          <div className="state-card__actions">
            <button
              type="button"
              className="button button--primary"
              onClick={() => window.location.reload()}
            >
              Verificar novamente
            </button>
            <Link to="/suporte" className="button button--secondary">
              Pedir ajuda
            </Link>
          </div>
        </div>
      </section>
    )
  }

  if (!dados || dados.assinatura.status !== 'ATIVA') {
    return (
      <section className="state-page">
        <div className="site-container state-card">
          <span className="state-card__code">Confirmação não validada</span>
          <h1>Não foi possível confirmar este cadastro.</h1>
          <p role="alert">
            {erro || 'Use o link de checkout recebido ao concluir o cadastro.'}
          </p>
          <div className="state-card__actions">
            <Link to="/cadastro" className="button button--primary">Recomeçar cadastro</Link>
            <Link to="/suporte" className="button button--secondary">Pedir ajuda</Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="completion-page">
      <div className="site-container completion-card">
        <div className="completion-card__icon" aria-hidden="true">✓</div>
        <p className="eyebrow">Cadastro concluído</p>
        <h1>Sua empresa foi criada com sucesso.</h1>
        <p className="completion-card__lead">
          A assinatura foi confirmada no ambiente de teste. Agora você já pode
          acessar o Servix com o slug, e-mail e senha cadastrados.
        </p>

        <dl className="completion-summary">
          <div><dt>Empresa</dt><dd>{dados.empresa.nome}</dd></div>
          <div><dt>Plano</dt><dd>{dados.assinatura.planoNome}</dd></div>
          <div><dt>Valor de referência</dt><dd>{formatarMoeda(dados.assinatura.valorMensal)}/mês</dd></div>
          <div><dt>Ambiente</dt><dd>{dados.assinatura.ambiente}</dd></div>
        </dl>

        <div className="completion-card__notice">
          <strong>Nenhuma cobrança real foi realizada.</strong>
          <p>A ativação em produção dependerá de validação e ação do responsável titular.</p>
        </div>

        <div className="completion-card__actions">
          <Link to="/login" className="button button--primary button--large">Acessar o Servix</Link>
          <Link to="/suporte" className="button button--secondary button--large">Conhecer o suporte</Link>
        </div>
      </div>
    </section>
  )
}
