import { useState, type FormEvent } from 'react'
import { loginSchema } from '../schemas/login.schema'
import { login as realizarLogin } from '../services/auth.service'
import { salvarToken } from '../../../shared/utils/token-storage'
import type { UsuarioAutenticado } from '../types/auth.types'
import './LoginForm.css'


interface LoginFormProps {
    onLogin: (usuario: UsuarioAutenticado) => void
}


export function LoginForm({ onLogin }: LoginFormProps) {
    const [erros, setErros] = useState<
        Record<string, string[] | undefined>
    >({})
    const [carregando, setCarregando] = useState(false)
    const [erroLogin, setErroLogin] = useState('')
    const [mostrarSenha, setMostrarSenha] = useState(false)

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setErroLogin('')

        const formData = new FormData(event.currentTarget)

        const dados = {
            empresaSlug: formData.get('empresaSlug'),
            email: formData.get('email'),
            senha: formData.get('senha'),
        }

        const resultado = loginSchema.safeParse(dados)

        if (!resultado.success) {
            setErros(resultado.error.flatten().fieldErrors)
            return
        }

        setErros({})
        setCarregando(true)

        try {
            const resposta = await realizarLogin(resultado.data)
            salvarToken(resposta.token)
            onLogin(resposta.usuario)
        } catch (erro) {
            if (erro instanceof Error) {
                setErroLogin(erro.message)
            } else {
                setErroLogin('Ocorreu um erro inesperado')
            }
        } finally {
            setCarregando(false)
        }
    }

    return (
        <form className='login-form' onSubmit={handleSubmit} noValidate>
            <div className="login-form__field">
                <label htmlFor="empresaSlug" className='login-form__label'>
                    Empresa
                </label>

                <input
                    type="text"
                    className="login-form__input"
                    id='empresaSlug'
                    name='empresaSlug'
                    placeholder='minha-empresa'
                    autoComplete='organization'
                    autoCapitalize='none'
                    spellCheck={false}
                    aria-invalid={Boolean(erros.empresaSlug?.[0])}
                    aria-describedby={
                        erros.empresaSlug?.[0]
                            ? 'empresaSlug-error'
                            : undefined
                    } />

                {erros.empresaSlug?.[0] && (
                    <span className='login-form__field-error'
                        id='empresaSlug-error'
                        role='alert'>
                        {erros.empresaSlug[0]}
                    </span>
                )}
            </div>
            <div className="login-form__field">
                <label htmlFor="email" className='login-form__label'>
                    E-mail
                </label>

                <input
                    type="email"
                    className="login-form__input"
                    id='email'
                    name='email'
                    placeholder='seu@email.com'
                    autoComplete='username'
                    autoCapitalize='none'
                    spellCheck={false}
                    aria-invalid={Boolean(erros.email?.[0])}
                    aria-describedby={
                        erros.email?.[0]
                            ? 'email-error'
                            : undefined
                    } />

                {erros.email?.[0] && (
                    <span className='login-form__field-error'
                        id='email-error'
                        role='alert'>
                        {erros.email[0]}
                    </span>
                )}
            </div>
            <div className="login-form__field">
                <label htmlFor="senha" className='login-form__label'>
                    Senha
                </label>

                <div className="login-form__password-control">
                    <input
                        type={mostrarSenha ? 'text' : 'password'}
                        className="login-form__input login-form__input--password"
                        id='senha'
                        name='senha'
                        placeholder='Digite sua senha'
                        autoComplete='current-password'
                        aria-invalid={Boolean(erros.senha?.[0])}
                        aria-describedby={
                            erros.senha?.[0]
                                ? 'senha-error'
                                : undefined
                        } />

                    <button
                        className='login-form__password-toggle'
                        type='button'
                        onClick={()=>{
                            setMostrarSenha((valoratual)=>!valoratual)
                        }}
                        aria-label={
                            mostrarSenha
                            ? 'Ocultar senha'
                            : 'Mostrar senha'
                        }

                        aria-controls='senha'
                        aria-pressed={mostrarSenha}>
                            {mostrarSenha ? <EyeOffIcon/>:<EyeIcon/>}
                        </button>
                </div>

                {erros.senha?.[0] && (
                    <span className='login-form__field-error'
                        id='senha-error'
                        role='alert'>
                        {erros.senha[0]}
                    </span>
                )}



            </div>

            {erroLogin && (
                <p className='login-form__api-error' role='alert'>
                    {erroLogin}
                </p>
            )}


            <button
                className="login-form__submit"
                type='submit'
                disabled={carregando}
                aria-busy={carregando}>
                {carregando ? 'Entrando...' : 'Entrar'}
            </button>

            <p className="login-form__help">
                Esqueceu sua senha? Procure o administrador da sua empresa.
            </p>
        </form>
    )
}
function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6S2.25 12 2.25 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A11 11 0 0 1 12 6c6.25 0 9.75 6 9.75 6a17 17 0 0 1-2.1 2.85" />
      <path d="M6.2 6.2C3.65 8 2.25 12 2.25 12S5.75 18 12 18c1.35 0 2.55-.28 3.6-.72" />
      <path d="M9.9 9.9a2.75 2.75 0 0 0 3.9 3.9" />
    </svg>
  )
}
