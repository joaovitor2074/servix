import { Link } from 'react-router'

export default function PublicNotFoundPage() {
  return (
    <section className="state-page">
      <div className="site-container state-card">
        <span className="state-card__code">Erro 404</span>
        <h1>Esta página não foi encontrada.</h1>
        <p>
          O endereço pode ter mudado ou não existir. Você pode voltar ao início
          ou falar com o suporte.
        </p>
        <div className="state-card__actions">
          <Link to="/" className="button button--primary">Voltar ao início</Link>
          <Link to="/suporte" className="button button--secondary">Ir para suporte</Link>
        </div>
      </div>
    </section>
  )
}
