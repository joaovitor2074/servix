import { Link } from 'react-router'
import { formatarMoeda, SERVIX_PLAN } from '../site-data'

const benefits = [
  {
    marker: '01',
    title: 'Operação em ordem',
    description:
      'Clientes, orçamentos e ordens de serviço conectados no mesmo fluxo.',
  },
  {
    marker: '02',
    title: 'Cliente bem informado',
    description:
      'Compartilhe links seguros para aprovação, pagamento e acompanhamento.',
  },
  {
    marker: '03',
    title: 'Financeiro rastreável',
    description:
      'Acompanhe valores previstos, recebidos e pendentes por atendimento.',
  },
  {
    marker: '04',
    title: 'Equipe alinhada',
    description:
      'Centralize responsáveis, histórico e próximas ações de cada serviço.',
  },
]

const audiences = [
  'Assistências técnicas',
  'Oficinas e manutenção',
  'Instalação e reparos',
  'Empresas de serviços em geral',
]

export default function HomePage() {
  return (
    <>
      <section className="site-hero">
        <div className="site-container site-hero__grid">
          <div className="site-hero__content">
            <p className="eyebrow">Faça parte do Servix</p>
            <h1>Sua empresa mais organizada, do atendimento ao pagamento.</h1>
            <p className="site-hero__lead">
              Entre para uma rotina de serviços mais clara: clientes,
              orçamentos, ordens e pagamentos conectados para sua equipe
              trabalhar melhor e sua empresa crescer com controle.
            </p>

            <div className="site-hero__actions">
              <Link to="/planos" className="button button--primary button--large">
                Quero fazer parte
                <span aria-hidden="true">→</span>
              </Link>
              <Link to="/demonstracao" className="button button--secondary button--large">
                Conhecer o Servix
              </Link>
            </div>

            <ul className="site-hero__assurances" aria-label="Destaques do Servix">
              <li><span aria-hidden="true">✓</span> Plano mensal claro</li>
              <li><span aria-hidden="true">✓</span> Implantação simples</li>
              <li><span aria-hidden="true">✓</span> Sua empresa em um ambiente próprio</li>
            </ul>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section className="audience-strip" aria-labelledby="audience-title">
        <div className="site-container audience-strip__inner">
          <p id="audience-title">Feito para quem transforma atendimento em serviço entregue</p>
          <ul>
            {audiences.map(audience => <li key={audience}>{audience}</li>)}
          </ul>
        </div>
      </section>

      <section className="site-section" aria-labelledby="benefits-title">
        <div className="site-container">
          <div className="section-heading section-heading--center">
            <p className="eyebrow">Uma rotina mais previsível</p>
            <h2 id="benefits-title">Menos informação espalhada. Mais serviço avançando.</h2>
            <p>
              O Servix reúne o que sua equipe precisa para atender, executar e
              receber com clareza.
            </p>
          </div>

          <div className="benefit-grid">
            {benefits.map(benefit => (
              <article className="benefit-card" key={benefit.title}>
                <span className="benefit-card__marker" aria-hidden="true">
                  {benefit.marker}
                </span>
                <h3>{benefit.title}</h3>
                <p>{benefit.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section site-section--tinted" aria-labelledby="workflow-title">
        <div className="site-container workflow-section">
          <div className="section-heading">
            <p className="eyebrow">Como funciona</p>
            <h2 id="workflow-title">Um fluxo único, do orçamento à conclusão.</h2>
            <p>
              Cada etapa deixa a próxima ação evidente para a equipe e mantém o
              cliente atualizado sem exigir acesso ao sistema.
            </p>
          </div>

          <ol className="workflow-list">
            <li>
              <span>1</span>
              <div><h3>Cadastre e orce</h3><p>Registre o cliente, o equipamento e a proposta.</p></div>
            </li>
            <li>
              <span>2</span>
              <div><h3>Aprove e execute</h3><p>O cliente decide pelo link e a equipe acompanha a ordem.</p></div>
            </li>
            <li>
              <span>3</span>
              <div><h3>Entregue e receba</h3><p>Atualize o status e registre o pagamento no mesmo histórico.</p></div>
            </li>
          </ol>
        </div>
      </section>

      <section className="site-section" aria-labelledby="payments-title">
        <div className="site-container payment-separation">
          <div className="section-heading section-heading--center">
            <p className="eyebrow">Dinheiro no destino certo</p>
            <h2 id="payments-title">Dois pagamentos. Duas contas. Nenhuma mistura.</h2>
            <p>
              A assinatura do sistema e o pagamento dos serviços das empresas
              são operações independentes.
            </p>
          </div>

          <div className="payment-flow-grid">
            <article className="payment-flow-card payment-flow-card--servix">
              <span className="status-pill">Assinatura SaaS</span>
              <h3>Empresa paga a assinatura</h3>
              <div className="payment-flow-card__route" aria-label="Empresa paga assinatura para a conta do Servix">
                <span>Empresa</span><b aria-hidden="true">→</b><span>Conta Servix</span>
              </div>
              <p>
                A mensalidade usa a conta do próprio Servix. Ela nunca utiliza o
                token OAuth de uma empresa cliente.
              </p>
            </article>

            <article className="payment-flow-card payment-flow-card--company">
              <span className="status-pill status-pill--green">Recebimento da assistência</span>
              <h3>Empresa recebe diretamente</h3>
              <div className="payment-flow-card__route" aria-label="Cliente paga diretamente para a assistência">
                <span>Cliente</span><b aria-hidden="true">→</b><span>Assistência</span>
              </div>
              <p>
                O pagamento é combinado fora do Servix e a equipe registra o
                recebimento na ordem de serviço. A integração online está em desenvolvimento.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="site-section site-section--dark" aria-labelledby="plan-home-title">
        <div className="site-container home-plan">
          <div className="home-plan__copy">
            <p className="eyebrow eyebrow--light">Seu lugar no Servix</p>
            <h2 id="plan-home-title">Faça parte com um plano simples e completo.</h2>
            <p>
              Reúna equipe, clientes e serviços em uma assinatura mensal clara,
              feita para acompanhar a rotina da sua empresa.
            </p>
            <Link to="/planos" className="text-link text-link--light">
              Conhecer o plano Servix <span aria-hidden="true">→</span>
            </Link>
          </div>

          <article className="home-plan__card">
            <p>{SERVIX_PLAN.nome}</p>
            <div className="price-line">
              <strong>{formatarMoeda(SERVIX_PLAN.valorMensal)}</strong>
              <span>/{SERVIX_PLAN.periodicidade}</span>
            </div>
            <ul>
              {SERVIX_PLAN.recursos.slice(0, 4).map(resource => (
                <li key={resource}><span aria-hidden="true">✓</span>{resource}</li>
              ))}
            </ul>
            <Link to="/planos" className="button button--primary button--full">
              Quero fazer parte
            </Link>
          </article>
        </div>
      </section>

      <section className="site-section final-cta" aria-labelledby="final-cta-title">
        <div className="site-container final-cta__card">
          <div>
            <p className="eyebrow">Sua empresa tem lugar no Servix</p>
            <h2 id="final-cta-title">Faça parte de uma gestão criada para quem vive de serviços.</h2>
          </div>
          <div className="final-cta__actions">
            <Link to="/planos" className="button button--primary button--large">
              Conhecer os planos
            </Link>
            <Link to="/contato" className="button button--secondary button--large">
              Falar com o Servix
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

function ProductPreview() {
  return (
    <figure className="product-preview" aria-label="Prévia ilustrativa do dashboard operacional do Servix">
      <div className="product-preview__window" aria-hidden="true">
        <div className="product-preview__topbar">
          <span /><span /><span />
          <p>servix</p>
          <b>JR</b>
        </div>
        <div className="product-preview__body">
          <aside>
            <strong>S</strong>
            <i className="is-active" /><i /><i /><i /><i />
          </aside>
          <div className="product-preview__content">
            <div className="product-preview__welcome">
              <div><small>Visão geral</small><h2>Bom trabalho, Juliana</h2></div>
              <button type="button" tabIndex={-1}>+ Nova ordem</button>
            </div>
            <div className="product-preview__metrics">
              <article><span>Em andamento</span><strong>18</strong><small>+4 esta semana</small></article>
              <article><span>Prontos</span><strong>07</strong><small>Aguardando retirada</small></article>
              <article><span>A receber</span><strong>R$ 3,8 mil</strong><small>12 atendimentos</small></article>
            </div>
            <div className="product-preview__lower">
              <article className="product-preview__chart">
                <div><strong>Fluxo de serviços</strong><small>Últimos 7 dias</small></div>
                <div className="bar-chart"><i /><i /><i /><i /><i /><i /><i /></div>
              </article>
              <article className="product-preview__orders">
                <strong>Ordens recentes</strong>
                <div><span>OS-1048</span><b>Em execução</b></div>
                <div><span>OS-1047</span><b className="is-ready">Pronto</b></div>
                <div><span>OS-1046</span><b>Em análise</b></div>
              </article>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        Exemplo visual de indicadores, fluxo e ordens recentes no Servix.
      </figcaption>
    </figure>
  )
}
