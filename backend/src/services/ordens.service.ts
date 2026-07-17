import type { Prisma } from "../generated/prisma/client.js"
import { StatusOrdem } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import { erroPrismaPossuiCodigo } from "../lib/prisma-errors.js"
import type {
  AtualizarOrdemInput,
  CriarOrdemInput,
  ListarOrdensQuery
} from "../validators/ordens.validators.js"

const clienteResumo = {
  select: {
    id: true,
    nome: true,
    telefone: true
  }
} as const

export async function listarOrdensService(
  empresaId: number,
  filtros: ListarOrdensQuery
) {
  const where: Prisma.OrdemServicoWhereInput = {
    empresaId,
    ...(filtros.status ? { status: filtros.status } : {}),
    ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
    ...(filtros.busca
      ? {
          OR: [
            {
              equipamento: {
                contains: filtros.busca,
                mode: "insensitive"
              }
            },
            {
              problemaRelatado: {
                contains: filtros.busca,
                mode: "insensitive"
              }
            },
            {
              cliente: {
                nome: {
                  contains: filtros.busca,
                  mode: "insensitive"
                }
              }
            }
          ]
        }
      : {})
  }

  const skip = (filtros.pagina - 1) * filtros.limite
  const [dados, total] = await prisma.$transaction([
    prisma.ordemServico.findMany({
      where,
      include: { cliente: clienteResumo },
      orderBy: { criadoEm: "desc" },
      skip,
      take: filtros.limite
    }),
    prisma.ordemServico.count({ where })
  ])

  return {
    dados,
    paginacao: {
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,
      totalPaginas: Math.ceil(total / filtros.limite)
    }
  }
}

export function buscarOrdemService(id: number, empresaId: number) {
  return prisma.ordemServico.findUnique({
    where: {
      id_empresaId: {
        id,
        empresaId
      }
    },
    include: { cliente: clienteResumo }
  })
}

export async function criarOrdemService(
  empresaId: number,
  usuarioId: number,
  dados: CriarOrdemInput
) {
  const cliente = await prisma.cliente.findUnique({
    where: {
      id_empresaId: {
        id: dados.clienteId,
        empresaId
      }
    },
    select: { id: true }
  })

  if (!cliente) {
    return {
      sucesso: false as const,
      motivo: "cliente_nao_encontrado" as const
    }
  }

  const ordem = await prisma.$transaction(async tx => {
    const criada = await tx.ordemServico.create({
      data: {
        empresaId,
        clienteId: dados.clienteId,
        equipamento: dados.equipamento,
        problemaRelatado: dados.problemaRelatado,
        ...(dados.diagnostico !== undefined && {
          diagnostico: dados.diagnostico
        }),
        ...(dados.servicoRealizado !== undefined && {
          servicoRealizado: dados.servicoRealizado
        }),
        ...(dados.pecasUtilizadas !== undefined && {
          pecasUtilizadas: dados.pecasUtilizadas
        }),
        ...(dados.tecnicoResponsavel !== undefined && {
          tecnicoResponsavel: dados.tecnicoResponsavel
        }),
        ...(dados.previsaoDeEntrega !== undefined && {
          previsaoDeEntrega: dados.previsaoDeEntrega
        }),
        valor: dados.valor,
        formaDePagamento: dados.formaDePagamento,
        status: dados.status
      },
      include: { cliente: clienteResumo }
    })

    await tx.historicoStatusOrdem.create({
      data: {
        ordemId: criada.id,
        empresaId,
        status: criada.status,
        alteradoPorId: usuarioId
      }
    })

    return criada
  })

  return {
    sucesso: true as const,
    ordem
  }
}

