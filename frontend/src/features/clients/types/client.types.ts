// Representa um cliente exatamente como ele chega das rotas do backend.
// Datas são serializadas como texto ISO quando atravessam a resposta JSON.
export interface Cliente {
  id: number
  empresaId: number
  nome: string
  telefone: string
  email: string | null
  cpfCnpj: string | null
  endereco: string | null
  observacoes: string | null
  criadoEm: string
  atualizadoEm: string
}

// Este é o corpo aceito tanto pelo cadastro quanto pela edição completa.
// Valores nulos permitem limpar campos opcionais que já estavam preenchidos.
export interface ClienteInput {
  nome: string
  telefone: string
  email: string | null
  cpfCnpj: string | null
  endereco: string | null
  observacoes: string | null
}
