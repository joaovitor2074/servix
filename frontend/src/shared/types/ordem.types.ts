// Estes valores precisam permanecer iguais ao enum StatusOrdem do Prisma.
// O `as const` transforma cada texto em um tipo literal conhecido pelo TS.
export const STATUS_ORDEM = [
  'RECEBIDO',
  'EM_ANALISE',
  'EM_EXECUCAO',
  'AGUARDANDO_PECA',
  'PRONTO',
  'ENTREGUE',
  'CANCELADO',
] as const

export type StatusOrdem = (typeof STATUS_ORDEM)[number]

// Os textos de apresentação ficam centralizados para todas as telas usarem a
// mesma tradução dos status técnicos retornados pela API.
export const STATUS_ORDEM_LABELS: Record<StatusOrdem, string> = {
  RECEBIDO: 'Recebido',
  EM_ANALISE: 'Em análise',
  EM_EXECUCAO: 'Em execução',
  AGUARDANDO_PECA: 'Aguardando peça',
  PRONTO: 'Pronto',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
}

// Espelha a máquina de estados do backend. O formulário de atualização usa
// esta tabela para mostrar somente os próximos passos permitidos para a ordem.
export const TRANSICOES_STATUS_ORDEM: Record<
  StatusOrdem,
  readonly StatusOrdem[]
> = {
  RECEBIDO: ['EM_ANALISE', 'CANCELADO'],
  EM_ANALISE: ['EM_EXECUCAO', 'CANCELADO'],
  EM_EXECUCAO: ['AGUARDANDO_PECA', 'PRONTO', 'CANCELADO'],
  AGUARDANDO_PECA: ['EM_EXECUCAO', 'CANCELADO'],
  PRONTO: ['ENTREGUE', 'EM_EXECUCAO', 'CANCELADO'],
  ENTREGUE: [],
  CANCELADO: [],
}

// Cada item representa uma mudança de status devolvida pelo endpoint
// GET /ordens/:id/historico, incluindo o usuário que realizou a alteração.
export interface HistoricoStatusOrdem {
  id: number
  ordemId: number
  empresaId: number
  statusAnterior: StatusOrdem | null
  status: StatusOrdem
  alteradoPorId: number | null
  criadoEm: string
  alteradoPor: {
    id: number
    nome: string
    papel: 'ADMIN' | 'ATENDENTE' | 'TECNICO'
  } | null
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

export interface ItemOrcamentoDaOrdem {
  id: number
  descricao: string
  quantidade: number
  valorUnitario: string
  valorTotal: string
  tipo: 'SERVICO' | 'PECA' | 'MATERIAL'
}

export interface OrcamentoDaOrdem {
  id: number
  numero: number
  status: 'RASCUNHO' | 'ENVIADO' | 'APROVADO' | 'REJEITADO' | 'EXPIRADO' | 'CONVERTIDO' | 'CANCELADO'
  total: string
  itens?: ItemOrcamentoDaOrdem[]
}

export interface ResumoPagamentoOrdem {
  status: 'PENDENTE' | 'PARCIAL' | 'PAGO' | 'ESTORNADO'
  valorTotal: string
  totalPago: string
  totalEstornado: string
  saldo: string
}

// Representa exatamente uma ordem devolvida por GET /ordens. Datas chegam em
// JSON como strings ISO e o Decimal do Prisma chega como texto.
export interface OrdemServico {
  id: number
  empresaId: number
  clienteId: number
  orcamentoId: number
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
  versao: number
  criadoEm: string
  atualizadoEm: string
  cliente: ClienteResumoOrdem
  orcamento: OrcamentoDaOrdem
  pagamentoResumo?: ResumoPagamentoOrdem
}

// Corpo aceito pelo POST /ordens. Campos de diagnóstico e execução não
// aparecem aqui porque pertencem às etapas posteriores do atendimento.
// Dados enviados pelo formulário operacional para PATCH /ordens/:id. Campos
// opcionais vazios são normalizados como null para limpar o valor no backend.
export interface AtualizarOrdemInput {
  statusEsperado: StatusOrdem
  versaoEsperada: number
  diagnostico?: string | null
  servicoRealizado?: string | null
  pecasUtilizadas?: string | null
  tecnicoResponsavel?: string | null
  previsaoDeEntrega?: string | null
  status?: StatusOrdem
}
