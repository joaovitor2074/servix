// Estrutura padrão devolvida pelas listagens paginadas do backend.
export interface Paginacao {
  pagina: number
  limite: number
  total: number
  totalPaginas: number
}

// O tipo genérico permite reutilizar o mesmo contrato com ordens, clientes e
// outros recursos que ganharem paginação no futuro.
export interface RespostaPaginada<T> {
  dados: T[]
  paginacao: Paginacao
}
