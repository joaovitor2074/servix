import type {
    LoginInput,
    LoginResponse,
    UsuarioAutenticado
} from "../types/auth.types"
import { apiFetch } from "../../../shared/services/api"



export async function login(
    dados: LoginInput
): Promise<LoginResponse> {
    const resposta = await apiFetch(`/auth/login`, {
        method: 'POST',
        body: JSON.stringify(dados),
    })

    const corpo = await resposta.json()

    if (!resposta.ok){
        throw new Error(corpo.erro ?? 'nao foi possivel entrar')
    }

    return corpo as LoginResponse
}

export async function buscarUsuarioAtual(): Promise<UsuarioAutenticado>{
    const resposta = await apiFetch('/auth/me')
    const corpo = await resposta.json()

    if(!resposta.ok){
        throw new Error(corpo.erro??'Sessao invalida')
    }

    return corpo as UsuarioAutenticado
}