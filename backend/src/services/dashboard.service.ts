import { StatusOrdem } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

type OrdemRecente = {
  id: number
  equipamento: string
  status: StatusOrdem
  criadoEm: Date
  cliente: {
    id: number
    nome: string
  }
}

type Resumo = {
  clientes: {
    total: number
  }
  ordens: {
    total: number
    porStatus: Record<StatusOrdem, number>
    recentes: OrdemRecente[]
  }
}

export async function buscarResumoDashboardService(
  empresaId: number
): Promise<Resumo> {
  // As três consultas são executadas dentro da mesma transação para que o
  // resumo seja montado a partir de uma visão consistente dos dados da empresa.
  const [totalClientes, contagensPorStatus, ordensRecentes] =
    await prisma.$transaction([
      // Conta somente os clientes pertencentes à empresa autenticada.
      prisma.cliente.count({
        where: { empresaId }
      }),

      // Agrupa as ordens pelo status atual. O banco devolve apenas os status
      // que possuem pelo menos uma ordem cadastrada.
      prisma.ordemServico.groupBy({
        by: ["status"],
        where: { empresaId },
        _count: {
          _all: true
        }
      }),

      // Recupera as cinco ordens mais novas para exibição na dashboard.
      // O select limita a resposta aos campos realmente usados pelo resumo.
      prisma.ordemServico.findMany({
        where: { empresaId },
        orderBy: {
          criadoEm: "desc"
        },
        take: 5,
        select: {
          id: true,
          equipamento: true,
          status: true,
          criadoEm: true,
          cliente: {
            select: {
              id: true,
              nome: true
            }
          }
        }
      })
    ])

  // Cria todas as chaves do enum começando em zero. Isso garante que a API
  // também retorne status que ainda não possuem nenhuma ordem.
  const porStatus = Object.fromEntries(
    Object.values(StatusOrdem).map(status => [status, 0])
  ) as Record<StatusOrdem, number>

  // Substitui o zero pela quantidade retornada pelo agrupamento do Prisma.
  for (const contagem of contagensPorStatus) {
    porStatus[contagem.status] = contagem._count._all
  }

  // Soma todas as quantidades para evitar uma consulta adicional ao banco.
  const totalOrdens = Object.values(porStatus).reduce(
    (total, quantidade) => total + quantidade,
    0
  )

  // Organiza o resultado no contrato que será consumido pelo frontend.
  return {
    clientes: {
      total: totalClientes
    },
    ordens: {
      total: totalOrdens,
      porStatus,
      recentes: ordensRecentes
    }
  }
}