export async function atualizarOrdemService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: AtualizarOrdemInput
) {
  const ordemExistente = await buscarOrdemService(id, empresaId)

  if (!ordemExistente) {
    return {
      sucesso: false as const,
      motivo: "ordem_nao_encontrada" as const
    }
  }

  if (dados.clienteId !== undefined) {
    const cliente = await prisma.cliente.findUnique({
      where: {
        id_empresaId: {
          id: dados.clienteId,
          empresaId
        }
      },
      select: { id: true }
    })

    if (!cliente) {
      return {
        sucesso: false as const,
        motivo: "cliente_nao_encontrado" as const
      }
    }
  }

  const data: Prisma.OrdemServicoUncheckedUpdateInput = {
    ...(dados.clienteId !== undefined && { clienteId: dados.clienteId }),
    ...(dados.equipamento !== undefined && {
      equipamento: dados.equipamento
    }),
    ...(dados.problemaRelatado !== undefined && {
      problemaRelatado: dados.problemaRelatado
    }),
    ...(dados.diagnostico !== undefined && {
      diagnostico: dados.diagnostico
    }),
    ...(dados.servicoRealizado !== undefined && {
      servicoRealizado: dados.servicoRealizado
    }),
    ...(dados.pecasUtilizadas !== undefined && {
      pecasUtilizadas: dados.pecasUtilizadas
    }),
    ...(dados.tecnicoResponsavel !== undefined && {
      tecnicoResponsavel: dados.tecnicoResponsavel
    }),
    ...(dados.previsaoDeEntrega !== undefined && {
      previsaoDeEntrega: dados.previsaoDeEntrega
    }),
    ...(dados.valor !== undefined && { valor: dados.valor }),
    ...(dados.formaDePagamento !== undefined && {
      formaDePagamento: dados.formaDePagamento
    }),
    ...(dados.status !== undefined && { status: dados.status })
  }

  const ordem = await prisma.$transaction(async tx => {
    const atualizada = await tx.ordemServico.update({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      data,
      include: { cliente: clienteResumo }
    })

    if (
      dados.status !== undefined &&
      dados.status !== ordemExistente.status
    ) {
      await tx.historicoStatusOrdem.create({
        data: {
          ordemId: id,
          empresaId,
          status: dados.status,
          alteradoPorId: usuarioId
        }
      })
    }

    return atualizada
  })

  return {
    sucesso: true as const,
    ordem
  }
}

export async function alterarStatusOrdemService(
  id: number,
  empresaId: number,
  usuarioId: number,
  status: StatusOrdem
) {
  const ordemExistente = await buscarOrdemService(id, empresaId)

  if (!ordemExistente) {
    return {
      sucesso: false as const,
      motivo: "ordem_nao_encontrada" as const
    }
  }

  if (ordemExistente.status === status) {
    return {
      sucesso: true as const,
      ordem: ordemExistente
    }
  }

  const ordem = await prisma.$transaction(async tx => {
    const atualizada = await tx.ordemServico.update({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      data: { status },
      include: { cliente: clienteResumo }
    })

    await tx.historicoStatusOrdem.create({
      data: {
        ordemId: id,
        empresaId,
        status,
        alteradoPorId: usuarioId
      }
    })

    return atualizada
  })

  return {
    sucesso: true as const,
    ordem
  }
}

export async function listarHistoricoOrdemService(
  id: number,
  empresaId: number
) {
  const ordem = await prisma.ordemServico.findUnique({
    where: {
      id_empresaId: {
        id,
        empresaId
      }
    },
    select: { id: true }
  })

  if (!ordem) {
    return null
  }

  return prisma.historicoStatusOrdem.findMany({
    where: {
      ordemId: id,
      empresaId
    },
    include: {
      alteradoPor: {
        select: {
          id: true,
          nome: true,
          papel: true
        }
      }
    },
    orderBy: { criadoEm: "asc" }
  })
}

export async function removerOrdemService(
  id: number,
  empresaId: number
) {
  const ordemEncontrada = await buscarOrdemService(id, empresaId)

  if (!ordemEncontrada) {
    return {
      sucesso: false as const,
      motivo: "ordem_nao_encontrada" as const
    }
  }

  if (ordemEncontrada.status === StatusOrdem.ENTREGUE) {
    return {
      sucesso: false as const,
      motivo: "ordem_entregue" as const
    }
  }

  try {
    const ordem = await prisma.ordemServico.delete({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      }
    })

    return {
      sucesso: true as const,
      ordem
    }
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2025")) {
      return {
        sucesso: false as const,
        motivo: "ordem_nao_encontrada" as const
      }
    }

    throw error
  }
}
