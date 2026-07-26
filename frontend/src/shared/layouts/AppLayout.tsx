import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import type { UsuarioAutenticado } from '../../features/auth/types/auth.types'
import { FINANCEIRO_PREVIEW_HABILITADO } from '../../features/finance/config/finance-preview.config'
import servixSymbol from '../../assets/brand/servix-symbol.svg'
import './AppLayout.css'

interface AppLayoutProps {
  usuario: UsuarioAutenticado
  onLogout: () => void
}

export default function AppLayout({
  usuario,
  onLogout,
}: AppLayoutProps) {
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => {
    if (!menuAberto) return

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuAberto(false)
      }
    }

    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', fecharComEscape)

    return () => {
      document.body.style.overflow = overflowAnterior
      document.removeEventListener('keydown', fecharComEscape)
    }
  }, [menuAberto])

  useEffect(() => {
    const consultaDesktop = window.matchMedia('(min-width: 768px)')

    function fecharAoIrParaDesktop(event: MediaQueryListEvent) {
      if (event.matches) {
        setMenuAberto(false)
      }
    }

    consultaDesktop.addEventListener('change', fecharAoIrParaDesktop)

    return () => {
      consultaDesktop.removeEventListener('change', fecharAoIrParaDesktop)
    }
  }, [])

  function handleLogout() {
    setMenuAberto(false)
    onLogout()
  }

  return (
    <div
      className={`app-layout${menuAberto ? ' app-layout--menu-open' : ''}`}
    >
      <aside
        id="app-sidebar"
        className="app-sidebar"
        aria-label="Menu principal"
      >
        <div className="app-sidebar__header">
          <div className="app-sidebar__brand">
            <img src={servixSymbol} alt="" />
            <span>servix</span>
          </div>

          <button
            className="app-sidebar__close"
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMenuAberto(false)}
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="app-sidebar__navigation">
          <NavLink
            to="/dashboard"
            onClick={() => setMenuAberto(false)}
          >
            <DashboardIcon />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/clientes"
            onClick={() => setMenuAberto(false)}
          >
            <ClientsIcon />
            <span>Clientes</span>
          </NavLink>

          <NavLink
            to="/orcamentos"
            onClick={() => setMenuAberto(false)}
          >
            <BudgetsIcon />
            <span>Orçamentos</span>
          </NavLink>

          <NavLink
            to="/ordens"
            onClick={() => setMenuAberto(false)}
          >
            <OrdersIcon />
            <span>Ordens</span>
          </NavLink>

          {FINANCEIRO_PREVIEW_HABILITADO && usuario.papel === 'ADMIN' && (
            <NavLink
              to="/financeiro"
              onClick={() => setMenuAberto(false)}
            >
              <FinanceIcon />
              <span>Financeiro</span>
              <small className="app-sidebar__preview-badge">Preview</small>
            </NavLink>
          )}

          {usuario.papel === 'ADMIN' && (
            <NavLink
              to="/configuracoes/pagamentos"
              onClick={() => setMenuAberto(false)}
            >
              <SettingsIcon />
              <span>Configurações</span>
            </NavLink>
          )}
        </nav>

        <button
          className="app-sidebar__logout"
          type="button"
          onClick={handleLogout}
        >
          <LogoutIcon />
          <span>Sair</span>
        </button>
      </aside>

      <button
        className="app-sidebar-overlay"
        type="button"
        aria-label="Fechar menu"
        tabIndex={menuAberto ? 0 : -1}
        onClick={() => setMenuAberto(false)}
      />

      <div className="app-layout__body">
        <header className="app-topbar">
          <div className="app-topbar__start">
            <button
              className="app-topbar__menu-button"
              type="button"
              aria-label="Abrir menu"
              aria-expanded={menuAberto}
              aria-controls="app-sidebar"
              onClick={() => setMenuAberto(true)}
            >
              <MenuIcon />
            </button>

            <div className="app-topbar__mobile-brand" aria-hidden="true">
              <img src={servixSymbol} alt="" />
              <span>servix</span>
            </div>

            <label className="app-topbar__search">
              <span className="sr-only">Buscar no sistema</span>
              <SearchIcon />
              <input
                type="search"
                placeholder="Buscar ordens, clientes, financeiro..."
              />
            </label>
          </div>

          <div className="app-topbar__account">
            <div className="app-topbar__account-text">
              <strong>{usuario.empresa.nome}</strong>
              <span>{usuario.nome}</span>
            </div>

            <div className="app-topbar__avatar" aria-hidden="true">
              {obterIniciais(usuario.nome)}
            </div>
          </div>
        </header>

        <main className="app-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function obterIniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)

  if (partes.length === 0) return 'U'
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase()

  return `${partes[0].charAt(0)}${partes.at(-1)?.charAt(0)}`.toUpperCase()
}

interface IconProps {
  children: ReactNode
  viewBox?: string
}

function Icon({ children, viewBox = '0 0 24 24' }: IconProps) {
  return (
    <svg viewBox={viewBox} aria-hidden="true">
      {children}
    </svg>
  )
}

function MenuIcon() {
  return (
    <Icon>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  )
}

function CloseIcon() {
  return (
    <Icon>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  )
}

function DashboardIcon() {
  return (
    <Icon>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </Icon>
  )
}

function OrdersIcon() {
  return (
    <Icon>
      <path d="M7 4h10M7 8h10M7 12h6" />
      <path d="M5 20h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z" />
    </Icon>
  )
}

function BudgetsIcon() {
  return (
    <Icon>
      <path d="M6 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z" />
      <path d="M8 8h8M8 12h6" />
    </Icon>
  )
}

function ClientsIcon() {
  return (
    <Icon>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20v-1.5A5.5 5.5 0 0 1 8.5 13h1A5.5 5.5 0 0 1 15 18.5V20" />
      <path d="M16 6.5a3 3 0 0 1 0 5.5M17 14a4.5 4.5 0 0 1 4 4.5V20" />
    </Icon>
  )
}

function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Icon>
  )
}

function LogoutIcon() {
  return (
    <Icon>
      <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
      <path d="m15 8 4 4-4 4M9 12h10" />
    </Icon>
  )
}

function SettingsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </Icon>
  )
}

function FinanceIcon() {
  return (
    <Icon>
      <path d="M4 7h16v12H4V7Z" />
      <path d="M7 7V5h10v2M8 13h8M12 10v6" />
    </Icon>
  )
}
