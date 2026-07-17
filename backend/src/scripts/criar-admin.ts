import "../config/load-env.js"

import { hash } from "bcryptjs"

import { PapelUsuario } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

function variavelObrigatoria(nome: string): string {
  const valor = process.env[nome]?.trim()

  if (!valor) {
    throw new Error(`${nome} não configurada`)
  }

  return valor
}

async function executar() {
  const empresaSlug = variavelObrigatoria("ADMIN_EMPRESA_SLUG").toLowerCase()
  const nome = variavelObrigatoria("ADMIN_NOME")
  const email = variavelObrigatoria("ADMIN_EMAIL").toLowerCase()
  const senha = variavelObrigatoria("ADMIN_SENHA")

  if (senha.length < 8) {
    throw new Error("ADMIN_SENHA deve possuir pelo menos 8 caracteres")
  }

  let empresa = await prisma.empresa.findUnique({
    where: { slug: empresaSlug }
  })

  if (!empresa) {
    const empresaNome = variavelObrigatoria("ADMIN_EMPRESA_NOME")
    empresa = await prisma.empresa.create({
      data: {
        nome: empresaNome,
        slug: empresaSlug
      }
    })
  }

  const senhaHash = await hash(senha, 12)
  const usuario = await prisma.usuario.upsert({
    where: {
      empresaId_email: {
        empresaId: empresa.id,
        email
      }
    },
    create: {
      empresaId: empresa.id,
      nome,
      email,
      senhaHash,
      papel: PapelUsuario.ADMIN
    },
    update: {
      nome,
      senhaHash,
      papel: PapelUsuario.ADMIN,
      ativo: true
    },
    select: {
      id: true,
      nome: true,
      email: true,
      papel: true
    }
  })

  console.log("Administrador configurado:", usuario)
}

executar()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
