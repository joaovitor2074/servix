export type Cliente = {
  id: number
  nome: string
  telefone: string
  email?: string
  cpfCnpj?: string
  endereco?: string
  observacoes?: string
  historicoDePecas?: string
  criadoEm: Date
}