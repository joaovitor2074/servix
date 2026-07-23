import { LoginForm } from "../components/LoginForm"
import type { UsuarioAutenticado } from "../types/auth.types"
import servixLogo from '../../../assets/brand/servix-logo.svg'
import './LoginPage.css'
import { AuthLayout } from '../../../shared/layouts/AuthLayout'
import { Link } from 'react-router'

interface LoginPropsForm{
   onLogin:(usuario:UsuarioAutenticado) => void
}


const LoginPage = ({ onLogin }: LoginPropsForm) => {
  return (
    <AuthLayout>
      <div className="login-page">
        <header className="login-page__header">
          <Link to="/" className="login-page__back">
            <span aria-hidden="true">←</span> Voltar ao site
          </Link>
          <img
            className="login-page__logo"
            src={servixLogo}
            alt="Servix"
          />

          <h1 id="login-page-title">Acesse sua conta</h1>
          <p className="login-page__description">
            Gerencie ordens de serviço, clientes e atendimentos em um só lugar.
          </p>
        </header>

        <section
          className="login-page__card"
          aria-labelledby="login-page-title"
        >
          <LoginForm onLogin={onLogin} />
        </section>

        <nav className="login-page__public-links" aria-label="Acesso público">
          <span>Ainda não usa o Servix?</span>
          <Link to="/cadastro">Criar conta de teste</Link>
          <Link to="/">Conhecer o site</Link>
        </nav>
      </div>
    </AuthLayout>
  )
}

export default LoginPage
