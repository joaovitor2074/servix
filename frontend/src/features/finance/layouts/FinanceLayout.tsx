import { NavLink, Outlet } from 'react-router'
import '../styles/finance.css'

const itensNavegacao = [
  { to: '/financeiro', label: 'Visão geral', end: true },
  { to: '/financeiro/contas-a-receber', label: 'Contas a receber' },
  { to: '/financeiro/contas-a-pagar', label: 'Contas a pagar' },
  { to: '/financeiro/movimentacoes', label: 'Movimentações' },
  { to: '/financeiro/fluxo-de-caixa', label: 'Fluxo de caixa' },
  { to: '/financeiro/cadastros', label: 'Cadastros' },
]

export default function FinanceLayout() {
  return (
    <div className="finance-shell">
      <aside className="finance-preview-banner" aria-label="Aviso de ambiente">
        <span className="finance-preview-banner__icon" aria-hidden="true">
          <FlaskIcon />
        </span>
        <span className="finance-preview-banner__copy">
          <strong>Financeiro em avaliação — ambiente PREVIEW</strong>
          <small>
            O resumo dos serviços é somente leitura; lançamentos e ações
            financeiras continuam isolados da produção.
          </small>
        </span>
        <span className="finance-preview-banner__badge">PREVIEW</span>
      </aside>

      <nav className="finance-tabs" aria-label="Navegação do financeiro">
        {itensNavegacao.map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  )
}

function FlaskIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6M10 3v6l-5 8.5A2.3 2.3 0 0 0 7 21h10a2.3 2.3 0 0 0 2-3.5L14 9V3" />
      <path d="M7.5 15h9" />
    </svg>
  )
}
