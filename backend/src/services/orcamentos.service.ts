import { Prisma } from "../generated/prisma/client.js"
import {
  FormaPagamento,
  StatusCobranca,
  StatusOrcamento,
  StatusOrdem,
  type StatusOrcamento as StatusOrcamentoType
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import {
  abortarTransacaoComResultado,
  executarTransacaoComRollback
} from "../lib/transacao.js"
import {
  cancelarCobrancasPendentesTx,
  configuracaoPagamentoAceitaPix,
  materializarPagamentoDaCobrancaTx
} from "./cobrancas.service.js"
import {
  listarStatusOrcamentoPermitidos,
  transicaoStatusOrcamentoEhPermitida
} from "../rules/status-orcamento.js"
import type {
  AcaoPublicaOrcamentoInput,
  AprovacaoPublicaOrcamentoInput,
  AlterarStatusOrcamentoInput,
  AtualizarOrcamentoInput,
  CriarOrcamentoInput,
  ListarOrcamentosQuery,
  TransformarOrcamentoInput
} from "../validators/orcamentos.validators.js"

const clienteResumo = {
  select: {
    id: true,
    nome: true,
    telefone: true,
    email: true
  }
} as const

const ordemComCliente = {
  include: {
    cliente: clienteResumo
  }
} as const

const orcamentoResumoInclude = {
  cliente: clienteResumo,
  itens: {
    orderBy: { id: "asc" as const }
  },
  ordem: {
    select: {
      id: true,
      numero: true,
      status: true,
      versao: true,
      criadoEm: true
    }
  }
} satisfies Prisma.OrcamentoInclude

const orcamentoDetalhadoInclude = {
  ...orcamentoResumoInclude,
  historico: {
    include: {
      alteradoPor: {
        select: {
          id: true,
          nome: true,
          papel: true
        }
      }
    },
    orderBy: [{ criadoEm: "asc" }, { id: "asc" }]
  }
} satisfies Prisma.OrcamentoInclude

const orcamentoPublicoSelect = {
  numero: true,
  equipamento: true,
  descricaoProblema: true,
  status: true,
  subtotal: true,
  desconto: true,
  total: true,
  validade: true,
  observacoes: true,
  formaPagamentoEscolhida: true,
  versao: true,
  enviadoEm: true,
  aprovadoEm: true,
  empresa: {
    select: {
      id: true,
      nome: true,
      telefone: true,
      email: true,
      configuracaoPagamento: {
        select: {
          provedor: true,
          ambiente: true,
          status: true,
          ativo: true,
          pixHabilitado: true
        }
      }
    }
  },
  cliente: {
    select: {
      nome: true
    }
  },
  itens: {
    select: {
      descricao: true,
      quantidade: true,
      valorUnitario: true,
      valorTotal: true,
      tipo: true
    },
    orderBy: { id: "asc" as const }
  },
  ordem: {
    select: {
      tokenAcompanhamento: true
    }
  }
} as const

type OrcamentoPublicoSelecionado = Prisma.OrcamentoGetPayload<{
  select: typeof orcamentoPublicoSelect
}>

function sanitizarOrcamentoPublico(
  orcamento: OrcamentoPublicoSelecionado
) {
  const {
    configuracaoPagamento,
    id: empresaId,
    ...empresa
  } = orcamento.empresa
  const { ordem, ...dadosPublicos } = orcamento

  return {
    ...dadosPublicos,
    empresa,
    formaPagamentoEscolhida:
      orcamento.formaPagamentoEscolhida === FormaPagamento.NAO_INFORMADA
          ? null
          : orcamento.formaPagamentoEscolhida,
    pixDisponivel: configuracaoPagamentoAceitaPix(
      configuracaoPagamento,
      empresaId
    ),
    ...(ordem && {
      tokenAcompanhamento: ordem.tokenAcompanhamento
    })
  }
}

type ItemRecebido = CriarOrcamentoInput["itens"][number]
const limiteMonetario = new Prisma.Decimal("9999999999.99")

export function calcularTotaisOrcamento(
  itens: readonly ItemRecebido[],
  descontoRecebido: number | Prisma.Decimal
) {
  const itensCalculados = itens.map(item => {
    const valorUnitario = new Prisma.Decimal(item.valorUnitario)
    const valorTotal = valorUnitario.mul(item.quantidade).toDecimalPlaces(2)

    return {
      descricao: item.descricao,
      quantidade: item.quantidade,
      valorUnitario,
      valorTotal,
      tipo: item.tipo
    }
  })

  if (itensCalculados.some(item => item.valorTotal.greaterThan(limiteMonetario))) {
    return {
      sucesso: false as const,
      motivo: "valor_excede_limite" as const,
      campo: "itens.valorTotal" as const,
      limite: limiteMonetario
    }
  }

  const subtotal = itensCalculados.reduce(
    (soma, item) => soma.plus(item.valorTotal),
    new Prisma.Decimal(0)
  )
  const desconto = new Prisma.Decimal(descontoRecebido)

  if (subtotal.greaterThan(limiteMonetario)) {
    return {
      sucesso: false as const,
      motivo: "valor_excede_limite" as const,
      campo: "subtotal" as const,
      limite: limiteMonetario
    }
  }

  if (desconto.greaterThan(subtotal)) {
    return {
      sucesso: false as const,
      motivo: "desconto_maior_que_subtotal" as const,
      subtotal,
      desconto
    }
  }

  const total = subtotal.minus(desconto)
  if (total.greaterThan(limiteMonetario)) {
    return {
      sucesso: false as const,
      motivo: "valor_excede_limite" as const,
      campo: "total" as const,
      limite: limiteMonetario
    }
  }

  return {
    sucesso: true as const,
    itens: itensCalculados,
    subtotal,
    desconto,
    total
  }
}

function criarConflitoAtualizacao(
  statusEsperado: StatusOrcamentoType,
  versaoEsperada: number,
  atual: { status: StatusOrcamentoType; versao: number }
) {
  return {
    sucesso: false as const,
    motivo: "conflito_atualizacao" as const,
    statusEsperado,
    statusAtual: atual.status,
    versaoEsperada,
    versaoAtual: atual.versao
  }
}

async function buscarFalhaConcorrencia(
  tx: Prisma.TransactionClient,
  id: number,
  empresaId: number,
  statusEsperado: StatusOrcamentoType,
  versaoEsperada: number
) {
  const atual = await tx.orcamento.findUnique({
    where: {
      id_empresaId: { id, empresaId }
    },
    select: {
      status: true,
      versao: true
    }
  })

  if (!atual) {
    return {
      sucesso: false as const,
      motivo: "orcamento_nao_encontrado" as const
    }
  }

  return criarConflitoAtualizacao(
    statusEsperado,
    versaoEsperada,
    atual
  )
}

function validadeExpirou(validade: Date | null): boolean {
  return validade !== null && validade.getTime() < Date.now()
}

function camposDeDataParaStatus(status: StatusOrcamentoType, agora: Date) {
  if (status === StatusOrcamento.ENVIADO) {
    return { enviadoEm: agora }
  }

  if (status === StatusOrcamento.APROVADO) {
    return { aprovadoEm: agora }
  }

  if (status === StatusOrcamento.CONVERTIDO) {
    return { convertidoEm: agora }
  }

  return {}
}

async function aplicarTransicao(
  tx: Prisma.TransactionClient,
  atual: {
    id: number
    empresaId: number
    status: StatusOrcamentoType
    versao: number
  },
  proximoStatus: StatusOrcamentoType,
  alteradoPorId: number | null,
  observacao: string | null | undefined,
  camposExtras: Prisma.OrcamentoUncheckedUpdateManyInput = {}
) {
  const agora = new Date()
  const novaVersao = atual.versao + 1
  const atualizacao = await tx.orcamento.updateMany({
    where: {
      id: atual.id,
      empresaId: atual.empresaId,
      status: atual.status,
      versao: atual.versao
    },
    data: {
      status: proximoStatus,
      versao: { increment: 1 },
      ...camposDeDataParaStatus(proximoStatus, agora),
      ...camposExtras
    }
  })

  if (atualizacao.count === 0) {
    return buscarFalhaConcorrencia(
      tx,
      atual.id,
      atual.empresaId,
      atual.status,
      atual.versao
    )
  }

  await tx.historicoStatusOrcamento.create({
    data: {
      orcamentoId: atual.id,
      empresaId: atual.empresaId,
      statusAnterior: atual.status,
      status: proximoStatus,
      versaoResultante: novaVersao,
      observacao: observacao ?? null,
      alteradoPorId
    }
  })

  return {
    sucesso: true as const,
    novaVersao
  }
}

export async function listarOrcamentosService(
  empresaId: number,
  filtros: ListarOrcamentosQuery
) {
  const numeroBuscado = filtros.busca ? Number(filtros.busca) : NaN
  const where: Prisma.OrcamentoWhereInput = {
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
                mode: "insensitive" as const
              }
            },
            {
              descricaoProblema: {
                contains: filtros.busca,
                mode: "insensitive" as const
              }
            },
            {
              cliente: {
                nome: {
                  contains: filtros.busca,
                  mode: "insensitive" as const
                }
              }
            }
          ]
        }
      : {})
  }
  const skip = (filtros.pagina - 1) * filtros.limite
  const [dados, total] = await prisma.$transaction([
    prisma.orcamento.findMany({
      where,
      include: orcamentoResumoInclude,
      orderBy: { criadoEm: "desc" },
      skip,
      take: filtros.limite
    }),
    prisma.orcamento.count({ where })
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

export function buscarOrcamentoService(id: number, empresaId: number) {
  return prisma.orcamento.findUnique({
    where: {
      id_empresaId: { id, empresaId }
    },
    include: orcamentoDetalhadoInclude
  })
}

export async function criarOrcamentoService(
  empresaId: number,
  usuarioId: number,
  dados: CriarOrcamentoInput
) {
  const calculo = calcularTotaisOrcamento(dados.itens, dados.desconto)

  if (!calculo.sucesso) {
    return calculo
  }

  return prisma.$transaction(async tx => {
    const cliente = await tx.cliente.findUnique({
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

    // O incremento da empresa e a criacao do orcamento compartilham a mesma
    // transacao. Concorrencia produz numeros distintos e rollback nao os consome.
    const empresa = await tx.empresa.update({
      where: { id: empresaId },
      data: {
        proximoNumeroOrcamento: { increment: 1 }
      },
      select: { proximoNumeroOrcamento: true }
    })
    const numero = empresa.proximoNumeroOrcamento - 1

    const orcamento = await tx.orcamento.create({
      data: {
        empresaId,
        clienteId: dados.clienteId,
        numero,
        equipamento: dados.equipamento,
        descricaoProblema: dados.descricaoProblema,
        subtotal: calculo.subtotal,
        desconto: calculo.desconto,
        total: calculo.total,
        ...(dados.validade !== undefined && { validade: dados.validade }),
        ...(dados.observacoes !== undefined && {
          observacoes: dados.observacoes
        }),
        itens: {
          create: calculo.itens
        },
        historico: {
          create: {
            status: StatusOrcamento.RASCUNHO,
            versaoResultante: 1,
            alteradoPorId: usuarioId
          }
        }
      },
      include: orcamentoDetalhadoInclude
    })

    return {
      sucesso: true as const,
      orcamento
    }
  })
}

export async function atualizarOrcamentoService(
  id: number,
  empresaId: number,
  dados: AtualizarOrcamentoInput
) {
  return executarTransacaoComRollback(async tx => {
    const atual = await tx.orcamento.findUnique({
      where: {
        id_empresaId: { id, empresaId }
      },
      include: {
        itens: {
          orderBy: { id: "asc" }
        }
      }
    })

    if (!atual) {
      return {
        sucesso: false as const,
        motivo: "orcamento_nao_encontrado" as const
      }
    }

    if (
      atual.status !== dados.statusEsperado ||
      atual.versao !== dados.versaoEsperada
    ) {
      return criarConflitoAtualizacao(
        dados.statusEsperado,
        dados.versaoEsperada,
        atual
      )
    }

    if (atual.status !== StatusOrcamento.RASCUNHO) {
      return {
        sucesso: false as const,
        motivo: "orcamento_nao_editavel" as const,
        statusAtual: atual.status
      }
    }

    if (dados.clienteId !== undefined) {
      const cliente = await tx.cliente.findUnique({
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

    let valores:
      | ReturnType<typeof calcularTotaisOrcamento>
      | null = null

    if (dados.itens !== undefined) {
      valores = calcularTotaisOrcamento(
        dados.itens,
        dados.desconto ?? atual.desconto
      )
    } else if (dados.desconto !== undefined) {
      const desconto = new Prisma.Decimal(dados.desconto)
      if (desconto.greaterThan(atual.subtotal)) {
        return {
          sucesso: false as const,
          motivo: "desconto_maior_que_subtotal" as const,
          subtotal: atual.subtotal,
          desconto
        }
      }

      valores = {
        sucesso: true as const,
        itens: [],
        subtotal: atual.subtotal,
        desconto,
        total: atual.subtotal.minus(desconto)
      }
    }

    if (valores && !valores.sucesso) {
      return valores
    }

    const data: Prisma.OrcamentoUncheckedUpdateManyInput = {
      ...(dados.clienteId !== undefined && { clienteId: dados.clienteId }),
      ...(dados.equipamento !== undefined && {
        equipamento: dados.equipamento
      }),
      ...(dados.descricaoProblema !== undefined && {
        descricaoProblema: dados.descricaoProblema
      }),
      ...(dados.validade !== undefined && { validade: dados.validade }),
      ...(dados.observacoes !== undefined && {
        observacoes: dados.observacoes
      }),
      ...(valores?.sucesso && {
        subtotal: valores.subtotal,
        desconto: valores.desconto,
        total: valores.total
      }),
      versao: { increment: 1 }
    }

    const atualizacao = await tx.orcamento.updateMany({
      where: {
        id,
        empresaId,
        status: dados.statusEsperado,
        versao: dados.versaoEsperada
      },
      data
    })

    if (atualizacao.count === 0) {
      return buscarFalhaConcorrencia(
        tx,
        id,
        empresaId,
        dados.statusEsperado,
        dados.versaoEsperada
      )
    }

    if (dados.itens !== undefined && valores?.sucesso) {
      await tx.itemOrcamento.deleteMany({
        where: { orcamentoId: id }
      })
      await tx.itemOrcamento.createMany({
        data: valores.itens.map(item => ({
          orcamentoId: id,
          ...item
        }))
      })
    }

    const orcamento = await tx.orcamento.findUnique({
      where: {
        id_empresaId: { id, empresaId }
      },
      include: orcamentoDetalhadoInclude
    })

    return {
      sucesso: true as const,
      orcamento: orcamento!
    }
  })
}

export async function alterarStatusOrcamentoService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: AlterarStatusOrcamentoInput
) {
  return executarTransacaoComRollback(async tx => {
    const atual = await tx.orcamento.findUnique({
      where: {
        id_empresaId: { id, empresaId }
      },
      select: {
        id: true,
        empresaId: true,
        status: true,
        versao: true
      }
    })

    if (!atual) {
      return {
        sucesso: false as const,
        motivo: "orcamento_nao_encontrado" as const
      }
    }

    if (
      atual.status !== dados.statusEsperado ||
      atual.versao !== dados.versaoEsperada
    ) {
      return criarConflitoAtualizacao(
        dados.statusEsperado,
        dados.versaoEsperada,
        atual
      )
    }

    if (!transicaoStatusOrcamentoEhPermitida(atual.status, dados.status)) {
      return {
        sucesso: false as const,
        motivo: "transicao_status_invalida" as const,
        statusAtual: atual.status,
        statusSolicitado: dados.status,
        statusPermitidos: listarStatusOrcamentoPermitidos(atual.status)
      }
    }

    if (dados.status === atual.status) {
      const orcamento = await tx.orcamento.findUnique({
        where: {
          id_empresaId: { id, empresaId }
        },
        include: orcamentoDetalhadoInclude
      })

      return {
        sucesso: true as const,
        orcamento: orcamento!
      }
    }

    if (
      atual.status === StatusOrcamento.APROVADO &&
      dados.status === StatusOrcamento.CANCELADO
    ) {
      await cancelarCobrancasPendentesTx(tx, empresaId, {
        orcamentoId: id
      })

      const cobrancaPaga = await tx.cobranca.findFirst({
        where: {
          empresaId,
          orcamentoId: id,
          status: StatusCobranca.PAGA
        },
        select: { id: true }
      })

      if (cobrancaPaga) {
        abortarTransacaoComResultado({
          sucesso: false as const,
          motivo: "cobranca_paga" as const
        })
      }
    }

    const transicao = await aplicarTransicao(
      tx,
      atual,
      dados.status,
      usuarioId,
      dados.observacao
    )

    if (!transicao.sucesso) {
      abortarTransacaoComResultado(transicao)
    }

    const orcamento = await tx.orcamento.findUnique({
      where: {
        id_empresaId: { id, empresaId }
      },
      include: orcamentoDetalhadoInclude
    })

    return {
      sucesso: true as const,
      orcamento: orcamento!
    }
  })
}

export async function transformarOrcamentoEmOrdemService(
  id: number,
  empresaId: number,
  usuarioId: number,
  dados: TransformarOrcamentoInput
) {
  return prisma.$transaction(async tx => {
    const atual = await tx.orcamento.findUnique({
      where: {
        id_empresaId: { id, empresaId }
      },
      include: {
        itens: {
          orderBy: { id: "asc" }
        },
        ordem: ordemComCliente
      }
    })

    if (!atual) {
      return {
        sucesso: false as const,
        motivo: "orcamento_nao_encontrado" as const
      }
    }

    if (atual.status === StatusOrcamento.CONVERTIDO) {
      if (!atual.ordem) {
        return {
          sucesso: false as const,
          motivo: "conversao_inconsistente" as const
        }
      }

      return {
        sucesso: true as const,
        ordem: atual.ordem,
        jaExistente: true as const
      }
    }

    if (
      atual.status !== dados.statusEsperado ||
      atual.versao !== dados.versaoEsperada
    ) {
      return criarConflitoAtualizacao(
        dados.statusEsperado,
        dados.versaoEsperada,
        atual
      )
    }

    const agora = new Date()
    const atualizacao = await tx.orcamento.updateMany({
      where: {
        id,
        empresaId,
        status: StatusOrcamento.APROVADO,
        versao: dados.versaoEsperada
      },
      data: {
        status: StatusOrcamento.CONVERTIDO,
        convertidoEm: agora,
        versao: { increment: 1 }
      }
    })

    if (atualizacao.count === 0) {
      const depoisDaCorrida = await tx.orcamento.findUnique({
        where: {
          id_empresaId: { id, empresaId }
        },
        include: {
          ordem: ordemComCliente
        }
      })

      if (
        depoisDaCorrida?.status === StatusOrcamento.CONVERTIDO &&
        depoisDaCorrida.ordem
      ) {
        return {
          sucesso: true as const,
          ordem: depoisDaCorrida.ordem,
          jaExistente: true as const
        }
      }

      return buscarFalhaConcorrencia(
        tx,
        id,
        empresaId,
        dados.statusEsperado,
        dados.versaoEsperada
      )
    }

    // O contador é incrementado dentro da mesma transação serializável da
    // conversão. Duas OS da mesma empresa nunca recebem o mesmo número e um
    // rollback também desfaz a reserva.
    const numeracao = await tx.empresa.update({
      where: { id: empresaId },
      data: {
        proximoNumeroOrdem: { increment: 1 }
      },
      select: { proximoNumeroOrdem: true }
    })

    const ordem = await tx.ordemServico.create({
      data: {
        numero: numeracao.proximoNumeroOrdem - 1,
        empresaId,
        clienteId: atual.clienteId,
        orcamentoId: atual.id,
        equipamento: atual.equipamento,
        problemaRelatado: atual.descricaoProblema,
        valor: atual.total,
        formaDePagamento: atual.formaPagamentoEscolhida,
        status: StatusOrdem.RECEBIDO,
        historico: {
          create: {
            status: StatusOrdem.RECEBIDO,
            mensagemPublica: "Ordem de serviço recebida.",
            alteradoPorId: usuarioId
          }
        }
      },
      include: {
        cliente: clienteResumo
      }
    })

    // Uma cobranca pode ter sido paga logo apos a aprovacao, antes de existir
    // OS. A conversao associa e materializa essas entradas no ledger uma vez.
    const cobrancasPagas = await tx.cobranca.findMany({
      where: {
        empresaId,
        orcamentoId: id,
        status: StatusCobranca.PAGA
      },
      select: { id: true }
    })

    for (const cobranca of cobrancasPagas) {
      await materializarPagamentoDaCobrancaTx(
        tx,
        cobranca.id,
        empresaId,
        false
      )
    }

    await tx.historicoStatusOrcamento.create({
      data: {
        orcamentoId: id,
        empresaId,
        statusAnterior: StatusOrcamento.APROVADO,
        status: StatusOrcamento.CONVERTIDO,
        versaoResultante: dados.versaoEsperada + 1,
        observacao: "Ordem de servico criada a partir do orcamento",
        alteradoPorId: usuarioId
      }
    })

    return {
      sucesso: true as const,
      ordem,
      jaExistente: false as const
    }
  })
}

export async function buscarOrcamentoPublicoService(token: string) {
  const orcamento = await prisma.orcamento.findUnique({
    where: { tokenPublico: token },
    select: orcamentoPublicoSelect
  })

  return orcamento ? sanitizarOrcamentoPublico(orcamento) : null
}

async function executarAcaoPublicaOrcamento(
  token: string,
  dados: AcaoPublicaOrcamentoInput | AprovacaoPublicaOrcamentoInput,
  proximoStatus: typeof StatusOrcamento.APROVADO | typeof StatusOrcamento.REJEITADO
) {
  return prisma.$transaction(async tx => {
    const atual = await tx.orcamento.findUnique({
      where: { tokenPublico: token },
      select: {
        id: true,
        empresaId: true,
        status: true,
        versao: true,
        validade: true
      }
    })

    if (!atual) {
      return {
        sucesso: false as const,
        motivo: "orcamento_nao_encontrado" as const
      }
    }

    if (
      atual.status !== StatusOrcamento.ENVIADO ||
      atual.versao !== dados.versaoEsperada
    ) {
      return criarConflitoAtualizacao(
        StatusOrcamento.ENVIADO,
        dados.versaoEsperada,
        atual
      )
    }

    if (
      proximoStatus === StatusOrcamento.APROVADO &&
      validadeExpirou(atual.validade)
    ) {
      const expiracao = await aplicarTransicao(
        tx,
        atual,
        StatusOrcamento.EXPIRADO,
        null,
        "Orcamento expirado ao receber aprovacao pelo link publico"
      )

      if (!expiracao.sucesso) {
        return expiracao
      }

      return {
        sucesso: false as const,
        motivo: "orcamento_expirado" as const,
        statusAtual: StatusOrcamento.EXPIRADO,
        versaoAtual: expiracao.novaVersao
      }
    }

    if (
      proximoStatus === StatusOrcamento.APROVADO &&
      (dados as { formaPagamento: FormaPagamento }).formaPagamento ===
        FormaPagamento.PIX
    ) {
      return {
        sucesso: false as const,
        motivo: "pix_indisponivel" as const
      }
    }

    const transicao = await aplicarTransicao(
      tx,
      atual,
      proximoStatus,
      null,
      proximoStatus === StatusOrcamento.APROVADO
        ? "Orcamento aprovado pelo link publico"
        : "Orcamento rejeitado pelo link publico",
      proximoStatus === StatusOrcamento.APROVADO
        ? {
            formaPagamentoEscolhida: (
              dados as AprovacaoPublicaOrcamentoInput
            ).formaPagamento
          }
        : {}
    )

    if (!transicao.sucesso) {
      return transicao
    }

    const orcamento = await tx.orcamento.findUnique({
      where: { tokenPublico: token },
      select: orcamentoPublicoSelect
    })

    return {
      sucesso: true as const,
      orcamento: sanitizarOrcamentoPublico(orcamento!)
    }
  })
}

export function aprovarOrcamentoPublicoService(
  token: string,
  dados: AprovacaoPublicaOrcamentoInput
) {
  return executarAcaoPublicaOrcamento(
    token,
    dados,
    StatusOrcamento.APROVADO
  )
}

export function rejeitarOrcamentoPublicoService(
  token: string,
  dados: AcaoPublicaOrcamentoInput
) {
  return executarAcaoPublicaOrcamento(
    token,
    dados,
    StatusOrcamento.REJEITADO
  )
}
