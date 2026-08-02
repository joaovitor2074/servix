import { Link } from 'react-router'
import {
  criarLinkWhatsApp,
  SITE_CONTACT_EMAIL,
  SITE_INSTAGRAM_URL,
  SITE_SUPPORT_EMAIL,
  SITE_WHATSAPP_DISPLAY,
} from '../site-data'

const WHATSAPP_COMERCIAL_HREF = criarLinkWhatsApp(
  'Olá! Quero conhecer melhor o Servix.',
)

const WHATSAPP_SITES_HREF = criarLinkWhatsApp(
  'Olá! Quero pedir um orçamento para criação de site.',
)

export default function ContatoPage() {
  return (
    <>
      <section className="page-hero">
        <div className="site-container page-hero__content">
          <p className="eyebrow">Contato</p>
          <h1>Vamos conversar sobre a rotina da sua empresa.</h1>
          <p>
            Fale com o Servix sobre o plano, implantação, parcerias ou qualquer
            dúvida antes de criar sua conta.
          </p>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container contact-grid">
          <article className="contact-card contact-card--primary">
            <span className="contact-card__marker" aria-hidden="true">01</span>
            <h2>Comercial e implantação</h2>
            <p>
              Conte brevemente o tipo de serviço da empresa, o tamanho da equipe
              e o que você precisa organizar primeiro.
            </p>
            <a className="button button--primary" href={WHATSAPP_COMERCIAL_HREF} target="_blank" rel="noreferrer">
              WhatsApp {SITE_WHATSAPP_DISPLAY}
            </a>
            <a className="text-link" href={`mailto:${SITE_CONTACT_EMAIL}`}>
              {SITE_CONTACT_EMAIL}
            </a>
            <a className="text-link" href={SITE_INSTAGRAM_URL} target="_blank" rel="noreferrer">
              Instagram @servixso
            </a>
          </article>

          <article className="contact-card">
            <span className="contact-card__marker" aria-hidden="true">02</span>
            <h2>Já usa o Servix?</h2>
            <p>
              Para dúvidas de acesso ou funcionamento, o suporte consegue
              direcionar sua solicitação com mais rapidez.
            </p>
            <Link className="button button--secondary" to="/suporte">
              Ir para suporte
            </Link>
            <a className="text-link" href={`mailto:${SITE_SUPPORT_EMAIL}`}>
              {SITE_SUPPORT_EMAIL}
            </a>
          </article>

          <article className="contact-card">
            <span className="contact-card__marker" aria-hidden="true">03</span>
            <h2>Criação de sites</h2>
            <p>
              Conte qual é o segmento da empresa, quais serviços você quer
              apresentar e o principal objetivo do novo site.
            </p>
            <a
              className="button button--secondary"
              href={WHATSAPP_SITES_HREF}
              target="_blank"
              rel="noreferrer"
            >
              Pedir orçamento no WhatsApp
            </a>
            <Link className="text-link" to="/criacao-de-sites">
              Conhecer o Servix Sites
            </Link>
          </article>
        </div>
      </section>

      <section className="site-section site-section--tinted">
        <div className="site-container contact-guidance">
          <div className="section-heading">
            <p className="eyebrow">Para agilizar</p>
            <h2>O que incluir na mensagem</h2>
          </div>
          <ul>
            <li><span aria-hidden="true">✓</span> Nome da empresa e seu nome</li>
            <li><span aria-hidden="true">✓</span> Tipo de serviço prestado</li>
            <li><span aria-hidden="true">✓</span> Tema principal da conversa</li>
            <li><span aria-hidden="true">✓</span> Melhor período para retorno</li>
          </ul>
        </div>
      </section>
    </>
  )
}
