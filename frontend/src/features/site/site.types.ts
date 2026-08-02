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
  testeGratisIniciadoEm?: string | null
  testeGratisExpiraEm?: string | null
  acessoPilotoAte?: string | null
}

export interface ResumoAcessoCadastro {
  tipo: 'TESTE_GRATUITO' | 'PILOTO' | 'ASSINATURA' | 'BLOQUEADO'
  ativo: boolean
  diasRestantes: number | null
  expiraEm: string | null
}

export interface CheckoutData {
  empresa: EmpresaAssinante
  assinatura: AssinaturaResumo
}

export interface CheckoutHospedadoData {
  checkoutUrl: string
  status: string
}

export interface PlanoAssinaturaPublico {
  codigo: string
  nome: string
  valorMensal: number | string
  periodicidade: string
  recursos: string[]
}

export interface CatalogoAssinaturasData {
  ambiente: 'TESTE' | 'PRODUCAO'
  checkoutDisponivel: boolean
  versaoTermos: string
  planos: PlanoAssinaturaPublico[]
}

export type CadastroEmpresaResponse = CheckoutData & {
  acesso: ResumoAcessoCadastro
}
