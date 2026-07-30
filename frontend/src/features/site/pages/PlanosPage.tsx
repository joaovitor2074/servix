import { Link } from 'react-router'
import {
  formatarMoeda,
  SERVIX_PLAN,
  SITE_LEGAL_IDENTITY_PENDING_MESSAGE,
  SITE_LEGAL_IDENTITY_READY,
} from '../site-data'
import { useCatalogoAssinaturas } from '../use-catalogo-assinaturas'

export default function PlanosPage() {
  const { catalogo, erroCatalogo, carregandoCatalogo } = useCatalogoAssinaturas()
  const modoProducao = catalogo?.ambiente === 'PRODUCAO'
  const identidadeLegalBloqueiaProducao =
    modoProducao && !SITE_LEGAL_IDENTITY_READY
  const checkoutDisponivel =
    catalogo?.checkoutDisponivel === true && !identidadeLegalBloqueiaProducao

  return (
    <>
      <section className="page-hero page-hero--centered">
        <div className="site-container page-hero__content">
          <p className="eyebrow">Venha fazer parte</p>
          <h1>O plano para sua empresa fazer parte do Servix.</h1>
          <p>
            Escolha uma gestão mais clara para sua equipe, com os recursos
            essenciais reunidos em uma única assinatura mensal.
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

            {checkoutDisponivel ? (
              <Link
                to="/cadastro?redirect=/assinatura"
                className="button button--primary button--large button--full"
              >
                Quero fazer parte do Servix
              </Link>
            ) : (
              <button
                type="button"
                className="button button--primary button--large button--full"
                disabled
              >
                {carregandoCatalogo ? 'Consultando checkout...' : 'Checkout indisponível'}
              </button>
            )}
            <p className="plan-card__fine-print">
              {modoProducao
                ? `Assinatura recorrente de ${formatarMoeda(SERVIX_PLAN.valorMensal)} por mês.`
                : 'No ambiente de teste não há cobrança real.'}
            </p>
            {(identidadeLegalBloqueiaProducao || erroCatalogo) && (
              <p className="form-alert" role="alert">
                {identidadeLegalBloqueiaProducao
                  ? SITE_LEGAL_IDENTITY_PENDING_MESSAGE
                  : erroCatalogo}
              </p>
            )}
          </article>

          <aside className="test-environment-card" aria-labelledby="test-environment-title">
            <span className="test-environment-card__badge">
              {modoProducao ? 'PRODUÇÃO' : 'TESTE'}
            </span>
            <h2 id="test-environment-title">
              {modoProducao ? 'Assinatura mensal transparente' : 'Comece sem cobrança real'}
            </h2>
            <p>
              {modoProducao
                ? 'A cobrança recorrente é apresentada e confirmada no ambiente seguro do Mercado Pago.'
                : 'A assinatura é confirmada em ambiente de teste para validar cadastro, acesso e fluxo do sistema.'}
            </p>
            <ul>
              {modoProducao ? (
                <>
                  <li>Mensalidade de {formatarMoeda(SERVIX_PLAN.valorMensal)}.</li>
                  <li>Renovação mensal automática.</li>
                  <li>Cancelamento disponível no portal da assinatura.</li>
                </>
              ) : (
                <>
                  <li>Nenhum cartão ou PIX real será solicitado.</li>
                  <li>Nenhuma renovação automática será iniciada.</li>
                  <li>Use exclusivamente uma conta compradora de teste.</li>
                </>
              )}
            </ul>
            <Link to={modoProducao ? '/termos-de-uso' : '/suporte'} className="text-link">
              {modoProducao ? 'Consultar condições da assinatura' : 'Entender o ambiente de teste'}{' '}
              <span aria-hidden="true">→</span>
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
              <div><h3>Pagamento do orçamento</h3><p>O cliente paga diretamente à assistência, que registra o recebimento na ordem.</p></div>
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
              <p>
                {modoProducao
                  ? `A cobrança recorrente de ${formatarMoeda(SERVIX_PLAN.valorMensal)} é confirmada no checkout do Mercado Pago antes da ativação da empresa.`
                  : 'Não. O checkout atual confirma apenas uma assinatura de teste, sem transação real.'}
              </p>
            </details>
            <details>
              <summary>O Servix recebe o dinheiro dos meus clientes?</summary>
              <p>Não. O pagamento é combinado diretamente com a assistência. A integração online ainda está em desenvolvimento.</p>
            </details>
            <details>
              <summary>{modoProducao ? 'Como cancelo a assinatura?' : 'Quando a cobrança real será ativada?'}</summary>
              <p>
                {modoProducao
                  ? 'O administrador pode cancelar a recorrência no portal de assinatura. Novas cobranças são interrompidas e o acesso é suspenso conforme os Termos de Uso.'
                  : 'A produção será ativada somente depois da validação técnica e comercial.'}
              </p>
            </details>
          </div>
        </div>
      </section>
    </>
  )
}
