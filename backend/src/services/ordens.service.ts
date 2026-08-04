import { Prisma } from "../generated/prisma/client.js"
import {
  StatusOrdem,
  StatusRegistroPagamento
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import {
  protegerCredencialAparelho,
  revelarCredencialAparelho
} from "../lib/credenciais-aparelho.js"
import {
  abortarTransacaoComResultado,
  executarTransacaoComRollback
} from "../lib/transacao.js"
import {
  listarStatusPermitidos,
  transicaoStatusEhPermitida
} from "../rules/status-ordem.js"
import {
  buscarResumoPagamentosTx,
  calcularResumoPagamento,
  pagamentoEstaQuitado
} from "./pagamentos.service.js"
import {
  buscarCobrancaPagaNaoConciliadaTx,
  cancelarCobrancasPendentesTx
} from "./cobrancas.service.js"
import { criarGarantiaDaEntregaTx } from "./garantias.service.js"
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

const tecnicoResponsavelResumo = {
  select: {
    id: true,
    nome: true,
    papel: true,
    ativo: true
  }
} as const

function ocultarCredencialAcesso<
  T extends {
    credencialAcessoCifrada: string | null
    credencialAcessoAtualizadaEm: Date | null
  }
>(ordem: T) {
  const {
    credencialAcessoCifrada,
    credencialAcessoAtualizadaEm,
    ...dados
  } = ordem

  return {
    ...dados,
    possuiCredencialAcesso: Boolean(credencialAcessoCifrada),
    credencialAcessoAtualizadaEm
  }
}

function removerCredencialDaResposta<
  T extends {
    credencialAcessoCifrada?: string | null
    credencialAcessoAtualizadaEm?: Date | null
  }
>(ordem: T) {
  const {
    credencialAcessoCifrada: _credencial,
    credencialAcessoAtualizadaEm: _atualizadaEm,
    ...dados
  } = ordem

  return dados
}

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

async function cancelarPendenciasAntesDoStatusFinal(
  tx: Prisma.TransactionClient,
  ordem: { id: number; empresaId: number; orcamentoId: number },
  proximoStatus: StatusOrdem
) {
  if (
    proximoStatus !== StatusOrdem.ENTREGUE &&
    proximoStatus !== StatusOrdem.CANCELADO
  ) {
    return
  }

  await cancelarCobrancasPendentesTx(tx, ordem.empresaId, {
    ordemId: ordem.id,
    orcamentoId: ordem.orcamentoId
  })

  const pagaNaoConciliada = await buscarCobrancaPagaNaoConciliadaTx(
    tx,
    ordem.empresaId,
    {
      ordemId: ordem.id,
      orcamentoId: ordem.orcamentoId
    }
  )

  if (pagaNaoConciliada) {
    abortarTransacaoComResultado({
      sucesso: false as const,
      motivo: "cobranca_em_conciliacao" as const
    })
  }
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
  const numeroBuscado = filtros.busca ? Number(filtros.busca) : NaN
  const where: Prisma.OrdemServicoWhereInput = {
    empresaId,
    ...(filtros.status ? { status: filtros.status } : {}),
    ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
    ...(filtros.busca
      ? {
          OR: [
            ...(Number.isInteger(numeroBuscado) && numeroBuscado > 0
              ? [{ numero: numeroBuscado }]
              : []),
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
        orcamento: orcamentoResumo,
        tecnicoResponsavelUsuario: tecnicoResponsavelResumo
      },
      orderBy: { criadoEm: "desc" },
      skip,
      take: filtros.limite
    }),
    prisma.ordemServico.count({ where })
  ])

  return {
    // O bearer token só é necessário no detalhe da OS para copiar o link.
    // A listagem não o distribui em massa para o navegador autenticado.
    dados: dados.map(({ tokenAcompanhamento: _token, ...ordem }) =>
      ocultarCredencialAcesso(ordem)
    ),
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
      },
      tecnicoResponsavelUsuario: tecnicoResponsavelResumo,
      garantia: true
    }
  })

  if (!ordem) return null

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      nome: true,
      telefone: true,
      email: true,
      cpfCnpj: true,
      endereco: true,
      cidade: true,
      estado: true
    }
  })

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
    ...ocultarCredencialAcesso(dadosOrdem),
    empresa,
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
  return executarTransacaoComRollback(async tx => {
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
        campo !== "status" &&
        campo !== "mensagemPublica"
    )

    if (dados.status === ordemAtual.status && !possuiOutroCampo) {
      return {
        sucesso: true as const,
        ordem: removerCredencialDaResposta(ordemAtual)
      }
    }

    if (dados.status !== undefined) {
      await cancelarPendenciasAntesDoStatusFinal(
        tx,
        ordemAtual,
        dados.status
      )
    }

    let tecnicoResponsavelSelecionado: { id: number; nome: string } | null | undefined
    if (dados.tecnicoResponsavelId !== undefined) {
      tecnicoResponsavelSelecionado = dados.tecnicoResponsavelId === null
        ? null
        : await tx.usuario.findFirst({
            where: {
              id: dados.tecnicoResponsavelId,
              empresaId,
              ativo: true
            },
            select: { id: true, nome: true }
          })

      if (dados.tecnicoResponsavelId !== null && !tecnicoResponsavelSelecionado) {
        return {
          sucesso: false as const,
          motivo: "tecnico_nao_encontrado" as const
        }
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
      ...(dados.marcaAparelho !== undefined && {
        marcaAparelho: dados.marcaAparelho
      }),
      ...(dados.modeloAparelho !== undefined && {
        modeloAparelho: dados.modeloAparelho
      }),
      ...(dados.imei !== undefined && { imei: dados.imei }),
      ...(dados.numeroSerie !== undefined && { numeroSerie: dados.numeroSerie }),
      ...(dados.corAparelho !== undefined && { corAparelho: dados.corAparelho }),
      ...(dados.capacidadeAparelho !== undefined && {
        capacidadeAparelho: dados.capacidadeAparelho
      }),
      ...(dados.acessoriosEntrada !== undefined && {
        acessoriosEntrada: dados.acessoriosEntrada
      }),
      ...(dados.checklistEntrada !== undefined && {
        checklistEntrada: dados.checklistEntrada
      }),
      ...(dados.defeitosVisiveis !== undefined && {
        defeitosVisiveis: dados.defeitosVisiveis
      }),
      ...(dados.aparelhoJaAberto !== undefined && {
        aparelhoJaAberto: dados.aparelhoJaAberto
      }),
      ...(dados.aceiteCliente !== undefined && {
        aceiteClienteEm: dados.aceiteCliente ? new Date() : null
      }),
      ...(dados.credencialAcesso !== undefined && {
        credencialAcessoCifrada: dados.credencialAcesso === null
          ? null
          : protegerCredencialAparelho(dados.credencialAcesso, empresaId, id),
        credencialAcessoAtualizadaEm: dados.credencialAcesso === null
          ? null
          : new Date()
      }),
      ...(dados.tecnicoResponsavel !== undefined && {
        tecnicoResponsavel: dados.tecnicoResponsavel
      }),
      ...(tecnicoResponsavelSelecionado !== undefined && {
        tecnicoResponsavelId: tecnicoResponsavelSelecionado?.id ?? null,
        tecnicoResponsavel: tecnicoResponsavelSelecionado?.nome ?? null
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
      const falha = await buscarFalhaDeConcorrencia(
        tx,
        id,
        empresaId,
        dados.statusEsperado,
        dados.versaoEsperada
      )
      abortarTransacaoComResultado(falha)
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
          ...(dados.mensagemPublica !== undefined && {
            mensagemPublica: dados.mensagemPublica
          }),
          alteradoPorId: usuarioId
        }
      })
    }

    if (dados.status === StatusOrdem.ENTREGUE) {
      await criarGarantiaDaEntregaTx(tx, { ordemId: id, empresaId, usuarioId })
    }

    const ordem = await tx.ordemServico.findUnique({
      where: {
        id_empresaId: {
          id,
          empresaId
        }
      },
      include: {
        cliente: clienteResumo,
        tecnicoResponsavelUsuario: tecnicoResponsavelResumo
      }
    })

    return {
      sucesso: true as const,
      ordem: removerCredencialDaResposta(ordem!)
    }
  })
}

