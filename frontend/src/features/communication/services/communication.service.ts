import { apiFetch } from '../../../shared/services/api'
import type {
  CentralWhatsApp,
  OrigemMensagemWhatsApp,
  ResultadoEnvioWhatsApp,
} from '../types/communication.types'

export async function buscarCentralWhatsApp(signal?: AbortSignal) {
  const resposta = await apiFetch('/comunicacao/whatsapp', { signal })
  const corpo = await resposta.json().catch(() => null) as CentralWhatsApp | { erro?: string } | null
  if (!resposta.ok) throw new Error(corpo && 'erro' in corpo ? corpo.erro : 'Não foi possível carregar as mensagens')
  return corpo as CentralWhatsApp
}

export async function enviarMensagemWhatsApp(origem: OrigemMensagemWhatsApp, referenciaId: number) {
  const resposta = await apiFetch('/comunicacao/whatsapp/enviar', {
    method: 'POST',
    body: JSON.stringify({ origem, referenciaId }),
  })
  const corpo = await resposta.json().catch(() => null) as ResultadoEnvioWhatsApp | { erro?: string } | null
  if (!resposta.ok) throw new Error(corpo && 'erro' in corpo ? corpo.erro : 'Não foi possível preparar a mensagem.')
  return corpo as ResultadoEnvioWhatsApp
}
