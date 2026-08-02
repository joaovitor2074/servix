export type PapelUsuario =
    |"ADMIN" | "ATENDENTE" | "TECNICO"

export interface LoginInput {
    empresaSlug:string
    email:string
    senha:string
}

export interface EmpresaResumo{
    id:number
    nome:string
    slug:string
    status:'PENDENTE_ASSINATURA' | 'ATIVA' | 'SUSPENSA'
    acesso?: ResumoAcessoEmpresa
}

export interface ResumoAcessoEmpresa {
    tipo:'ASSINATURA' | 'TESTE_GRATUITO' | 'PILOTO' | 'LIBERADO_MANUALMENTE' | 'BLOQUEADO'
    ativo:boolean
    diasRestantes:number | null
    expiraEm:string | null
}

export interface UsuarioAutenticado{
    id:number
    nome:string
    email:string
    papel:PapelUsuario
    empresa:EmpresaResumo
}

export interface LoginResponse{
    token:string
    expiresIn:number
    usuario:UsuarioAutenticado
}
