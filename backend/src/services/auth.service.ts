import { compare } from "bcryptjs"
import jsonwebtoken from "jsonwebtoken"

import { obterJwtSecret } from "../config/env.js"
import { prisma } from "../lib/prisma.js"
import type { LoginInput } from "../validators/auth.validators.js"

export async function autenticarUsuarioService(dados: LoginInput) {
  const usuario = await prisma.usuario.findFirst({
    where: {
      email: dados.email,
      ativo: true,
      empresa: {
        slug: dados.empresaSlug
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

  if (!usuario || !(await compare(dados.senha, usuario.senhaHash))) {
    return null
  }

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

export function buscarUsuarioAutenticadoService(
  usuarioId: number,
  empresaId: number
) {
  return prisma.usuario.findFirst({
    where: {
      id: usuarioId,
      empresaId,
      ativo: true
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
