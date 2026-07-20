// src/scripts/resetar-senha.ts

import { hash } from "bcryptjs"

import { prisma } from "../lib/prisma.js"

// Script local de manutenção para redefinir a senha de uma conta específica.
// Antes de uso real, substitua os valores fixos por variáveis de ambiente para
// não manter credenciais conhecidas no código-fonte.
async function main() {
  const novaSenha = "12345678"
  const senhaHash = await hash(novaSenha, 10)

  const usuario = await prisma.usuario.findFirst({
    where: {
      email: "admin@servix.local",
      empresa: {
        slug: "admin-servix"
      }
    }
  })

  if (!usuario) {
    throw new Error("Usuário não encontrado")
  }

  await prisma.usuario.update({
    where: {
      id: usuario.id
    },
    data: {
      senhaHash
    }
  })

  console.log(`Senha redefinida para: ${novaSenha}`)
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    // Libera o pool de conexões mesmo quando a atualização falha.
    await prisma.$disconnect()
  })
