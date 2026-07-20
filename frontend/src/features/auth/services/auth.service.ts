import type {
    LoginInput,
    LoginResponse,
} from "../types/auth.types"

const API_URL = "http://localhost:3005"

export async function login(
    dados: LoginInput
): Promise<LoginResponse> {
    const resposta = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(dados),
    })

    const corpo = await resposta.json()

    if (!resposta.ok){
        throw new Error(corpo.erro ?? 'nao foi possivel entrar')
    }

    return corpo as LoginResponse
}