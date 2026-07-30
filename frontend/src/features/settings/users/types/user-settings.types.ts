import type { PapelUsuario } from '../../../auth/types/auth.types'

export interface UsuarioEmpresa {
  id: number
  nome: string
  email: string
  telefone: string | null
  papel: PapelUsuario
  ativo: boolean
  criadoEm: string
  atualizadoEm: string
}

export interface CriarUsuarioInput {
  nome: string
  email: string
  telefone?: string
  senha: string
  papel: PapelUsuario
}

export interface AtualizarUsuarioInput {
  nome?: string
  email?: string
  telefone?: string | null
  papel?: PapelUsuario
}

export interface ListaUsuarios {
  dados: UsuarioEmpresa[]
  paginacao: {
    pagina: number
    limite: number
    total: number
    totalPaginas: number
  }
}
