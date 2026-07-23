import { compare } from "bcryptjs"
import jsonwebtoken from "jsonwebtoken"

import { obterJwtSecret } from "../config/env.js"
import { StatusEmpresa } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import type { LoginInput } from "../validators/auth.validators.js"

// Procura o usuário pelo par empresa/e-mail. O slug faz parte do login porque o
// mesmo endereço de e-mail pode existir em empresas diferentes.
export async function autenticarUsuarioService(dados: LoginInput) {
  const usuario = await prisma.usuario.findFirst({
    where: {
      email: dados.email,
      ativo: true,
      empresa: {
        slug: dados.empresaSlug,
        status: StatusEmpresa.ATIVA
      }
    },
    include: {
      empresa: {
        select: {
          id: true,
          nome: true,
          slug: true
        }
      }
    }
  })

  // `compare` confronta a senha recebida com o hash bcrypt. A mesma resposta
  // nula para usuário ausente e senha errada evita revelar qual dado falhou.
  if (!usuario || !(await compare(dados.senha, usuario.senhaHash))) {
    return null
  }

  // O ID fica no subject; empresa e papel ficam no payload. Issuer e audience
  // impedem que um token criado para outro sistema seja aceito por esta API.
  const token = jsonwebtoken.sign(
    {
      empresaId: usuario.empresaId,
      papel: usuario.papel
    },
    obterJwtSecret(),
    {
      subject: String(usuario.id),
      expiresIn: "8h",
      issuer: "servix",
      audience: "servix-api"
    }
  )

  return {
    token,
    expiresIn: 8 * 60 * 60,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      empresa: usuario.empresa
    }
  }
}

// Recarrega o usuário para `/auth/me`, garantindo que ele ainda esteja ativo e
// continue pertencendo à empresa contida na autenticação.
export function buscarUsuarioAutenticadoService(
  usuarioId: number,
  empresaId: number
) {
  return prisma.usuario.findFirst({
    where: {
      id: usuarioId,
      empresaId,
      ativo: true,
      empresa: {
        status: StatusEmpresa.ATIVA
      }
    },
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true,
      empresa: {
        select: {
          id: true,
          nome: true,
          slug: true
        }
      }
    }
  })
}
