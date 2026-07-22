import { Prisma } from "../generated/prisma/client.js"
import {
  StatusOrdem,
  StatusRegistroPagamento
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import {
  listarStatusPermitidos,
  transicaoStatusEhPermitida
} from "../rules/status-ordem.js"
import {
  buscarResumoPagamentosTx,
  calcularResumoPagamento,
  pagamentoEstaQuitado
} from "./pagamentos.service.js"
import type {
  AlterarStatusOrdemInput,
  AtualizarOrdemInput,
  CancelarOrdemInput,
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

const orcamentoResumo = {
  select: {
    id: true,
    numero: true,
    status: true,
    total: true
  }
} as const

async function validarRestricaoFinanceira(
  tx: Prisma.TransactionClient,
  ordem: {
    id: number
    empresaId: number
    valor: Prisma.Decimal
  },
  proximoStatus: StatusOrdem
) {
  if (
    proximoStatus !== StatusOrdem.ENTREGUE &&
    proximoStatus !== StatusOrdem.CANCELADO
  ) {
    return null
  }

  const resumo = await buscarResumoPagamentosTx(
    tx,
    ordem.id,
    ordem.empresaId,
    ordem.valor
  )

  if (
    proximoStatus === StatusOrdem.ENTREGUE &&
    !pagamentoEstaQuitado(resumo)
  ) {
    return {
      sucesso: false as const,
      motivo: "pagamento_insuficiente" as const,
      resumo
    }
  }

  if (
    proximoStatus === StatusOrdem.CANCELADO &&
    new Prisma.Decimal(resumo.totalPago).greaterThan(0)
  ) {
    return {
      sucesso: false as const,
      motivo: "pagamento_confirmado" as const,
      resumo
    }
  }

  return null
}

// Depois que o UPDATE condicional falha, esta consulta diferencia uma ordem
// inexistente de uma fotografia desatualizada sem expor dados de outra empresa.
function criarResultadoDeConflito(
  statusEsperado: StatusOrdem,
  versaoEsperada: number,
  ordemAtual: { status: StatusOrdem; versao: number }
) {
  return {
    sucesso: false as const,
    motivo: "conflito_atualizacao" as const,
    statusEsperado,
    statusAtual: ordemAtual.status,
    versaoEsperada,
    versaoAtual: ordemAtual.versao
  }
}

async function buscarFalhaDeConcorrencia(
  tx: Prisma.TransactionClient,
  id: number,
  empresaId: number,
  statusEsperado: StatusOrdem,
  versaoEsperada: number
) {
  const ordemAtual = await tx.ordemServico.findUnique({
    where: {
      id_empresaId: {
        id,
        empresaId
      }
    },
    select: {
      status: true,
      versao: true
    }
  })

  if (!ordemAtual) {
    return {
      sucesso: false as const,
      motivo: "ordem_nao_encontrada" as const
    }
  }

  return criarResultadoDeConflito(
    statusEsperado,
    versaoEsperada,
    ordemAtual
  )
}

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
      include: {
        cliente: clienteResumo,
        orcamento: orcamentoResumo
      },
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
export async function buscarOrdemService(id: number, empresaId: number) {
  const ordem = await prisma.ordemServico.findUnique({
    where: {
      id_empresaId: {
        id,
        empresaId
      }
    },
    include: {
      cliente: clienteResumo,
      orcamento: {
        include: {
          itens: {
            orderBy: { id: "asc" }
          }
        }
      },
      pagamentos: {
        select: {
          valor: true,
          status: true
        }
      }
    }
  })

  if (!ordem) return null

  let totalPago = new Prisma.Decimal(0)
  let totalEstornado = new Prisma.Decimal(0)

  for (const pagamento of ordem.pagamentos) {
    if (pagamento.status === StatusRegistroPagamento.CONFIRMADO) {
      totalPago = totalPago.plus(pagamento.valor)
    } else {
      totalEstornado = totalEstornado.plus(pagamento.valor)
    }
  }

  const { pagamentos: _pagamentos, ...dadosOrdem } = ordem

  return {
    ...dadosOrdem,
    pagamentoResumo: calcularResumoPagamento(
      ordem.valor,
      totalPago,
      totalEstornado
    )
  }
}

// Atualiza somente os campos recebidos. O predicado combina empresa, status e
// versão para que nenhuma leitura antiga consiga sobrescrever uma edição nova.
export async function atualizarOrdemService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: AtualizarOrdemInput
) {
  return prisma.$transaction(async tx => {
    const ordemAtual = await tx.ordemServico.findUnique({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      include: { cliente: clienteResumo }
    })

    if (!ordemAtual) {
      return {
        sucesso: false as const,
        motivo: "ordem_nao_encontrada" as const
      }
    }

    if (
      ordemAtual.status !== dados.statusEsperado ||
      ordemAtual.versao !== dados.versaoEsperada
    ) {
      return criarResultadoDeConflito(
        dados.statusEsperado,
        dados.versaoEsperada,
        ordemAtual
      )
    }

    if (
      dados.status !== undefined &&
      !transicaoStatusEhPermitida(ordemAtual.status, dados.status)
    ) {
      return {
        sucesso: false as const,
        motivo: "transicao_status_invalida" as const,
        statusAtual: ordemAtual.status,
        statusSolicitado: dados.status,
        statusPermitidos: listarStatusPermitidos(ordemAtual.status)
      }
    }

    if (
      dados.status !== undefined &&
      dados.status !== ordemAtual.status
    ) {
      const restricaoFinanceira = await validarRestricaoFinanceira(
        tx,
        ordemAtual,
        dados.status
      )

      if (restricaoFinanceira) return restricaoFinanceira
    }

    const possuiOutroCampo = Object.keys(dados).some(
      campo =>
        campo !== "statusEsperado" &&
        campo !== "versaoEsperada" &&
        campo !== "status"
    )

    if (dados.status === ordemAtual.status && !possuiOutroCampo) {
      return {
        sucesso: true as const,
        ordem: ordemAtual
      }
    }

    // Spreads condicionais diferenciam campo ausente de um valor enviado.
    const data: Prisma.OrdemServicoUncheckedUpdateManyInput = {
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
      ...(dados.status !== undefined && { status: dados.status }),
      versao: { increment: 1 }
    }

    const atualizacao = await tx.ordemServico.updateMany({
      where: {
        id,
        empresaId,
        status: dados.statusEsperado,
        versao: dados.versaoEsperada
      },
      data
    })

    if (atualizacao.count === 0) {
      return buscarFalhaDeConcorrencia(
        tx,
        id,
        empresaId,
        dados.statusEsperado,
        dados.versaoEsperada
      )
    }

    // O histórico só ganha uma linha depois que o compare-and-swap venceu.
    if (
      dados.status !== undefined &&
      dados.status !== dados.statusEsperado
    ) {
      await tx.historicoStatusOrdem.create({
        data: {
          ordemId: id,
          empresaId,
          statusAnterior: dados.statusEsperado,
          status: dados.status,
          alteradoPorId: usuarioId
        }
      })
    }

    const ordem = await tx.ordemServico.findUnique({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      include: { cliente: clienteResumo }
    })

    return {
      sucesso: true as const,
      ordem: ordem!
    }
  })
}

// Versão especializada para telas ou ações que alteram apenas o status.
export async function alterarStatusOrdemService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: AlterarStatusOrdemInput
) {
  return prisma.$transaction(async tx => {
    const ordemAtual = await tx.ordemServico.findUnique({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      include: { cliente: clienteResumo }
    })

    if (!ordemAtual) {
      return {
        sucesso: false as const,
        motivo: "ordem_nao_encontrada" as const
      }
    }

    if (
      ordemAtual.status !== dados.statusEsperado ||
      ordemAtual.versao !== dados.versaoEsperada
    ) {
      return criarResultadoDeConflito(
        dados.statusEsperado,
        dados.versaoEsperada,
        ordemAtual
      )
    }

    if (!transicaoStatusEhPermitida(ordemAtual.status, dados.status)) {
      return {
        sucesso: false as const,
        motivo: "transicao_status_invalida" as const,
        statusAtual: ordemAtual.status,
        statusSolicitado: dados.status,
        statusPermitidos: listarStatusPermitidos(ordemAtual.status)
      }
    }

    // Repetir o estado com a fotografia atual é um no-op verdadeiramente
    // idempotente: não incrementa versão nem duplica o histórico.
    if (dados.status === ordemAtual.status) {
      return {
        sucesso: true as const,
        ordem: ordemAtual
      }
    }

    const restricaoFinanceira = await validarRestricaoFinanceira(
      tx,
      ordemAtual,
      dados.status
    )

    if (restricaoFinanceira) return restricaoFinanceira

    const atualizacao = await tx.ordemServico.updateMany({
      where: {
        id,
        empresaId,
        status: dados.statusEsperado,
        versao: dados.versaoEsperada
      },
      data: {
        status: dados.status,
        versao: { increment: 1 }
      }
    })

    if (atualizacao.count === 0) {
      return buscarFalhaDeConcorrencia(
        tx,
        id,
        empresaId,
        dados.statusEsperado,
        dados.versaoEsperada
      )
    }

    if (dados.status !== dados.statusEsperado) {
      await tx.historicoStatusOrdem.create({
        data: {
          ordemId: id,
          empresaId,
          statusAnterior: dados.statusEsperado,
          status: dados.status,
          alteradoPorId: usuarioId
        }
      })
    }

    const ordem = await tx.ordemServico.findUnique({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      include: { cliente: clienteResumo }
    })

    return {
      sucesso: true as const,
      ordem: ordem!
    }
  })
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
    orderBy: [
      { criadoEm: "asc" },
      { id: "asc" }
    ]
  })
}

