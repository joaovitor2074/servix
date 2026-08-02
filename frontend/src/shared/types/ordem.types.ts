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
  mensagemPublica?: string | null
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

export interface EmpresaDaOrdem {
  nome: string
  telefone: string | null
  email: string | null
  cpfCnpj: string | null
  endereco: string | null
  cidade: string | null
  estado: string | null
}

export interface GarantiaDaOrdem {
  id: number
  codigo: string
  status: 'ATIVA' | 'UTILIZADA' | 'CANCELADA'
  dias: number
  inicioEm: string
  expiraEm: string
  termos: string
}

export const ITENS_CHECKLIST_ENTRADA = [
  'TELA_TRINCADA',
  'RISCOS',
  'AMASSADOS',
  'MARCAS_DE_QUEDA',
  'SINAIS_DE_LIQUIDO',
  'NAO_LIGA',
] as const

export type ItemChecklistEntrada = (typeof ITENS_CHECKLIST_ENTRADA)[number]

export interface TecnicoResponsavelResumo {
  id: number
  nome: string
  papel: 'ADMIN' | 'ATENDENTE' | 'TECNICO'
  ativo: boolean
}

// Representa exatamente uma ordem devolvida por GET /ordens. Datas chegam em
// JSON como strings ISO e o Decimal do Prisma chega como texto.
export interface OrdemServico {
  id: number
  numero: number
  empresaId: number
  clienteId: number
  orcamentoId: number
  equipamento: string
  problemaRelatado: string
  marcaAparelho: string | null
  modeloAparelho: string | null
  imei: string | null
  numeroSerie: string | null
  corAparelho: string | null
  capacidadeAparelho: string | null
  acessoriosEntrada: string | null
  checklistEntrada: ItemChecklistEntrada[]
  defeitosVisiveis: string | null
  aparelhoJaAberto: boolean | null
  aceiteClienteEm: string | null
  possuiCredencialAcesso: boolean
  podeRevelarCredencial?: boolean
  credencialAcessoAtualizadaEm: string | null
  diagnostico: string | null
  servicoRealizado: string | null
  pecasUtilizadas: string | null
  tecnicoResponsavel: string | null
  tecnicoResponsavelId: number | null
  tecnicoResponsavelUsuario?: TecnicoResponsavelResumo | null
  previsaoDeEntrega: string | null
  valor: string
  formaDePagamento: FormaPagamento
  status: StatusOrdem
  tokenAcompanhamento?: string | null
  versao: number
  criadoEm: string
  atualizadoEm: string
  cliente: ClienteResumoOrdem
  orcamento: OrcamentoDaOrdem
  pagamentoResumo?: ResumoPagamentoOrdem
  garantia?: GarantiaDaOrdem | null
  empresa?: EmpresaDaOrdem | null
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
  marcaAparelho?: string | null
  modeloAparelho?: string | null
  imei?: string | null
  numeroSerie?: string | null
  corAparelho?: string | null
  capacidadeAparelho?: string | null
  acessoriosEntrada?: string | null
  checklistEntrada?: ItemChecklistEntrada[]
  defeitosVisiveis?: string | null
  aparelhoJaAberto?: boolean | null
  aceiteCliente?: boolean
  credencialAcesso?: string | null
  tecnicoResponsavel?: string | null
  tecnicoResponsavelId?: number | null
  previsaoDeEntrega?: string | null
  status?: StatusOrdem
  mensagemPublica?: string
}
