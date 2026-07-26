export interface CadastroEmpresaInput {
  nome: string
  slug: string
  telefone?: string
  email?: string
  tipoNegocio: string
  cpfCnpj: string
  cidade: string
  estado: string
  endereco?: string
  planoCodigo: 'servix-mensal'
  aceitouTermos: true
  administrador: {
    nome: string
    email: string
    telefone: string
    senha: string
  }
}

export interface EmpresaAssinante {
  id?: number
  nome: string
  slug: string
  email?: string | null
}

export interface AssinaturaResumo {
  checkoutToken: string
  planoCodigo: string
  planoNome: string
  valorMensal: number | string
  ambiente: string
  status: string
  proximaCobranca?: string | null
}

export interface CheckoutData {
  empresa: EmpresaAssinante
  assinatura: AssinaturaResumo
}

export interface CheckoutHospedadoData {
  checkoutUrl: string
  status: string
}

export type CadastroEmpresaResponse = CheckoutData
