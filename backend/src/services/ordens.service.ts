import type { Prisma } from "../generated/prisma/client.js"
import { StatusOrdem } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import {
  listarStatusPermitidos,
  transicaoStatusEhPermitida
} from "../rules/status-ordem.js"
import type {
  AtualizarOrdemInput,
  CriarOrdemInput,
  ListarOrdensQuery
} from "../validators/ordens.validators.js"

// Seleção reutilizada nas consultas para devolver somente o resumo necessário
// do cliente junto de cada ordem.
const clienteResumo = {
  select: {
    id: true,
    nome: true,
    telefone: true
  }
} as const

// Combina isolamento por empresa, filtros opcionais, pesquisa e paginação.
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

  // Dados e total são consultados juntos para montar as informações da página.
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

// `id_empresaId` é uma chave composta definida no schema do Prisma.
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

// Antes de criar uma ordem, confirma que o cliente pertence à mesma empresa.
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

  // Ordem e histórico inicial são gravados na mesma transação. Se uma escrita
  // falhar, a outra é desfeita e o banco não fica em estado parcial.
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

// Atualiza somente os campos recebidos e registra uma mudança de status quando
// ela realmente ocorreu.
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

  if (
    dados.status !== undefined &&
    !transicaoStatusEhPermitida(ordemExistente.status, dados.status)
  ) {
    // O resultado estruturado permite ao controller informar os status aceitos.
    return {
      sucesso: false as const,
      motivo: "transicao_status_invalida" as const,
      statusAtual: ordemExistente.status,
      statusSolicitado: dados.status,
      statusPermitidos: listarStatusPermitidos(ordemExistente.status)
    }
  }

  if (dados.clienteId !== undefined) {
    // Uma troca de cliente também precisa respeitar o limite da empresa.
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

  // Spreads condicionais diferenciam "campo não enviado" de um valor enviado.
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

    // O histórico só ganha uma linha quando o status realmente muda.
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

// Versão especializada para telas ou ações que alteram apenas o status.
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
    // Repetir o status atual é idempotente: não cria histórico duplicado.
    return {
      sucesso: true as const,
      ordem: ordemExistente
    }
  }

  if (!transicaoStatusEhPermitida(ordemExistente.status, status)) {
    return {
      sucesso: false as const,
      motivo: "transicao_status_invalida" as const,
      statusAtual: ordemExistente.status,
      statusSolicitado: status,
      statusPermitidos: listarStatusPermitidos(ordemExistente.status)
    }
  }

  // Atualização e auditoria permanecem atômicas por meio da transação.
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

// Primeiro confirma a existência da ordem dentro da empresa; depois lista seu
// histórico em ordem cronológica com um resumo de quem fez cada mudança.
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

// O nome histórico é "remover", mas a operação cancela a ordem em vez de
// apagá-la. Isso mantém rastreabilidade para a empresa.
export async function removerOrdemService(
  id: number,
  empresaId: number,
  usuarioId: number
) {
  return prisma.$transaction(async tx => {
    const ordemEncontrada = await tx.ordemServico.findUnique({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      include: { cliente: clienteResumo }
    })

    if (!ordemEncontrada) {
      return {
        sucesso: false as const,
        motivo: "ordem_nao_encontrada" as const
      }
    }

    if (ordemEncontrada.status === StatusOrdem.ENTREGUE) {
      // Uma ordem entregue representa um processo encerrado e não pode cancelar.
      return {
        sucesso: false as const,
        motivo: "ordem_entregue" as const
      }
    }

    if (ordemEncontrada.status === StatusOrdem.CANCELADA) {
      // Cancelar novamente retorna sucesso sem criar outro evento no histórico.
      return {
        sucesso: true as const,
        ordem: ordemEncontrada
      }
    }

    const ordem = await tx.ordemServico.update({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      data: {
        status: StatusOrdem.CANCELADA
      },
      include: { cliente: clienteResumo }
    })

    await tx.historicoStatusOrdem.create({
      data: {
        ordemId: id,
        empresaId,
        status: StatusOrdem.CANCELADA,
        alteradoPorId: usuarioId
      }
    })

    return {
      sucesso: true as const,
      ordem
    }
  })
}
