import { apiFetch } from '../../../../shared/services/api'
import type {
  AtualizarUsuarioInput,
  CriarUsuarioInput,
  ListaUsuarios,
  UsuarioEmpresa,
} from '../types/user-settings.types'

export async function listarUsuarios(busca = '', signal?: AbortSignal): Promise<ListaUsuarios> {
  const parametros = new URLSearchParams({ pagina: '1', limite: '100' })
  if (busca.trim()) parametros.set('busca', busca.trim())

  const resposta = await apiFetch(`/usuarios?${parametros.toString()}`, { signal })
  const corpo = await lerJson(resposta)
  if (!resposta.ok) throw new Error(mensagemErro(corpo, 'Não foi possível carregar os usuários.'))

  if (!ehRegistro(corpo) || !Array.isArray(corpo.dados)) {
    throw new Error('O servidor retornou uma lista de usuários inválida.')
  }

  const paginacao = ehRegistro(corpo.paginacao) ? corpo.paginacao : {}
  return {
    dados: corpo.dados.map(normalizarUsuario),
    paginacao: {
      pagina: lerNumero(paginacao.pagina, 1),
      limite: lerNumero(paginacao.limite, 100),
      total: lerNumero(paginacao.total, corpo.dados.length),
      totalPaginas: lerNumero(paginacao.totalPaginas, 1),
    },
  }
}

export async function criarUsuario(dados: CriarUsuarioInput) {
  return enviarUsuario('/usuarios', 'POST', dados)
}

export async function atualizarUsuario(id: number, dados: AtualizarUsuarioInput) {
  return enviarUsuario(`/usuarios/${id}`, 'PATCH', dados)
}

export async function alterarSituacaoUsuario(id: number, ativo: boolean) {
  return enviarUsuario(`/usuarios/${id}/ativo`, 'PATCH', { ativo })
}

export async function redefinirSenhaUsuario(id: number, senha: string) {
  const resposta = await apiFetch(`/usuarios/${id}/senha`, {
    method: 'PATCH',
    body: JSON.stringify({ senha }),
  })
  if (resposta.ok) return
  const corpo = await lerJson(resposta)
  throw new Error(mensagemErro(corpo, 'Não foi possível redefinir a senha.'))
}

async function enviarUsuario(
  caminho: string,
  metodo: 'POST' | 'PATCH',
  dados: CriarUsuarioInput | AtualizarUsuarioInput | { ativo: boolean },
) {
  const resposta = await apiFetch(caminho, {
    method: metodo,
    body: JSON.stringify(dados),
  })
  const corpo = await lerJson(resposta)
  if (!resposta.ok) throw new Error(mensagemErro(corpo, 'Não foi possível salvar o usuário.'))
  return normalizarUsuario(corpo)
}

function normalizarUsuario(valor: unknown): UsuarioEmpresa {
  if (!ehRegistro(valor)) throw new Error('O servidor retornou um usuário inválido.')

  const papel = valor.papel === 'ADMIN' || valor.papel === 'TECNICO'
    ? valor.papel
    : 'ATENDENTE'

  return {
    id: lerNumero(valor.id, 0),
    nome: lerTexto(valor.nome, 'Usuário'),
    email: lerTexto(valor.email, ''),
    telefone: typeof valor.telefone === 'string' && valor.telefone.trim()
      ? valor.telefone.trim()
      : null,
    papel,
    ativo: valor.ativo === true,
    criadoEm: lerTexto(valor.criadoEm, new Date().toISOString()),
    atualizadoEm: lerTexto(valor.atualizadoEm, new Date().toISOString()),
  }
}

async function lerJson(resposta: Response): Promise<unknown> {
  if (resposta.status === 204) return null
  try { return await resposta.json() } catch { return null }
}

function mensagemErro(corpo: unknown, fallback: string) {
  return ehRegistro(corpo) && typeof corpo.erro === 'string' ? corpo.erro : fallback
}

function lerTexto(valor: unknown, fallback: string) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : fallback
}

function lerNumero(valor: unknown, fallback: number) {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : fallback
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}
