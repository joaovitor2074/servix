import { LoginForm } from "../components/LoginForm"
import type { UsuarioAutenticado } from "../types/auth.types"

interface LoginPropsForm{
   onLogin:(usuario:UsuarioAutenticado) => void
}


const LoginPage = ({onLogin}:LoginPropsForm) => {
    return (
        <LoginForm onLogin={onLogin} />
    )
}

export default LoginPage
