export const SERVIX_PLAN = {
  codigo: 'servix-mensal',
  nome: 'Plano Servix',
  valorMensal: 24.9,
  periodicidade: 'mês',
  ambiente: 'TESTE',
  recursos: [
    'Clientes ilimitados',
    'Orçamentos e ordens de serviço',
    'Link de acompanhamento para o cliente',
    'Usuários da equipe',
    'Dashboard operacional',
    'Suporte Servix',
  ],
} as const

export const SITE_CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL?.trim() || 'suporte.vercel@gmail.com'

export const SITE_SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL?.trim() || 'suporte.vercel@gmail.com'

export const SITE_WHATSAPP_NUMBER = '5599981657937'
export const SITE_WHATSAPP_DISPLAY = '(99) 98165-7937'
export const SITE_INSTAGRAM_URL = 'https://www.instagram.com/servixso/'

export function criarLinkWhatsApp(mensagem: string) {
  return `https://wa.me/${SITE_WHATSAPP_NUMBER}?text=${encodeURIComponent(mensagem)}`
}

export const SITE_LEGAL_NAME = import.meta.env.VITE_LEGAL_NAME?.trim() || ''

export const SITE_LEGAL_DOCUMENT =
  import.meta.env.VITE_LEGAL_DOCUMENT?.trim() || ''

export const SITE_LEGAL_ADDRESS =
  import.meta.env.VITE_LEGAL_ADDRESS?.trim() || ''

export const SITE_DATA_CONTROLLER_NAME =
  import.meta.env.VITE_DATA_CONTROLLER_NAME?.trim() || SITE_LEGAL_NAME

export const SITE_LEGAL_IDENTITY_READY = Boolean(
  SITE_LEGAL_NAME &&
  SITE_LEGAL_DOCUMENT &&
  SITE_LEGAL_ADDRESS &&
  SITE_DATA_CONTROLLER_NAME,
)

export const SITE_LEGAL_IDENTITY_PENDING_MESSAGE =
  'A contratação em produção está temporariamente indisponível enquanto a identificação pública do fornecedor é concluída.'

export function formatarMoeda(valor: number | string) {
  const valorNumerico = typeof valor === 'string' ? Number(valor) : valor

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(valorNumerico) ? valorNumerico : 0)
}
