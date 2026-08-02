import { apiFetch } from '../../../../shared/services/api'
import type {
  AtualizarConfiguracaoWhatsApp,
  ConfiguracaoWhatsApp,
  TesteConexaoWhatsApp,
} from '../types/whatsapp-settings.types'

async function lerResposta<T>(resposta: Response, mensagemPadrao: string): Promise<T> {
  const corpo = await resposta.json().catch(() => null) as (T & { erro?: string }) | null
  if (!resposta.ok) throw new Error(corpo?.erro ?? mensagemPadrao)
  return corpo as T
}

export async function buscarConfiguracaoWhatsApp(signal?: AbortSignal) {
  const resposta = await apiFetch('/configuracoes/whatsapp', { signal })
  return lerResposta<ConfiguracaoWhatsApp>(resposta, 'Não foi possível carregar as configurações do WhatsApp.')
}

export async function atualizarConfiguracaoWhatsApp(dados: AtualizarConfiguracaoWhatsApp) {
  const resposta = await apiFetch('/configuracoes/whatsapp', {
    method: 'PATCH',
    body: JSON.stringify(dados),
  })
  return lerResposta<ConfiguracaoWhatsApp>(resposta, 'Não foi possível salvar as configurações do WhatsApp.')
}

export async function testarConexaoWhatsApp() {
  const resposta = await apiFetch('/configuracoes/whatsapp/testar', { method: 'POST' })
  return lerResposta<TesteConexaoWhatsApp>(resposta, 'Não foi possível validar a conexão com a Meta.')
}
