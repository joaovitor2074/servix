import { Link } from 'react-router'
import { SITE_SUPPORT_EMAIL } from '../site-data'

const supportTopics = [
  {
    title: 'Acesso à conta',
    description: 'Confira o slug da empresa, o e-mail cadastrado e se a senha tem ao menos oito caracteres.',
  },
  {
    title: 'Assinatura e cancelamento',
    description: 'O administrador pode cancelar nas configurações da assinatura ou pedir ajuda pelo e-mail oficial.',
  },
  {
    title: 'Pagamentos dos clientes',
    description: 'O recebimento é feito diretamente pela assistência e registrado manualmente na ordem.',
  },
]

export default function SuportePage() {
  return (
    <>
      <section className="page-hero page-hero--support">
        <div className="site-container page-hero__content">
          <p className="eyebrow">Central de suporte</p>
          <h1>Orientação clara para continuar trabalhando.</h1>
          <p>
            Veja os pontos mais comuns ou envie uma mensagem com os dados
            necessários para a equipe entender o contexto.
          </p>
          <a className="button button--primary button--large" href={`mailto:${SITE_SUPPORT_EMAIL}?subject=Suporte Servix`}>
            Falar com o suporte
          </a>
        </div>
      </section>

      <section className="site-section" aria-labelledby="support-topics-title">
        <div className="site-container">
          <div className="section-heading section-heading--center">
            <p className="eyebrow">Primeiros passos</p>
            <h2 id="support-topics-title">Talvez a resposta esteja aqui</h2>
          </div>
          <div className="support-grid">
            {supportTopics.map((topic, index) => (
              <article className="support-card" key={topic.title}>
                <span aria-hidden="true">0{index + 1}</span>
                <h3>{topic.title}</h3>
                <p>{topic.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section site-section--tinted">
        <div className="site-container support-request">
          <div>
            <p className="eyebrow">Ao pedir ajuda</p>
            <h2>Envie contexto, nunca credenciais.</h2>
            <p>
              Informe o slug da empresa, a tela, o horário aproximado e o que
              aconteceu. Nunca envie senha, token de acesso, código OAuth ou
              dados completos de pagamento.
            </p>
          </div>
          <div className="support-request__actions">
            <a className="button button--primary" href={`mailto:${SITE_SUPPORT_EMAIL}`}>
              {SITE_SUPPORT_EMAIL}
            </a>
            <Link className="button button--secondary" to="/login">
              Voltar ao login
            </Link>
          </div>
        </div>
      </section>

      <section className="site-section" aria-labelledby="support-faq-title">
        <div className="site-container faq-layout">
          <div className="section-heading">
            <p className="eyebrow">Dúvidas rápidas</p>
            <h2 id="support-faq-title">Sobre pagamentos</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>A assinatura usa minha conta Mercado Pago?</summary>
              <p>Não. A assinatura do sistema usa a conta do próprio Servix.</p>
            </details>
            <details>
              <summary>Para onde vai o pagamento do meu cliente?</summary>
              <p>Diretamente para a assistência, fora do Servix. A integração online está em desenvolvimento.</p>
            </details>
            <details>
              <summary>O ambiente atual movimenta dinheiro real?</summary>
              <p>A tela do checkout identifica TESTE, sem cobrança real, ou PRODUÇÃO, com cobrança recorrente.</p>
            </details>
            <details>
              <summary>Como cancelo a assinatura?</summary>
              <p>O administrador pode cancelar nas configurações da assinatura. Após a confirmação, não haverá nova renovação e a empresa será suspensa.</p>
            </details>
          </div>
        </div>
      </section>
    </>
  )
}
