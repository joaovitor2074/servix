import { LoginForm } from "../components/LoginForm"
import type { UsuarioAutenticado } from "../types/auth.types"
import servixLogo from '../../../assets/brand/servix-logo.svg'
import './LoginPage.css'
import { AuthLayout } from '../../../shared/layouts/AuthLayout'

interface LoginPropsForm{
   onLogin:(usuario:UsuarioAutenticado) => void
}


const LoginPage = ({ onLogin }: LoginPropsForm) => {
  return (
    <AuthLayout>
      <div className="login-page">
        <header className="login-page__header">
          <img
            className="login-page__logo"
            src={servixLogo}
            alt="Servix"
          />

          <p className="login-page__description">
            Gerencie ordens de serviço, clientes e atendimentos em um só lugar.
          </p>
        </header>

        <section
          className="login-page__card"
          aria-label="Acesso ao sistema"
        >
          <LoginForm onLogin={onLogin} />
        </section>
      </div>
    </AuthLayout>
  )
}

export default LoginPage
