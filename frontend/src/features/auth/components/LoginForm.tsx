import { useState, type FormEvent } from 'react'
import { loginSchema } from '../schemas/login.schema'
import { login as realizarLogin } from '../services/auth.service'


export function LoginForm() {
    const [erros, setErros] = useState<
        Record<string, string[] | undefined>
    >({})
    const [carregando, setCarregando] = useState(false)
    const [erroLogin, setErroLogin] = useState('')

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

            console.log('Usuário autenticado:', resposta.usuario)
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
        <form onSubmit={handleSubmit}>
            <div>
                <label htmlFor="empresaSlug">Empresa</label>
                <input
                    id="empresaSlug"
                    name="empresaSlug"
                    type="text"
                />
            </div>
            {erros.empresaSlug?.[0] && <span>{erros.empresaSlug[0]}</span>}

            <div>
                <label htmlFor="email">E-mail</label>
                <input
                    id="email"
                    name="email"
                    type="email"
                />
            </div>
            {erros.email?.[0] && (<span>{erros.email[0]}</span>)}

            <div>
                <label htmlFor="senha">Senha</label>
                <input
                    id="senha"
                    name="senha"
                    type="password"
                />
            </div>
            {erros.senha?.[0] && <span>{erros.senha[0]}</span>}
            {erroLogin && <p role="alert">{erroLogin}</p>}
            <button type="submit" disabled={carregando}>{carregando ? 'Entrando...' : 'Entrar'}</button>
        </form>
    )
}