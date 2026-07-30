import type { UsuarioAutenticado } from '../../features/auth/types/auth.types'

const TOKEN_KEY = 'servix:token'
const USER_KEY = 'servix:usuario'

export function salvarSessao(token: string, usuario: UsuarioAutenticado) {
  localStorage.setItem(TOKEN_KEY, token)
  salvarUsuarioEmCache(usuario)
}

export function salvarUsuarioEmCache(usuario: UsuarioAutenticado) {
  localStorage.setItem(USER_KEY, JSON.stringify(usuario))
}

export function obterToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function obterUsuarioEmCache(): UsuarioAutenticado | null {
  try {
    const valor = localStorage.getItem(USER_KEY)
    if (!valor) return null

    const usuario: unknown = JSON.parse(valor)
    return ehUsuarioAutenticado(usuario) ? usuario : null
  } catch {
    return null
  }
}

export function removerToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function ehUsuarioAutenticado(valor: unknown): valor is UsuarioAutenticado {
  if (!ehRegistro(valor) || !ehRegistro(valor.empresa)) return false

  return Number.isInteger(valor.id)
    && typeof valor.nome === 'string'
    && typeof valor.email === 'string'
    && (valor.papel === 'ADMIN' || valor.papel === 'ATENDENTE' || valor.papel === 'TECNICO')
    && Number.isInteger(valor.empresa.id)
    && typeof valor.empresa.nome === 'string'
    && typeof valor.empresa.slug === 'string'
    && (valor.empresa.status === 'ATIVA'
      || valor.empresa.status === 'PENDENTE_ASSINATURA'
      || valor.empresa.status === 'SUSPENSA')
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}
