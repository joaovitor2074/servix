import { Prisma } from "../generated/prisma/client.js"
import {
  OrigemPagamento,
  StatusOrdem,
  StatusRegistroPagamento
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import {
  abortarTransacaoComResultado,
  executarTransacaoComRollback
} from "../lib/transacao.js"
import {
  buscarCobrancaPagaNaoConciliadaTx,
  cancelarCobrancasPendentesTx
} from "./cobrancas.service.js"
import type {
  EstornarPagamentoInput,
  RegistrarPagamentoInput
} from "../validators/pagamentos.validators.js"

export const StatusResumoPagamento = {
  PENDENTE: "PENDENTE",
  PARCIAL: "PARCIAL",
  PAGO: "PAGO",
  ESTORNADO: "ESTORNADO"
} as const

export type StatusResumoPagamento =
  (typeof StatusResumoPagamento)[keyof typeof StatusResumoPagamento]

export type ResumoPagamento = {
  status: StatusResumoPagamento
  valorTotal: string
  totalPago: string
  totalEstornado: string
  saldo: string
}

type ValorDecimal = Prisma.Decimal | string | number

const pagamentoSelect = {
  id: true,
  ordemId: true,
  valor: true,
  formaPagamento: true,
  status: true,
  origem: true,
  observacao: true,
  pagoEm: true,
  estornadoEm: true,
  motivoEstorno: true,
  criadoEm: true,
  registradoPor: {
    select: {
      id: true,
      nome: true,
      papel: true
    }
  },
  estornadoPor: {
    select: {
      id: true,
      nome: true,
      papel: true
    }
  }
} as const

function decimal(valor: ValorDecimal | null | undefined) {
  return valor === null || valor === undefined
    ? new Prisma.Decimal(0)
    : new Prisma.Decimal(valor)
}

// O resumo e sempre derivado do ledger. Isso evita que uma mudanca no valor da
// ordem deixe um status financeiro armazenado em desacordo com o saldo real.
export function calcularResumoPagamento(
  valorTotalRecebido: ValorDecimal,
  totalPagoRecebido: ValorDecimal | null | undefined = 0,
  totalEstornadoRecebido: ValorDecimal | null | undefined = 0
): ResumoPagamento {
  const valorTotal = decimal(valorTotalRecebido)
  const totalPago = decimal(totalPagoRecebido)
  const totalEstornado = decimal(totalEstornadoRecebido)
  const saldoCalculado = valorTotal.minus(totalPago)
  const saldo = saldoCalculado.lessThan(0)
    ? new Prisma.Decimal(0)
    : saldoCalculado

  let status: StatusResumoPagamento

  if (valorTotal.equals(0) || totalPago.greaterThanOrEqualTo(valorTotal)) {
    status = StatusResumoPagamento.PAGO
  } else if (totalPago.greaterThan(0)) {
    status = StatusResumoPagamento.PARCIAL
  } else if (totalEstornado.greaterThan(0)) {
    status = StatusResumoPagamento.ESTORNADO
  } else {
    status = StatusResumoPagamento.PENDENTE
  }

  return {
    status,
    valorTotal: valorTotal.toFixed(2),
    totalPago: totalPago.toFixed(2),
    totalEstornado: totalEstornado.toFixed(2),
    saldo: saldo.toFixed(2)
  }
}

export function pagamentoEstaQuitado(resumo: ResumoPagamento): boolean {
  return resumo.status === StatusResumoPagamento.PAGO
}

// Este helper recebe o TransactionClient para que a verificacao de pagamento
// da entrega participe da mesma transacao e do mesmo CAS da ordem.
export async function buscarResumoPagamentosTx(
  tx: Prisma.TransactionClient,
  ordemId: number,
  empresaId: number,
  valorTotal: ValorDecimal
): Promise<ResumoPagamento> {
  const totais = await tx.pagamento.groupBy({
    by: ["status"],
    where: {
      ordemId,
      empresaId
    },
    _sum: {
      valor: true
    }
  })

  const confirmado = totais.find(
    total => total.status === StatusRegistroPagamento.CONFIRMADO
  )?._sum.valor
  const estornado = totais.find(
    total => total.status === StatusRegistroPagamento.ESTORNADO
  )?._sum.valor

  return calcularResumoPagamento(valorTotal, confirmado, estornado)
}

function ordemBloqueiaMovimentoFinanceiro(status: StatusOrdem): boolean {
  return (
    status === StatusOrdem.ENTREGUE ||
    status === StatusOrdem.CANCELADO
  )
}

function criarConflitoAtualizacao(
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
  ordemId: number,
  empresaId: number,
  statusEsperado: StatusOrdem,
  versaoEsperada: number
) {
  const ordemAtual = await tx.ordemServico.findUnique({
    where: {
      id_empresaId: {
        id: ordemId,
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

  return criarConflitoAtualizacao(
    statusEsperado,
    versaoEsperada,
    ordemAtual
  )
}

export async function listarPagamentosService(
  ordemId: number,
  empresaId: number
) {
  // Ordem e ledger sao carregados por uma unica consulta, evitando combinar a
  // versao antiga da ordem com pagamentos que acabaram de ser registrados.
  const ordem = await prisma.ordemServico.findUnique({
    where: {
      id_empresaId: {
        id: ordemId,
        empresaId
      }
    },
    select: {
      valor: true,
      status: true,
      versao: true,
      pagamentos: {
        select: pagamentoSelect,
        orderBy: [
          { pagoEm: "desc" },
          { id: "desc" }
        ]
      }
    }
  })

  if (!ordem) {
    return {
      sucesso: false as const,
      motivo: "ordem_nao_encontrada" as const
    }
  }

  let totalPago = new Prisma.Decimal(0)
  let totalEstornado = new Prisma.Decimal(0)

  for (const pagamento of ordem.pagamentos) {
    if (pagamento.status === StatusRegistroPagamento.CONFIRMADO) {
      totalPago = totalPago.plus(pagamento.valor)
    } else {
      totalEstornado = totalEstornado.plus(pagamento.valor)
    }
  }

  return {
    sucesso: true as const,
    pagamentos: ordem.pagamentos,
    resumo: calcularResumoPagamento(
      ordem.valor,
      totalPago,
      totalEstornado
    ),
    statusOrdem: ordem.status,
    versaoOrdem: ordem.versao
  }
}

export async function registrarPagamentoService(
  ordemId: number,
  empresaId: number,
  usuarioId: number,
  dados: RegistrarPagamentoInput
) {
  return executarTransacaoComRollback(async tx => {
    const ordemAtual = await tx.ordemServico.findUnique({
      where: {
        id_empresaId: {
          id: ordemId,
          empresaId
        }
      },
      select: {
        id: true,
        orcamentoId: true,
        valor: true,
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

    if (
      ordemAtual.status !== dados.statusEsperado ||
      ordemAtual.versao !== dados.versaoEsperada
    ) {
      return criarConflitoAtualizacao(
        dados.statusEsperado,
        dados.versaoEsperada,
        ordemAtual
      )
    }

    if (ordemBloqueiaMovimentoFinanceiro(ordemAtual.status)) {
      return {
        sucesso: false as const,
        motivo: "ordem_finalizada" as const,
        statusAtual: ordemAtual.status
      }
    }

    const resumoAtual = await buscarResumoPagamentosTx(
      tx,
      ordemId,
      empresaId,
      ordemAtual.valor
    )
    const valorPagamento = new Prisma.Decimal(dados.valor)

    if (valorPagamento.greaterThan(new Prisma.Decimal(resumoAtual.saldo))) {
      return {
        sucesso: false as const,
        motivo: "valor_excede_saldo" as const,
        valorPagamento: valorPagamento.toFixed(2),
        resumo: resumoAtual
      }
    }

    await cancelarCobrancasPendentesTx(tx, empresaId, {
      ordemId,
      orcamentoId: ordemAtual.orcamentoId
    })

    const pagaNaoConciliada = await buscarCobrancaPagaNaoConciliadaTx(
      tx,
      empresaId,
      {
        ordemId,
        orcamentoId: ordemAtual.orcamentoId
      }
    )

    if (pagaNaoConciliada) {
      abortarTransacaoComResultado({
        sucesso: false as const,
        motivo: "cobranca_em_conciliacao" as const
      })
    }

    const atualizacao = await tx.ordemServico.updateMany({
      where: {
        id: ordemId,
        empresaId,
        status: dados.statusEsperado,
        versao: dados.versaoEsperada
      },
      data: {
        versao: { increment: 1 }
      }
    })

    if (atualizacao.count === 0) {
      const falha = await buscarFalhaDeConcorrencia(
        tx,
        ordemId,
        empresaId,
        dados.statusEsperado,
        dados.versaoEsperada
      )
      abortarTransacaoComResultado(falha)
    }

    const pagamento = await tx.pagamento.create({
      data: {
        empresaId,
        ordemId,
        valor: valorPagamento,
        formaPagamento: dados.formaPagamento,
        status: StatusRegistroPagamento.CONFIRMADO,
        origem: OrigemPagamento.MANUAL,
        registradoPorId: usuarioId,
        ...(dados.pagoEm !== undefined && { pagoEm: dados.pagoEm }),
        ...(dados.observacao !== undefined && {
          observacao: dados.observacao
        })
      },
      select: pagamentoSelect
    })

    const resumo = await buscarResumoPagamentosTx(
      tx,
      ordemId,
      empresaId,
      ordemAtual.valor
    )

    return {
      sucesso: true as const,
      pagamento,
      resumo,
      versaoOrdem: dados.versaoEsperada + 1
    }
  })
}

export async function estornarPagamentoService(
  ordemId: number,
  pagamentoId: number,
  empresaId: number,
  usuarioId: number,
  dados: EstornarPagamentoInput
) {
  return prisma.$transaction(async tx => {
    const ordemAtual = await tx.ordemServico.findUnique({
      where: {
        id_empresaId: {
          id: ordemId,
          empresaId
        }
      },
      select: {
        id: true,
        valor: true,
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

    if (
      ordemAtual.status !== dados.statusEsperado ||
      ordemAtual.versao !== dados.versaoEsperada
    ) {
      return criarConflitoAtualizacao(
        dados.statusEsperado,
        dados.versaoEsperada,
        ordemAtual
      )
    }

    if (ordemBloqueiaMovimentoFinanceiro(ordemAtual.status)) {
      return {
        sucesso: false as const,
        motivo: "ordem_finalizada" as const,
        statusAtual: ordemAtual.status
      }
    }

    const pagamentoAtual = await tx.pagamento.findFirst({
      where: {
        id: pagamentoId,
        ordemId,
        empresaId
      },
      select: {
        id: true,
        status: true,
        origem: true
      }
    })

    if (!pagamentoAtual) {
      return {
        sucesso: false as const,
        motivo: "pagamento_nao_encontrado" as const
      }
    }

    if (pagamentoAtual.status === StatusRegistroPagamento.ESTORNADO) {
      return {
        sucesso: false as const,
        motivo: "pagamento_ja_estornado" as const
      }
    }

    if (pagamentoAtual.origem === OrigemPagamento.GATEWAY) {
      return {
        sucesso: false as const,
        motivo: "pagamento_gateway_exige_estorno_gateway" as const
      }
    }

    const atualizacao = await tx.ordemServico.updateMany({
      where: {
        id: ordemId,
        empresaId,
        status: dados.statusEsperado,
        versao: dados.versaoEsperada
      },
      data: {
        versao: { increment: 1 }
      }
    })

    if (atualizacao.count === 0) {
      return buscarFalhaDeConcorrencia(
        tx,
        ordemId,
        empresaId,
        dados.statusEsperado,
        dados.versaoEsperada
      )
    }

    // Depois que o CAS vence, nenhuma outra mutacao financeira da aplicacao
    // consegue alterar este pagamento antes do commit da transacao.
    const pagamento = await tx.pagamento.update({
      where: {
        id_empresaId: {
          id: pagamentoId,
          empresaId
        }
      },
      data: {
        status: StatusRegistroPagamento.ESTORNADO,
        estornadoEm: new Date(),
        estornadoPorId: usuarioId,
        motivoEstorno: dados.motivo
      },
      select: pagamentoSelect
    })

    const resumo = await buscarResumoPagamentosTx(
      tx,
      ordemId,
      empresaId,
      ordemAtual.valor
    )

    return {
      sucesso: true as const,
      pagamento,
      resumo,
      versaoOrdem: dados.versaoEsperada + 1
    }
  })
}
