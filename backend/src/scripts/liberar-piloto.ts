import "../config/load-env.js"

import { StatusEmpresa } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

const UM_DIA_MS = 24 * 60 * 60 * 1_000

async function executar() {
  const slug = process.argv[2]?.trim().toLowerCase()
  const dias = Number(process.argv[3] ?? "30")

  if (!slug) {
    throw new Error("Uso: npm run empresa:piloto -- <slug> [dias]")
  }
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
    throw new Error("O prazo do piloto deve ser um numero inteiro entre 1 e 365 dias.")
  }

  const empresa = await prisma.empresa.findUnique({
    where: { slug },
    select: { id: true, nome: true, assinatura: { select: { id: true } } }
  })

  if (!empresa) throw new Error(`Empresa nao encontrada: ${slug}`)
  if (!empresa.assinatura) {
    throw new Error("A empresa nao possui o registro interno de assinatura.")
  }

  const acessoPilotoAte = new Date(Date.now() + dias * UM_DIA_MS)
  await prisma.$transaction([
    prisma.assinaturaEmpresa.update({
      where: { empresaId: empresa.id },
      data: { acessoPilotoAte }
    }),
    prisma.empresa.update({
      where: { id: empresa.id },
      data: { status: StatusEmpresa.ATIVA }
    })
  ])

  console.log(
    `Piloto liberado para ${empresa.nome} (${slug}) ate ${acessoPilotoAte.toISOString()}.`
  )
}

executar()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