// O nome histórico é "remover", mas a operação cancela a ordem em vez de
// apagá-la. Isso mantém rastreabilidade para a empresa.
export async function removerOrdemService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: CancelarOrdemInput
) {
  return prisma.$transaction(async tx => {
    const ordemAtual = await tx.ordemServico.findUnique({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      include: { cliente: clienteResumo }
    })

    if (!ordemAtual) {
      return {
        sucesso: false as const,
        motivo: "ordem_nao_encontrada" as const
      }
    }

    if (
      ordemAtual.status !== dados.statusEsperado ||
      ordemAtual.versao !== dados.versaoEsperada
    ) {
      return criarResultadoDeConflito(
        dados.statusEsperado,
        dados.versaoEsperada,
        ordemAtual
      )
    }

    if (
      !transicaoStatusEhPermitida(
        ordemAtual.status,
        StatusOrdem.CANCELADO
      )
    ) {
      return {
        sucesso: false as const,
        motivo: ordemAtual.status === StatusOrdem.ENTREGUE
          ? "ordem_entregue" as const
          : "transicao_status_invalida" as const,
        statusAtual: ordemAtual.status,
        statusSolicitado: StatusOrdem.CANCELADO,
        statusPermitidos: listarStatusPermitidos(ordemAtual.status)
      }
    }

    if (ordemAtual.status === StatusOrdem.CANCELADO) {
      return {
        sucesso: true as const,
        ordem: ordemAtual
      }
    }

    const restricaoFinanceira = await validarRestricaoFinanceira(
      tx,
      ordemAtual,
      StatusOrdem.CANCELADO
    )

    if (restricaoFinanceira) return restricaoFinanceira

    const atualizacao = await tx.ordemServico.updateMany({
      where: {
        id,
        empresaId,
        status: dados.statusEsperado,
        versao: dados.versaoEsperada
      },
      data: {
        status: StatusOrdem.CANCELADO,
        versao: { increment: 1 }
      }
    })

    if (atualizacao.count === 0) {
      return buscarFalhaDeConcorrencia(
        tx,
        id,
        empresaId,
        dados.statusEsperado,
        dados.versaoEsperada
      )
    }

    if (dados.statusEsperado !== StatusOrdem.CANCELADO) {
      await tx.historicoStatusOrdem.create({
        data: {
          ordemId: id,
          empresaId,
          statusAnterior: dados.statusEsperado,
          status: StatusOrdem.CANCELADO,
          alteradoPorId: usuarioId
        }
      })
    }

    const ordem = await tx.ordemServico.findUnique({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      include: { cliente: clienteResumo }
    })

    return {
      sucesso: true as const,
      ordem: ordem!
    }
  })
}
