import { Link } from 'react-router'
import { formatarMoeda, SERVIX_PLAN } from '../site-data'

export default function PlanosPage() {
  return (
    <>
      <section className="page-hero page-hero--centered">
        <div className="site-container page-hero__content">
          <p className="eyebrow">Preço claro, escolha simples</p>
          <h1>Um plano para organizar toda a sua operação.</h1>
          <p>
            Sem combinações difíceis: os recursos essenciais do Servix reunidos
            em uma única assinatura mensal.
          </p>
        </div>
      </section>

      <section className="site-section plans-section" aria-labelledby="servix-plan-title">
        <div className="site-container plans-layout">
          <article className="plan-card plan-card--featured">
            <div className="plan-card__header">
              <div>
                <span className="status-pill">Plano único</span>
                <h2 id="servix-plan-title">{SERVIX_PLAN.nome}</h2>
                <p>Para empresas que querem atender com mais organização.</p>
              </div>
              <div className="plan-card__price">
                <strong>{formatarMoeda(SERVIX_PLAN.valorMensal)}</strong>
                <span>por {SERVIX_PLAN.periodicidade}</span>
              </div>
            </div>

            <div className="plan-card__divider" />

            <h3>O que está incluído</h3>
            <ul className="feature-list">
              {SERVIX_PLAN.recursos.map(resource => (
                <li key={resource}>
                  <span aria-hidden="true">✓</span>
                  {resource}
                </li>
              ))}
            </ul>

            <Link to="/cadastro" className="button button--primary button--large button--full">
              Começar no ambiente de teste
            </Link>
            <p className="plan-card__fine-print">
              A ativação inicial não gera cobrança real.
            </p>
          </article>

          <aside className="test-environment-card" aria-labelledby="test-environment-title">
            <span className="test-environment-card__badge">TESTE</span>
            <h2 id="test-environment-title">Comece sem cobrança real</h2>
            <p>
              Nesta fase, a assinatura é confirmada em ambiente de teste para
              validar cadastro, acesso e fluxo do sistema.
            </p>
            <ul>
              <li>Nenhum cartão ou PIX real será solicitado.</li>
              <li>Nenhuma renovação automática será iniciada.</li>
              <li>A produção só será ativada pelo responsável titular.</li>
            </ul>
            <Link to="/suporte" className="text-link">
              Entender o ambiente de teste <span aria-hidden="true">→</span>
            </Link>
          </aside>
        </div>
      </section>

      <section className="site-section site-section--tinted" aria-labelledby="plan-payments-title">
        <div className="site-container compact-payment-info">
          <div className="section-heading">
            <p className="eyebrow">Transparência financeira</p>
            <h2 id="plan-payments-title">A mensalidade não interfere nos recebimentos da empresa.</h2>
          </div>
          <div className="compact-payment-info__items">
            <article>
              <span>1</span>
              <div><h3>Assinatura do Servix</h3><p>A empresa paga a conta oficial do Servix.</p></div>
            </article>
            <article>
              <span>2</span>
              <div><h3>Pagamento do orçamento</h3><p>O cliente paga diretamente a conta Mercado Pago conectada pela empresa.</p></div>
            </article>
          </div>
        </div>
      </section>

      <section className="site-section" aria-labelledby="plans-faq-title">
        <div className="site-container faq-layout">
          <div className="section-heading">
            <p className="eyebrow">Perguntas frequentes</p>
            <h2 id="plans-faq-title">Antes de começar</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>Já serei cobrado ao criar a conta?</summary>
              <p>Não. O checkout atual confirma apenas uma assinatura de teste, sem transação real.</p>
            </details>
            <details>
              <summary>O Servix recebe o dinheiro dos meus clientes?</summary>
              <p>Não. Quando a empresa conecta o Mercado Pago, os pagamentos dos clientes seguem diretamente para essa conta.</p>
            </details>
            <details>
              <summary>Quando a cobrança real será ativada?</summary>
              <p>A ativação em produção será comunicada e dependerá de ação do responsável titular, após os testes necessários.</p>
            </details>
          </div>
        </div>
      </section>
    </>
  )
}
