export type StatusOrdem =
  | "orcamento"
  | "aguardando_aprovacao"
  | "aprovado"
  | "em_andamento"
  | "aguardando_peca"
  | "concluido"
  | "entregue"
  | "cancelado"

export type OrdemServico = {
  id: number
  clienteId: number
  equipamento: string
  problemaRelatado: string
  diagnostico?: string
  servicoRealizado?: string
  pecasUtilizadas?: string
  tecnicoResponsavel: string
  previsaoDeEntrega: string
  valor: number
  formaDePagamento: string
  status: StatusOrdem
  criadoEm: Date
  atualizadoEm: Date
}
