export const VERSAO_TERMOS_SERVIX = "2026-07-23"

export const PLANO_SERVIX_MENSAL = {
  codigo: "servix-mensal",
  nome: "Plano Servix",
  descricao: "Gestao completa para empresas de servicos.",
  valorMensal: "79.90",
  moeda: "BRL",
  recursos: [
    "Clientes ilimitados",
    "Ordens de servico",
    "Links de acompanhamento",
    "Usuarios da equipe",
    "Dashboard",
    "Suporte"
  ]
} as const

export function buscarPlanoServix(codigo: string) {
  return codigo === PLANO_SERVIX_MENSAL.codigo
    ? PLANO_SERVIX_MENSAL
    : null
}
