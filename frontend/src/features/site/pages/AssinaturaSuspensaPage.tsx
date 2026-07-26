import { Link } from 'react-router'

export default function AssinaturaSuspensaPage() {
  return (
    <section className="state-page">
      <div className="site-container state-card">
        <span className="state-card__code">Assinatura não ativa</span>
        <h1>O acesso desta empresa está suspenso.</h1>
        <p>
          A assinatura foi pausada ou cancelada no Mercado Pago. Por segurança,
          a sessão foi encerrada e os dados internos da empresa permanecerão
          bloqueados enquanto a assinatura não estiver ativa.
        </p>
        <div className="state-card__actions">
          <Link to="/" className="button button--primary">
            Voltar ao início
          </Link>
          <Link to="/suporte" className="button button--secondary">
            Falar com o suporte
          </Link>
        </div>
      </div>
    </section>
  )
}
