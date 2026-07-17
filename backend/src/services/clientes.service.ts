import type { Prisma } from "../generated/prisma/client.js"
import { prisma } from "../lib/prisma.js"
import {
  erroDeChaveEstrangeira,
  erroPrismaPossuiCodigo
} from "../lib/prisma-errors.js"
import type {
  AtualizarClienteInput,
  CriarClienteInput,
  ListarClientesQuery
} from "../validators/clientes.validators.js"

export async function listarClientesService(
  empresaId: number,
  filtros: ListarClientesQuery
) {
  const where: Prisma.ClienteWhereInput = {
    empresaId,
    ...(filtros.busca
      ? {
          OR: [
            {
              nome: {
                contains: filtros.busca,
                mode: "insensitive"
              }
            },
            { telefone: { contains: filtros.busca } },
            { cpfCnpj: { contains: filtros.busca } }
          ]
        }
      : {})
  }

  const skip = (filtros.pagina - 1) * filtros.limite
  const [dados, total] = await prisma.$transaction([
    prisma.cliente.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip,
      take: filtros.limite
    }),
    prisma.cliente.count({ where })
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

export function buscarClienteService(id: number, empresaId: number) {
  return prisma.cliente.findUnique({
    where: {
      id_empresaId: {
        id,
        empresaId
      }
    }
  })
}

export async function criarClienteService(
  dados: CriarClienteInput,
  empresaId: number
) {
  try {
    const cliente = await prisma.cliente.create({
      data: {
        empresaId,
        nome: dados.nome,
        telefone: dados.telefone,
        ...(dados.email !== undefined && { email: dados.email }),
        ...(dados.cpfCnpj !== undefined && { cpfCnpj: dados.cpfCnpj }),
        ...(dados.endereco !== undefined && { endereco: dados.endereco }),
        ...(dados.observacoes !== undefined && {
          observacoes: dados.observacoes
        })
      }
    })

    return {
      sucesso: true as const,
      cliente
    }
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      return {
        sucesso: false as const,
        motivo: "telefone_duplicado" as const
      }
    }

    throw error
  }
}

export async function atualizarClienteService(
  id: number,
  dados: AtualizarClienteInput,
  empresaId: number
) {
  const data: Prisma.ClienteUpdateInput = {
    ...(dados.nome !== undefined && { nome: dados.nome }),
    ...(dados.telefone !== undefined && { telefone: dados.telefone }),
    ...(dados.email !== undefined && { email: dados.email }),
    ...(dados.cpfCnpj !== undefined && { cpfCnpj: dados.cpfCnpj }),
    ...(dados.endereco !== undefined && { endereco: dados.endereco }),
    ...(dados.observacoes !== undefined && {
      observacoes: dados.observacoes
    })
  }

  try {
    const cliente = await prisma.cliente.update({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      data
    })

    return {
      sucesso: true as const,
      cliente
    }
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      return {
        sucesso: false as const,
        motivo: "telefone_duplicado" as const
      }
    }

    if (erroPrismaPossuiCodigo(error, "P2025")) {
      return {
        sucesso: false as const,
        motivo: "cliente_nao_encontrado" as const
      }
    }

    throw error
  }
}

export async function removerClienteService(
  id: number,
  empresaId: number
) {
  const clienteExistente = await buscarClienteService(id, empresaId)

  if (!clienteExistente) {
    return {
      sucesso: false as const,
      motivo: "cliente_nao_encontrado" as const
    }
  }

  const quantidadeOrdens = await prisma.ordemServico.count({
    where: {
      clienteId: id,
      empresaId
    }
  })

  if (quantidadeOrdens > 0) {
    return {
      sucesso: false as const,
      motivo: "cliente_possui_ordens" as const
    }
  }

  try {
    const cliente = await prisma.cliente.delete({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      }
    })

    return {
      sucesso: true as const,
      cliente
    }
  } catch (error) {
    if (erroDeChaveEstrangeira(error)) {
      return {
        sucesso: false as const,
        motivo: "cliente_possui_ordens" as const
      }
    }

    if (erroPrismaPossuiCodigo(error, "P2025")) {
      return {
        sucesso: false as const,
        motivo: "cliente_nao_encontrado" as const
      }
    }
    throw error
  }
}
