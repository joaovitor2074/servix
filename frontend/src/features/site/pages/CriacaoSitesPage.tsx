import { Link } from 'react-router'
import { SITE_CONTACT_EMAIL } from '../site-data'
import './CriacaoSitesPage.css'

const ORCAMENTO_HREF = `mailto:${SITE_CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Quero um orçamento para criação de site',
)}&body=${encodeURIComponent(
  'Olá! Quero criar um site para minha empresa.\n\nNome da empresa:\nSegmento:\nO que preciso no site:\nMelhor forma de contato:',
)}`

const beneficios = [
  {
    marker: '01',
    title: 'Feito para o seu negócio',
    description:
      'Conteúdo, cores e estrutura pensados para apresentar sua empresa com clareza e confiança.',
  },
  {
    marker: '02',
    title: 'Pronto para o celular',
    description:
      'Uma experiência rápida e responsiva para quem chega pelo Google, Instagram ou indicação.',
  },
  {
    marker: '03',
    title: 'Focado em contatos',
    description:
      'Chamadas para WhatsApp, orçamento e localização posicionadas para facilitar a decisão do cliente.',
  },
]

const solucoes = [
  {
    label: 'Comece bem',
    title: 'Site Essencial',
    description:
      'Uma página completa para apresentar a empresa, os serviços e os caminhos de contato.',
    items: [
      'Página responsiva e personalizada',
      'Apresentação dos principais serviços',
      'Botões de contato e localização',
      'Configuração básica para buscadores',
    ],
  },
  {
    label: 'Mais procurado',
    title: 'Site Profissional',
    description:
      'Mais espaço para explicar seus diferenciais, fortalecer a marca e organizar seus serviços.',
    items: [
      'Páginas institucionais completas',
      'Galeria, depoimentos e dúvidas frequentes',
      'Formulário para novos contatos',
      'Domínio e publicação orientados',
    ],
    featured: true,
  },
  {
    label: 'Operação completa',
    title: 'Site + Servix',
    description:
      'Presença profissional para captar clientes e o Servix para organizar o atendimento depois do contato.',
    items: [
      'Site profissional sob medida',
      'Implantação guiada do Servix',
      'Jornada do contato à ordem de serviço',
      'Uma base preparada para crescer',
    ],
  },
]

const modelos = [
  {
    category: 'Assistência técnica',
    title: 'Conserta Tech',
    description: 'Celulares, notebooks e atendimento rápido.',
    tone: 'blue',
  },
  {
    category: 'Climatização',
    title: 'Clima Certo',
    description: 'Instalação e manutenção de ar-condicionado.',
    tone: 'green',
  },
  {
    category: 'Serviços residenciais',
    title: 'Pronto Reparos',
    description: 'Elétrica, hidráulica e pequenos reparos.',
    tone: 'orange',
  },
]

const etapas = [
  ['1', 'Conversa inicial', 'Entendemos seu negócio, seus clientes e o objetivo principal do site.'],
  ['2', 'Conteúdo e visual', 'Organizamos as informações e criamos uma apresentação alinhada à sua empresa.'],
  ['3', 'Revisão', 'Você acompanha a prévia e indica os ajustes necessários antes da publicação.'],
  ['4', 'Site no ar', 'Publicamos, conferimos o funcionamento e orientamos os próximos passos.'],
] as const

