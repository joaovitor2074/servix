import type { Prisma } from "../generated/prisma/client.js"
import { StatusGarantia } from "../generated/prisma/enums.js"
import { AppError } from "../errors/app-error.js"
import { prisma } from "../lib/prisma.js"

export const DIAS_GARANTIA_PADRAO = 90
export const TERMOS_GARANTIA_PADRAO = "A garantia cobre exclusivamente o serviço e as peças descritas na ordem. Não cobre danos por queda, líquido, mau uso, violação por terceiros ou defeitos diferentes do reparo realizado."

export async function criarGarantiaDaEntregaTx(
  tx: Prisma.TransactionClient,
  dados: { ordemId: number; empresaId: number; usuarioId: number; inicioEm?: Date }
) {
  const inicioEm = dados.inicioEm ?? new Date()
  const expiraEm = new Date(inicioEm)
  expiraEm.setUTCDate(expiraEm.getUTCDate() + DIAS_GARANTIA_PADRAO)

  return tx.garantiaServico.upsert({
    where: { ordemId_empresaId: { ordemId: dados.ordemId, empresaId: dados.empresaId } },
    create: {
      empresaId: dados.empresaId,
      ordemId: dados.ordemId,
      dias: DIAS_GARANTIA_PADRAO,
      inicioEm,
      expiraEm,
      termos: TERMOS_GARANTIA_PADRAO,
      registradoPorId: dados.usuarioId
    },
    update: {}
  })
}

const garantiaInclude = {
  ordem: {
    select: {
      id: true,
      numero: true,
      equipamento: true,
      servicoRealizado: true,
      valor: true,
      cliente: { select: { id: true, nome: true, telefone: true } }
    }
  },
  registradoPor: { select: { id: true, nome: true } }
} as const

function apresentarGarantia<T extends { status: StatusGarantia; expiraEm: Date }>(garantia: T) {
  return {
    ...garantia,
    statusExibicao: garantia.status === StatusGarantia.ATIVA && garantia.expiraEm < new Date()
      ? "EXPIRADA"
      : garantia.status
  }
}

export async function listarGarantiasService(
  empresaId: number,
  filtros: { busca?: string | undefined; status?: StatusGarantia | undefined }
) {
  const garantias = await prisma.garantiaServico.findMany({
    where: {
      empresaId,
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.busca ? {
        OR: [
          { codigo: { contains: filtros.busca, mode: "insensitive" } },
          { ordem: { equipamento: { contains: filtros.busca, mode: "insensitive" } } },
          { ordem: { cliente: { nome: { contains: filtros.busca, mode: "insensitive" } } } }
        ]
      } : {})
    },
    include: garantiaInclude,
    orderBy: { criadoEm: "desc" }
  })
  return garantias.map(apresentarGarantia)
}

export async function buscarGarantiaService(id: number, empresaId: number) {
  const garantia = await prisma.garantiaServico.findUnique({
    where: { id_empresaId: { id, empresaId } },
    include: {
      ...garantiaInclude,
      empresa: { select: { nome: true, telefone: true, email: true, cpfCnpj: true } }
    }
  })
  return garantia ? apresentarGarantia(garantia) : null
}

export async function acionarGarantiaService(
  id: number,
  empresaId: number,
  observacao: string
) {
  const garantia = await prisma.garantiaServico.findUnique({
    where: { id_empresaId: { id, empresaId } },
    select: { status: true, expiraEm: true }
  })
  if (!garantia) throw new AppError("Garantia não encontrada.", 404, "GARANTIA_NAO_ENCONTRADA")
  if (garantia.status !== StatusGarantia.ATIVA || garantia.expiraEm < new Date()) {
    throw new AppError("Esta garantia não está ativa.", 409, "GARANTIA_INATIVA")
  }
  return prisma.garantiaServico.update({
    where: { id_empresaId: { id, empresaId } },
    data: {
      status: StatusGarantia.UTILIZADA,
      acionadaEm: new Date(),
      observacaoAcionamento: observacao
    },
    include: garantiaInclude
  })
}

export async function cancelarGarantiaService(id: number, empresaId: number, observacao: string) {
  const alteracao = await prisma.garantiaServico.updateMany({
    where: { id, empresaId, status: StatusGarantia.ATIVA },
    data: { status: StatusGarantia.CANCELADA, observacaoAcionamento: observacao }
  })
  if (alteracao.count === 0) {
    throw new AppError("Garantia ativa não encontrada.", 404, "GARANTIA_NAO_ENCONTRADA")
  }
  return buscarGarantiaService(id, empresaId)
}
