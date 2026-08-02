import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import servixLogo from '../../assets/brand/servix-logo.svg'
import {
  SITE_CONTACT_EMAIL,
  SITE_SUPPORT_EMAIL,
} from '../../features/site/site-data'
import '../../features/site/site.css'

type PublicTheme = 'light' | 'dark'

function getInitialTheme(): PublicTheme {
  const savedTheme = window.localStorage.getItem('servix-public-theme')
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const PAGE_METADATA: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Servix | Gestão de serviços do orçamento ao pagamento',
    description:
      'Faça parte do Servix e organize clientes, orçamentos, ordens de serviço e pagamentos em um só lugar.',
  },
  '/planos': {
    title: 'Planos | Servix',
    description:
      'Conheça o Plano Servix e faça parte de uma gestão mais clara para sua empresa de serviços.',
  },
  '/criacao-de-sites': {
    title: 'Criação de Sites Profissionais | Servix Sites',
    description:
      'Sites responsivos e personalizados para empresas de serviços conquistarem confiança e novos contatos.',
  },
  '/assinatura-suspensa': {
    title: 'Assinatura suspensa | Servix',
    description:
      'O acesso da empresa foi suspenso porque a assinatura não está ativa.',
  },
  '/cadastro': {
    title: 'Cadastre sua empresa | Servix',
    description:
      'Crie a conta da sua empresa e faça parte do Servix.',
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
  { to: '/demonstracao', label: 'Demonstração' },
  { to: '/criacao-de-sites', label: 'Criação de Sites' },
  { to: '/planos', label: 'Planos' },
  { to: '/suporte', label: 'Suporte' },
  { to: '/contato', label: 'Contato' },
]

export default function PublicLayout() {
  const { pathname } = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)
  const [theme, setTheme] = useState<PublicTheme>(getInitialTheme)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    window.localStorage.setItem('servix-public-theme', theme)
    document.documentElement.style.colorScheme = theme
  }, [theme])

  useEffect(() => {
    if (!menuAberto) return

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuAberto(false)
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
    const consultaDesktop = window.matchMedia('(min-width: 1100px)')
    const fecharAoIrParaDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuAberto(false)
    }

    consultaDesktop.addEventListener('change', fecharAoIrParaDesktop)
    return () => consultaDesktop.removeEventListener('change', fecharAoIrParaDesktop)
  }, [])

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

  useEffect(() => {
    const root = mainRef.current
    if (!root) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const elements = Array.from(root.querySelectorAll<HTMLElement>([
      '.site-hero__content',
      '.sites-service-hero__content',
      '.product-preview',
      '.section-heading',
      '.benefit-card',
      '.sites-benefit-card',
      '.sites-offer-card',
      '.sites-model-card',
      '.sites-service-preview',
      '.sites-process li',
      '.sites-combo',
      '.workflow-list li',
      '.payment-flow-card',
      '.plan-card',
      '.support-card',
      '.contact-card',
      '.faq-list details',
      '.legal-content',
      '.signup-panel',
      '.checkout-card',
      '.final-cta__card',
    ].join(',')))

    elements.forEach((element, index) => {
      element.classList.add('site-reveal')
      element.style.setProperty('--reveal-delay', `${Math.min(index % 4, 3) * 70}ms`)
    })

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach(element => element.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -30px' })

    elements.forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [pathname])

  function fecharMenu() {
    setMenuAberto(false)
  }

  return (
    <div className="public-shell" data-theme={theme}>
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
              <ThemeToggle theme={theme} onToggle={() => setTheme(current => current === 'light' ? 'dark' : 'light')} />
              <Link to="/login" className="button button--ghost" onClick={fecharMenu}>
                Entrar
              </Link>
              <Link to="/planos" className="button button--primary" onClick={fecharMenu}>
                Fazer parte
              </Link>
            </div>
          </nav>

          <div className="public-header__actions">
            <ThemeToggle theme={theme} onToggle={() => setTheme(current => current === 'light' ? 'dark' : 'light')} />
            <Link to="/login" className="button button--ghost">
              Entrar
            </Link>
            <Link to="/planos" className="button button--primary">
              Fazer parte
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
            <Link to="/demonstracao">Demonstração</Link>
            <Link to="/criacao-de-sites">Criação de Sites</Link>
            <Link to="/planos">Planos</Link>
            <Link to="/cadastro">Fazer parte</Link>
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

function ThemeToggle({ theme, onToggle }: { theme: PublicTheme; onToggle: () => void }) {
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      className="public-theme-toggle"
      onClick={onToggle}
      aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={dark ? 'Usar tema claro' : 'Usar tema escuro'}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {dark ? (
          <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></>
        ) : (
          <path d="M20.4 15.2A8.5 8.5 0 0 1 8.8 3.6 8.5 8.5 0 1 0 20.4 15.2Z" />
        )}
      </svg>
      <span>{dark ? 'Claro' : 'Escuro'}</span>
    </button>
  )
}
