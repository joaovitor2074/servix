// Estes valores precisam permanecer iguais ao enum StatusOrdem do Prisma.
// O `as const` transforma cada texto em um tipo literal conhecido pelo TS.
export const STATUS_ORDEM = [
  'ABERTA',
  'EM_ANALISE',
  'AGUARDANDO_APROVACAO',
  'APROVADA',
  'EM_ANDAMENTO',
  'AGUARDANDO_PECA',
  'CONCLUIDA',
  'ENTREGUE',
  'CANCELADA',
] as const

export type StatusOrdem = (typeof STATUS_ORDEM)[number]

// Os textos de apresentação ficam centralizados para todas as telas usarem a
// mesma tradução dos status técnicos retornados pela API.
export const STATUS_ORDEM_LABELS: Record<StatusOrdem, string> = {
  ABERTA: 'Aberta',
  EM_ANALISE: 'Em análise',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  APROVADA: 'Aprovada',
  EM_ANDAMENTO: 'Em andamento',
  AGUARDANDO_PECA: 'Aguardando peça',
  CONCLUIDA: 'Concluída',
  ENTREGUE: 'Entregue',
  CANCELADA: 'Cancelada',
}

// O array serve tanto para gerar o select do formulário quanto para manter o
// tipo sincronizado com o enum FormaPagamento definido no Prisma.
export const FORMAS_PAGAMENTO = [
  'NAO_INFORMADA',
  'PIX',
  'DINHEIRO',
  'CARTAO_CREDITO',
  'CARTAO_DEBITO',
  'BOLETO',
  'OUTRO',
] as const

export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  NAO_INFORMADA: 'Não informada',
  PIX: 'Pix',
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  BOLETO: 'Boleto',
  OUTRO: 'Outro',
}

export interface ClienteResumoOrdem {
  id: number
  nome: string
  telefone: string
}

// Representa exatamente uma ordem devolvida por GET /ordens. Datas chegam em
// JSON como strings ISO e o Decimal do Prisma chega como texto.
export interface OrdemServico {
  id: number
  empresaId: number
  clienteId: number
  equipamento: string
  problemaRelatado: string
  diagnostico: string | null
  servicoRealizado: string | null
  pecasUtilizadas: string | null
  tecnicoResponsavel: string | null
  previsaoDeEntrega: string | null
  valor: string
  formaDePagamento: FormaPagamento
  status: StatusOrdem
  criadoEm: string
  atualizadoEm: string
  cliente: ClienteResumoOrdem
}

// Corpo aceito pelo POST /ordens. Campos de diagnóstico e execução não
// aparecem aqui porque pertencem às etapas posteriores do atendimento.
export interface CriarOrdemInput {
  clienteId: number
  equipamento: string
  problemaRelatado: string
  tecnicoResponsavel: string | null
  previsaoDeEntrega: string | null
  valor: number
  formaDePagamento: FormaPagamento
}
