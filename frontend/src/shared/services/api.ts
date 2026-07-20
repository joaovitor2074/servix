import { obterToken } from "../utils/token-storage";

const API_URL =
    import.meta.env.VITE_API_URL ?? 'http://localhost:3005'

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

    return fetch(`${API_URL}${caminho}`,{
        ...opcoes,
        headers,
    })
}