export default function CriacaoSitesPage() {
  return (
    <>
      <section className="sites-service-hero">
        <div className="site-container sites-service-hero__grid">
          <div className="sites-service-hero__content">
            <p className="eyebrow">Servix Sites</p>
            <h1>Um site profissional para sua empresa conquistar novos clientes.</h1>
            <p>
              Criamos sites claros, rápidos e preparados para apresentar seus
              serviços, gerar confiança e facilitar o primeiro contato.
            </p>

            <div className="sites-service-hero__actions">
              <a className="button button--primary button--large" href={ORCAMENTO_HREF}>
                Pedir orçamento
                <span aria-hidden="true">→</span>
              </a>
              <a className="button button--secondary button--large" href="#modelos">
                Ver modelos
              </a>
            </div>

            <ul className="sites-service-hero__assurances" aria-label="Diferenciais da criação de sites">
              <li><span aria-hidden="true">✓</span> Visual personalizado</li>
              <li><span aria-hidden="true">✓</span> Responsivo no celular</li>
              <li><span aria-hidden="true">✓</span> Orçamento sem compromisso</li>
            </ul>
          </div>

          <SiteShowcase />
        </div>
      </section>

      <section className="sites-service-proof" aria-label="Tipos de negócio atendidos">
        <div className="site-container">
          <p>Sites para empresas que vivem de prestar um bom serviço</p>
          <ul>
            <li>Assistências técnicas</li>
            <li>Manutenção e reparos</li>
            <li>Oficinas</li>
            <li>Profissionais autônomos</li>
          </ul>
        </div>
      </section>

      <section className="site-section" aria-labelledby="sites-benefits-title">
        <div className="site-container">
          <div className="section-heading section-heading--center">
            <p className="eyebrow">Mais do que estar online</p>
            <h2 id="sites-benefits-title">Seu site precisa ajudar o cliente a escolher sua empresa.</h2>
            <p>
              Cada parte da página é organizada para responder dúvidas, mostrar
              seus diferenciais e abrir um caminho simples para o contato.
            </p>
          </div>

          <div className="sites-benefit-grid">
            {beneficios.map(beneficio => (
              <article className="sites-benefit-card" key={beneficio.title}>
                <span>{beneficio.marker}</span>
                <h3>{beneficio.title}</h3>
                <p>{beneficio.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section site-section--tinted" aria-labelledby="sites-solutions-title">
        <div className="site-container">
          <div className="section-heading">
            <p className="eyebrow">Uma solução para cada momento</p>
            <h2 id="sites-solutions-title">Comece com o que sua empresa precisa agora.</h2>
            <p>
              O formato final e o investimento são definidos depois de
              entendermos o conteúdo, as integrações e o objetivo do projeto.
            </p>
          </div>

          <div className="sites-offer-grid">
            {solucoes.map(solucao => (
              <article
                className={`sites-offer-card${solucao.featured ? ' sites-offer-card--featured' : ''}`}
                key={solucao.title}
              >
                <span className="sites-offer-card__label">{solucao.label}</span>
                <h3>{solucao.title}</h3>
                <p>{solucao.description}</p>
                <ul>
                  {solucao.items.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}
                </ul>
                <a className={solucao.featured ? 'button button--primary' : 'button button--secondary'} href={ORCAMENTO_HREF}>
                  Solicitar orçamento
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="modelos" className="site-section sites-models" aria-labelledby="sites-models-title">
        <div className="site-container">
          <div className="section-heading">
            <p className="eyebrow">Modelos demonstrativos</p>
            <h2 id="sites-models-title">Imagine sua empresa apresentada assim.</h2>
            <p>
              Estes exemplos mostram direções visuais possíveis. Cada projeto
              recebe conteúdo e identidade próprios.
            </p>
          </div>

          <div className="sites-model-grid">
            {modelos.map(modelo => (
              <article className={`sites-model-card sites-model-card--${modelo.tone}`} key={modelo.title}>
                <div className="sites-model-card__browser" aria-hidden="true">
                  <div className="sites-model-card__bar"><i /><i /><i /><span /></div>
                  <div className="sites-model-card__screen">
                    <div>
                      <small>{modelo.category}</small>
                      <strong>{modelo.title}</strong>
                      <p>{modelo.description}</p>
                      <span>Solicitar atendimento</span>
                    </div>
                    <i />
                  </div>
                </div>
                <div className="sites-model-card__caption">
                  <span>{modelo.category}</span>
                  <h3>{modelo.title}</h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section site-section--dark" aria-labelledby="sites-process-title">
        <div className="site-container sites-process">
          <div className="section-heading">
            <p className="eyebrow eyebrow--light">Do briefing à publicação</p>
            <h2 id="sites-process-title">Um processo direto, com você acompanhando cada etapa.</h2>
          </div>

          <ol>
            {etapas.map(([numero, titulo, descricao]) => (
              <li key={numero}>
                <span>{numero}</span>
                <div><h3>{titulo}</h3><p>{descricao}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="site-section" aria-labelledby="sites-combo-title">
        <div className="site-container sites-combo">
          <div>
            <p className="eyebrow">Site + Servix</p>
            <h2 id="sites-combo-title">Bem apresentada por fora. Organizada por dentro.</h2>
            <p>
              O site ajuda novos clientes a encontrarem sua empresa. O Servix
              ajuda sua equipe a transformar cada contato em orçamento, ordem
              de serviço e acompanhamento organizado.
            </p>
          </div>
          <div className="sites-combo__flow" aria-label="Fluxo do site para o Servix">
            <span>Cliente encontra o site</span>
            <b aria-hidden="true">→</b>
            <span>Solicita atendimento</span>
            <b aria-hidden="true">→</b>
            <span>Equipe organiza no Servix</span>
          </div>
          <div className="sites-combo__actions">
            <a className="button button--primary button--large" href={ORCAMENTO_HREF}>Quero o combo</a>
            <Link className="text-link" to="/demonstracao">Conhecer o sistema <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="site-section site-section--tinted" aria-labelledby="sites-faq-title">
        <div className="site-container faq-layout">
          <div className="section-heading">
            <p className="eyebrow">Perguntas frequentes</p>
            <h2 id="sites-faq-title">Antes de começar</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>Quanto custa criar um site?</summary>
              <p>O valor depende da quantidade de páginas, do conteúdo e das integrações. Você recebe um orçamento claro antes do início.</p>
            </details>
            <details>
              <summary>O site funciona bem no celular?</summary>
              <p>Sim. Todo projeto é pensado para celulares, tablets e computadores, com navegação simples em diferentes tamanhos de tela.</p>
            </details>
            <details>
              <summary>Domínio e hospedagem estão incluídos?</summary>
              <p>Esses itens são definidos no orçamento. Também orientamos a escolha do domínio e a forma de publicação mais adequada.</p>
            </details>
            <details>
              <summary>Preciso contratar o sistema Servix?</summary>
              <p>Não. O site pode ser contratado separadamente. O combo é uma opção para empresas que também querem organizar a operação.</p>
            </details>
          </div>
        </div>
      </section>

      <section className="site-section final-cta" aria-labelledby="sites-final-cta-title">
        <div className="site-container final-cta__card">
          <div>
            <p className="eyebrow">Vamos tirar a ideia do papel</p>
            <h2 id="sites-final-cta-title">Conte como é sua empresa e receba uma proposta para o seu site.</h2>
          </div>
          <div className="final-cta__actions">
            <a className="button button--primary button--large" href={ORCAMENTO_HREF}>Pedir orçamento</a>
            <Link className="button button--secondary button--large" to="/contato">Falar com o Servix</Link>
          </div>
        </div>
      </section>
    </>
  )
}

function SiteShowcase() {
  return (
    <figure className="sites-service-preview" aria-label="Exemplo ilustrativo de um site criado para uma empresa de serviços">
      <div className="sites-service-preview__browser" aria-hidden="true">
        <div className="sites-service-preview__topbar">
          <i /><i /><i />
          <span>seunegocio.com.br</span>
        </div>
        <div className="sites-service-preview__nav">
          <strong>nexo<span>service</span></strong>
          <div><i /><i /><i /></div>
          <b>Falar agora</b>
        </div>
        <div className="sites-service-preview__hero">
          <div>
            <small>Atendimento especializado</small>
            <strong>Seu problema resolvido com agilidade.</strong>
            <p>Serviço profissional, orçamento claro e atendimento perto de você.</p>
            <span>Solicitar orçamento</span>
          </div>
          <div className="sites-service-preview__visual"><i /><i /><i /></div>
        </div>
        <div className="sites-service-preview__cards"><i /><i /><i /></div>
      </div>
      <figcaption>Exemplo visual — cada projeto recebe identidade e conteúdo próprios.</figcaption>
    </figure>
  )
}
