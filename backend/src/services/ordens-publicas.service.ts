import { Prisma } from "../generated/prisma/client.js"
import {
  StatusOrdem,
  StatusRegistroPagamento
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import { calcularResumoPagamento } from "./pagamentos.service.js"

const descricoesStatus: Record<StatusOrdem, string> = {
  [StatusOrdem.RECEBIDO]: "Serviço recebido",
  [StatusOrdem.EM_ANALISE]: "Equipamento em análise",
  [StatusOrdem.EM_EXECUCAO]: "Serviço em execução",
  [StatusOrdem.AGUARDANDO_PECA]: "Aguardando peça",
  [StatusOrdem.PRONTO]: "Pronto para entrega",
  [StatusOrdem.ENTREGUE]: "Serviço entregue",
  [StatusOrdem.CANCELADO]: "Serviço cancelado"
}

// A seleção é uma lista positiva dos únicos dados que podem sair pela rota
// pública. A numeração pertence à empresa; IDs globais ou relacionados,
// campos técnicos, cliente, atores e custos nem sequer são lidos.
const ordemPublicaSelect = {
  numero: true,
  equipamento: true,
  status: true,
  previsaoDeEntrega: true,
  valor: true,
  orcamento: {
    select: {
      empresa: {
        select: {
          nome: true,
          telefone: true,
          email: true
        }
      }
    }
  },
  historico: {
    select: {
      status: true,
      mensagemPublica: true,
      criadoEm: true
    },
    orderBy: [
      { criadoEm: "asc" as const },
      { id: "asc" as const }
    ]
  },
  pagamentos: {
    select: {
      valor: true,
      status: true
    }
  }
} satisfies Prisma.OrdemServicoSelect

type OrdemPublicaSelecionada = Prisma.OrdemServicoGetPayload<{
  select: typeof ordemPublicaSelect
}>

function sanitizarOrdemPublica(ordem: OrdemPublicaSelecionada) {
  let totalPago = new Prisma.Decimal(0)
  let totalEstornado = new Prisma.Decimal(0)

  for (const pagamento of ordem.pagamentos) {
    if (pagamento.status === StatusRegistroPagamento.CONFIRMADO) {
      totalPago = totalPago.plus(pagamento.valor)
    } else {
      totalEstornado = totalEstornado.plus(pagamento.valor)
    }
  }

  const resumo = calcularResumoPagamento(
    ordem.valor,
    totalPago,
    totalEstornado
  )

  return {
    empresa: ordem.orcamento.empresa,
    numero: ordem.numero,
    equipamento: ordem.equipamento,
    status: ordem.status,
    statusDescricao: descricoesStatus[ordem.status],
    previsaoDeEntrega: ordem.previsaoDeEntrega,
    valorAprovado: new Prisma.Decimal(ordem.valor).toFixed(2),
    pagamento: {
      status: resumo.status,
      valorTotal: resumo.valorTotal,
      totalPago: resumo.totalPago,
      saldo: resumo.saldo
    },
    historico: ordem.historico.map(evento => ({
      status: evento.status,
      statusDescricao: descricoesStatus[evento.status],
      mensagemPublica: evento.mensagemPublica,
      criadoEm: evento.criadoEm
    }))
  }
}

export async function buscarOrdemPublicaService(token: string) {
  const ordem = await prisma.ordemServico.findUnique({
    where: { tokenAcompanhamento: token },
    select: ordemPublicaSelect
  })

  return ordem ? sanitizarOrdemPublica(ordem) : null
}