export async function buscarCredencialAcessoOrdemService(
  id: number,
  empresaId: number
) {
  const ordem = await prisma.ordemServico.findUnique({
    where: {
      id_empresaId: { id, empresaId }
    },
    select: {
      credencialAcessoCifrada: true,
      credencialAcessoAtualizadaEm: true
    }
  })

  if (!ordem) return null

  return {
    credencial: ordem.credencialAcessoCifrada
      ? revelarCredencialAparelho(
          ordem.credencialAcessoCifrada,
          empresaId,
          id
        )
      : null,
    atualizadaEm: ordem.credencialAcessoAtualizadaEm
  }
}

// Versão especializada para telas ou ações que alteram apenas o status.
export async function alterarStatusOrdemService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: AlterarStatusOrdemInput
) {
  return executarTransacaoComRollback(async tx => {
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

    await cancelarPendenciasAntesDoStatusFinal(
      tx,
      ordemAtual,
      dados.status
    )

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
      const falha = await buscarFalhaDeConcorrencia(
        tx,
        id,
        empresaId,
        dados.statusEsperado,
        dados.versaoEsperada
      )
      abortarTransacaoComResultado(falha)
    }

    if (dados.status !== dados.statusEsperado) {
      await tx.historicoStatusOrdem.create({
        data: {
          ordemId: id,
          empresaId,
          statusAnterior: dados.statusEsperado,
          status: dados.status,
          ...(dados.mensagemPublica !== undefined && {
            mensagemPublica: dados.mensagemPublica
          }),
          alteradoPorId: usuarioId
        }
      })
    }

    if (dados.status === StatusOrdem.ENTREGUE) {
      await criarGarantiaDaEntregaTx(tx, { ordemId: id, empresaId, usuarioId })
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
  return executarTransacaoComRollback(async tx => {
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

    await cancelarPendenciasAntesDoStatusFinal(
      tx,
      ordemAtual,
      StatusOrdem.CANCELADO
    )

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
      const falha = await buscarFalhaDeConcorrencia(
        tx,
        id,
        empresaId,
        dados.statusEsperado,
        dados.versaoEsperada
      )
      abortarTransacaoComResultado(falha)
    }

    if (dados.statusEsperado !== StatusOrdem.CANCELADO) {
      await tx.historicoStatusOrdem.create({
        data: {
          ordemId: id,
          empresaId,
          statusAnterior: dados.statusEsperado,
          status: StatusOrdem.CANCELADO,
          ...(dados.mensagemPublica !== undefined && {
            mensagemPublica: dados.mensagemPublica
          }),
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
