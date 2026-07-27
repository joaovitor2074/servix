import { obterToken } from "../utils/token-storage";

const API_URL = (
    import.meta.env.VITE_API_URL ?? 'http://localhost:3005'
).trim().replace(/\/+$/, '')

export async function apiFetch(
    caminho:string,
    opcoes:RequestInit = {},
){
    const token = obterToken()
    const headers = new Headers(opcoes.headers)

    headers.set('Content-Type', 'application/json')

    if(token){
        headers.set('Authorization', `Bearer ${token}`)
    }

    const caminhoNormalizado = caminho.startsWith('/')
        ? caminho
        : `/${caminho}`

    const resposta = await fetch(`${API_URL}${caminhoNormalizado}`,{
        ...opcoes,
        headers,
    })

    if (resposta.status === 403) {
        const corpo = await resposta
            .clone()
            .json()
            .catch(() => null) as { codigo?: unknown } | null

        if (corpo?.codigo === 'EMPRESA_SUSPENSA') {
            if (
                typeof window !== 'undefined' &&
                window.location.pathname !== '/assinatura-suspensa'
            ) {
                window.location.replace('/assinatura-suspensa')
            }
        }
    }

    return resposta
}
