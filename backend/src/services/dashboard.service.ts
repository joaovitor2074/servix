import {
  StatusOrcamento,
  StatusOrdem,
  StatusRegistroPagamento
} from "../generated/prisma/enums.js"
import { Prisma } from "../generated/prisma/client.js"
import { prisma } from "../lib/prisma.js"
import {
  calcularResumoPagamento,
  type ResumoPagamento
} from "./pagamentos.service.js"

const STATUS_ORDENS_ABERTAS = [
  StatusOrdem.RECEBIDO,
  StatusOrdem.EM_ANALISE,
  StatusOrdem.EM_EXECUCAO,
  StatusOrdem.AGUARDANDO_PECA,
  StatusOrdem.PRONTO
] as const

type OrdemResumoDashboard = {
  id: number
  equipamento: string
  status: StatusOrdem
  criadoEm: Date
  atualizadoEm: Date
  previsaoDeEntrega: Date | null
  cliente: {
    id: number
    nome: string
  }
}

type OrdemRecente = Omit<
  OrdemResumoDashboard,
  "atualizadoEm" | "previsaoDeEntrega"
>

type TipoPendencia =
  | "AGUARDANDO_PECA"
  | "AGUARDANDO_PAGAMENTO"
  | "AGUARDANDO_ENTREGA"

type PendenciaOperacional = OrdemResumoDashboard & {
  tipo: TipoPendencia
  pagamento: ResumoPagamento | null
}

type Resumo = {
  clientes: {
    total: number
  }
  ordens: {
    total: number
    abertas: number
    aguardandoPeca: number
    prontasParaFinalizar: number
    porStatus: Record<StatusOrdem, number>
    recentes: OrdemRecente[]
    emAberto: OrdemResumoDashboard[]
    pendencias: PendenciaOperacional[]
  }
  orcamentos: {
    aguardandoCliente: number
    aprovadosParaOrdem: number
  }
}

const ordemAbertaSelect = {
  id: true,
  equipamento: true,
  status: true,
  criadoEm: true,
  atualizadoEm: true,
  previsaoDeEntrega: true,
  cliente: {
    select: {
      id: true,
      nome: true
    }
  }
} as const

export async function buscarResumoDashboardService(
  empresaId: number
): Promise<Resumo> {
  // Todas as consultas usam o empresaId autenticado e compartilham a mesma
  // transacao, evitando que a dashboard misture dados de momentos diferentes.
  const [
    totalClientes,
    contagensPorStatus,
    ordensRecentes,
    ordensEmAberto,
    ordensComPendencia,
    contagensOrcamentos
  ] = await prisma.$transaction([
    prisma.cliente.count({
      where: { empresaId }
    }),
    prisma.ordemServico.groupBy({
      by: ["status"],
      where: { empresaId },
      _count: {
        _all: true
      }
    }),
    prisma.ordemServico.findMany({
      where: { empresaId },
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
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
    }),
    prisma.ordemServico.findMany({
      where: {
        empresaId,
        status: { in: [...STATUS_ORDENS_ABERTAS] }
      },
      orderBy: [{ atualizadoEm: "desc" }, { id: "desc" }],
      take: 8,
      select: ordemAbertaSelect
    }),
    prisma.ordemServico.findMany({
      where: {
        empresaId,
        status: {
          in: [StatusOrdem.AGUARDANDO_PECA, StatusOrdem.PRONTO]
        }
      },
      // A fila prioriza o que esta parado ha mais tempo.
      orderBy: [{ atualizadoEm: "asc" }, { id: "asc" }],
      take: 8,
      select: {
        ...ordemAbertaSelect,
        valor: true,
        pagamentos: {
          select: {
            valor: true,
            status: true
          }
        }
      }
    }),
    prisma.orcamento.groupBy({
      by: ["status"],
      where: {
        empresaId,
        status: {
          in: [StatusOrcamento.ENVIADO, StatusOrcamento.APROVADO]
        }
      },
      _count: {
        _all: true
      }
    })
  ])

  const porStatus = Object.fromEntries(
    Object.values(StatusOrdem).map(status => [status, 0])
  ) as Record<StatusOrdem, number>

  for (const contagem of contagensPorStatus) {
    porStatus[contagem.status] = contagem._count._all
  }

  const contagemOrcamento = (status: StatusOrcamento) =>
    contagensOrcamentos.find(item => item.status === status)?._count._all ?? 0

  const pendencias: PendenciaOperacional[] = ordensComPendencia.map(ordem => {
    const { pagamentos, valor, ...dadosOrdem } = ordem

    if (ordem.status === StatusOrdem.AGUARDANDO_PECA) {
      return {
        ...dadosOrdem,
        tipo: "AGUARDANDO_PECA",
        pagamento: null
      }
    }

    const totalPago = pagamentos
      .filter(item => item.status === StatusRegistroPagamento.CONFIRMADO)
      .reduce(
        (total, item) => total.plus(item.valor),
        new Prisma.Decimal(0)
      )
    const totalEstornado = pagamentos
      .filter(item => item.status === StatusRegistroPagamento.ESTORNADO)
      .reduce(
        (total, item) => total.plus(item.valor),
        new Prisma.Decimal(0)
      )
    const pagamento = calcularResumoPagamento(
      valor,
      totalPago,
      totalEstornado
    )

    return {
      ...dadosOrdem,
      tipo:
        pagamento.status === "PAGO"
          ? "AGUARDANDO_ENTREGA"
          : "AGUARDANDO_PAGAMENTO",
      pagamento
    }
  })

  const totalOrdens = Object.values(porStatus).reduce(
    (total, quantidade) => total + quantidade,
    0
  )
  const abertas = STATUS_ORDENS_ABERTAS.reduce(
    (total, status) => total + porStatus[status],
    0
  )

  return {
    clientes: {
      total: totalClientes
    },
    ordens: {
      total: totalOrdens,
      abertas,
      aguardandoPeca: porStatus.AGUARDANDO_PECA,
      prontasParaFinalizar: porStatus.PRONTO,
      recentes: ordensRecentes,
      emAberto: ordensEmAberto,
      pendencias,
      porStatus
    },
    orcamentos: {
      aguardandoCliente: contagemOrcamento(StatusOrcamento.ENVIADO),
      aprovadosParaOrdem: contagemOrcamento(StatusOrcamento.APROVADO)
    }
  }
}
