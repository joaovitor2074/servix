export const SERVIX_PLAN = {
  codigo: 'servix-mensal',
  nome: 'Plano Servix',
  valorMensal: 79.9,
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

export function formatarMoeda(valor: number | string) {
  const valorNumerico = typeof valor === 'string' ? Number(valor) : valor

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(valorNumerico) ? valorNumerico : 0)
}
