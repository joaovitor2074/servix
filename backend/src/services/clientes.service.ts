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

// Monta dinamicamente o filtro do Prisma. `empresaId` é sempre obrigatório;
// `busca` adiciona pesquisa parcial somente quando foi informada.
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

  // `skip` e `take` implementam paginação. A transação executa busca e contagem
  // sobre o mesmo contexto, devolvendo os dados e o total necessário à interface.
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

// A chave composta garante no próprio banco que o cliente pertence à empresa.
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

// Campos opcionais só entram no objeto `data` quando foram realmente enviados.
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
    // P2002 representa violação de uma restrição única; neste modelo, o conflito
    // tratado aqui é o telefone repetido dentro da mesma empresa.
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      return {
        sucesso: false as const,
        motivo: "telefone_duplicado" as const
      }
    }

    throw error
  }
}

// O spread condicional preserva no banco os campos ausentes da requisição.
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

// A exclusão é bloqueada quando existem ordens, preservando a integridade e o
// histórico do atendimento relacionado ao cliente.
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
    // A checagem prévia produz uma mensagem amigável; esta segunda proteção
    // também cobre uma ordem criada entre a contagem e a tentativa de exclusão.
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
