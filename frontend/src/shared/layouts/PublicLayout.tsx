import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import servixLogo from '../../assets/brand/servix-logo.svg'
import {
  SITE_CONTACT_EMAIL,
  SITE_SUPPORT_EMAIL,
} from '../../features/site/site-data'
import '../../features/site/site.css'

const PAGE_METADATA: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Servix | Gestão de serviços do orçamento ao pagamento',
    description:
      'Organize clientes, orçamentos, ordens de serviço e pagamentos em um só lugar com o Servix.',
  },
  '/planos': {
    title: 'Planos | Servix',
    description:
      'Conheça o Plano Servix para organizar a operação da sua empresa de serviços.',
  },
  '/assinatura-suspensa': {
    title: 'Assinatura suspensa | Servix',
    description:
      'O acesso da empresa foi suspenso porque a assinatura não está ativa.',
  },
  '/cadastro': {
    title: 'Cadastre sua empresa | Servix',
    description:
      'Crie a conta da sua empresa no Servix e prepare sua assinatura em ambiente de teste.',
  },
  '/cadastro/concluido': {
    title: 'Cadastro concluído | Servix',
    description: 'Sua empresa foi criada no Servix.',
  },
  '/contato': {
    title: 'Contato | Servix',
    description: 'Fale com o Servix sobre planos, implantação e parcerias.',
  },
  '/suporte': {
    title: 'Suporte | Servix',
    description: 'Encontre orientações e entre em contato com o suporte Servix.',
  },
  '/politica-de-privacidade': {
    title: 'Política de Privacidade | Servix',
    description: 'Consulte a versão inicial da Política de Privacidade do Servix.',
  },
  '/termos-de-uso': {
    title: 'Termos de Uso | Servix',
    description: 'Consulte a versão inicial dos Termos de Uso do Servix.',
  },
}

const navigationItems = [
  { to: '/', label: 'Início', end: true },
  { to: '/planos', label: 'Planos' },
  { to: '/suporte', label: 'Suporte' },
  { to: '/contato', label: 'Contato' },
]

export default function PublicLayout() {
  const { pathname } = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const checkoutPrivado = pathname.startsWith('/checkout/')
    const paginaNaoIndexavel =
      checkoutPrivado ||
      pathname === '/cadastro' ||
      pathname === '/cadastro/concluido' ||
      !PAGE_METADATA[pathname]
    const metadata = checkoutPrivado
      ? {
          title: 'Checkout de teste | Servix',
          description: 'Confirme a assinatura de teste da sua empresa no Servix.',
        }
      : PAGE_METADATA[pathname] ?? {
          title: 'Página não encontrada | Servix',
          description: 'A página solicitada não foi encontrada.',
        }

    document.title = metadata.title
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', metadata.description)
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute(
        'content',
        paginaNaoIndexavel ? 'noindex, nofollow' : 'index, follow',
      )
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  function fecharMenu() {
    setMenuAberto(false)
  }

  return (
    <div className="public-shell">
      <a className="skip-link" href="#conteudo-principal">
        Ir para o conteúdo
      </a>

      <header className="public-header">
        <div className="site-container public-header__inner">
          <Link
            to="/"
            className="public-header__brand"
            aria-label="Servix — página inicial"
            onClick={fecharMenu}
          >
            <img src={servixLogo} alt="Servix" />
          </Link>

          <button
            type="button"
            className="public-header__menu-button"
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuAberto}
            aria-controls="public-navigation"
            onClick={() => setMenuAberto(aberto => !aberto)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>

          <nav
            id="public-navigation"
            className={`public-header__navigation${
              menuAberto ? ' public-header__navigation--open' : ''
            }`}
            aria-label="Navegação principal"
          >
            {navigationItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={fecharMenu}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                {item.label}
              </NavLink>
            ))}

            <div className="public-header__mobile-actions">
              <Link to="/login" className="button button--ghost" onClick={fecharMenu}>
                Entrar
              </Link>
              <Link to="/cadastro" className="button button--primary" onClick={fecharMenu}>
                Começar agora
              </Link>
            </div>
          </nav>

          <div className="public-header__actions">
            <Link to="/login" className="button button--ghost">
              Entrar
            </Link>
            <Link to="/cadastro" className="button button--primary">
              Começar agora
            </Link>
          </div>
        </div>
      </header>

      <main
        id="conteudo-principal"
        ref={mainRef}
        className="public-main"
        tabIndex={-1}
      >
        <Outlet />
      </main>

      <footer className="public-footer">
        <div className="site-container public-footer__grid">
          <div className="public-footer__about">
            <img src={servixLogo} alt="Servix" />
            <p>
              Gestão clara para empresas que vivem de prestar um bom serviço.
            </p>
          </div>

          <nav aria-label="Servix">
            <h2>Servix</h2>
            <Link to="/">Início</Link>
            <Link to="/planos">Planos</Link>
            <Link to="/cadastro">Criar conta</Link>
            <Link to="/login">Entrar</Link>
          </nav>

          <nav aria-label="Atendimento">
            <h2>Atendimento</h2>
            <Link to="/suporte">Suporte</Link>
            <Link to="/contato">Contato</Link>
            <a href={`mailto:${SITE_SUPPORT_EMAIL}`}>{SITE_SUPPORT_EMAIL}</a>
            <a href={`mailto:${SITE_CONTACT_EMAIL}`}>{SITE_CONTACT_EMAIL}</a>
          </nav>

          <nav aria-label="Informações legais">
            <h2>Legal</h2>
            <Link to="/politica-de-privacidade">Política de Privacidade</Link>
            <Link to="/termos-de-uso">Termos de Uso</Link>
          </nav>
        </div>

        <div className="site-container public-footer__bottom">
          <p>© {new Date().getFullYear()} Servix. Todos os direitos reservados.</p>
          <p>Assinaturas Servix e pagamentos das empresas são fluxos separados.</p>
        </div>
      </footer>
    </div>
  )
}
