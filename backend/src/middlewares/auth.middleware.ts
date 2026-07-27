import type { NextFunction, Request, Response } from "express"
import jsonwebtoken, { type JwtPayload } from "jsonwebtoken"
import { prisma } from "../lib/prisma.js"
import { obterJwtSecret } from "../config/env.js"
import { PapelUsuario, StatusEmpresa } from "../generated/prisma/enums.js"
import type { PapelUsuario as PapelUsuarioType } from "../generated/prisma/enums.js"

// Autentica a requisição em três etapas: extrai o Bearer token, valida o JWT e
// confirma no banco que o usuário continua ativo. A consulta ao banco impede
// que um token antigo mantenha acesso após a desativação da conta.
async function autenticarComPolitica(
  req: Request,
  res: Response,
  next: NextFunction,
  exigirEmpresaAtiva: boolean,
  exigirAdministrador: boolean
) {
  const authorization = req.headers.authorization

  // O formato esperado é: Authorization: Bearer <token>.
  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token de acesso não informado" })
  }

  const token = authorization.slice("Bearer ".length).trim()
  let payload: JwtPayload

  try {
    // `issuer` e `audience` precisam ser iguais aos usados na criação do token.
    const resultado = jsonwebtoken.verify(
      token,
      obterJwtSecret(),
      {
        issuer: "servix",
        audience: "servix-api"
      }
    )
    if (typeof resultado === "string") {
      return res.status(401).json({
        erro: "Token de acesso inválido"
      })
    }
    payload = resultado
  } catch {
    return res.status(401).json({ erro: "Token de acesso inválido ou expirado" })
  }

  const usuarioId = Number(payload.sub)

  // O `subject` do JWT representa o ID do usuário e precisa ser inteiro positivo.
  if(!Number.isInteger(usuarioId)|| usuarioId <= 0){
    return res.status(401).json({
      erro: "Token de acesso invalido"
    })
  }

  try{
    // Não confiamos somente nos dados do token: papel, empresa e situação atual
    // são carregados novamente do banco antes de liberar a requisição.
    const usuario = await prisma.usuario.findUnique({
      where:{
        id:usuarioId
      },
      select:{
        id:true,
        empresaId:true,
        papel:true,
        ativo:true,
        empresa: {
          select: {
            status: true
          }
        }
      }
    })

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({
        erro: "Usuário inativo ou não encontrado"
      })
    }

    // A validade do JWT não substitui a situação comercial atual da empresa.
    // Consultar o status em toda requisição encerra imediatamente o acesso de
    // sessões emitidas antes de uma assinatura ser pausada ou cancelada.
    if (exigirEmpresaAtiva && usuario.empresa.status !== StatusEmpresa.ATIVA) {
      return res.status(403).json({
        erro: "Acesso suspenso porque a assinatura da empresa não está ativa.",
        codigo: "EMPRESA_SUSPENSA",
        detalhes: {
          statusEmpresa: usuario.empresa.status
        }
      })
    }

    if (exigirAdministrador && usuario.papel !== PapelUsuario.ADMIN) {
      return res.status(403).json({
        erro: "Somente o administrador pode recuperar a assinatura.",
        codigo: "RECUPERACAO_ASSINATURA_NAO_AUTORIZADA"
      })
    }

    // Controllers de rotas protegidas passam a acessar esses valores tipados.
    req.auth = {
      usuarioId:usuario.id,
      empresaId:usuario.empresaId,
      papel:usuario.papel
    }

    return next()
  }catch(error){
    return next(error)
  }
}

export function autenticar(req: Request, res: Response, next: NextFunction) {
  return autenticarComPolitica(req, res, next, true, false)
}

// Valida usuário e JWT, mas permite ler o status comercial atual. É usado por
// /auth/me para que o frontend encaminhe uma empresa suspensa ao portal certo.
export function autenticarSessao(
  req: Request,
  res: Response,
  next: NextFunction
) {
  return autenticarComPolitica(req, res, next, false, false)
}

// Esta política nunca libera as APIs internas. Ela existe somente nas rotas
// fechadas de recuperação da assinatura e exige o papel ADMIN.
export function autenticarRecuperacaoAssinatura(
  req: Request,
  res: Response,
  next: NextFunction
) {
  return autenticarComPolitica(req, res, next, false, true)
}

// Cria um middleware de autorização reutilizável. Autenticação responde "quem
// é o usuário"; autorização decide "o que esse usuário pode fazer".
export function autorizar(...papeisPermitidos: PapelUsuarioType[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (!papeisPermitidos.includes(req.auth.papel)) {
      return res.status(403).json({
        erro: "Usuário não possui permissão para esta operação"
      })
    }

    return next()
  }

}
