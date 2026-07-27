import {
  ambientePagamentosClientesMercadoPago,
  gatewayPagamentoSimuladoHabilitado,
} from "../config/env.js"
import {
  AmbientePagamento,
  ProvedorPagamento,
  StatusConfiguracaoPagamento
} from "../generated/prisma/enums.js"
import {
  resolverGatewayPagamento
} from "../gateways/gateway-pagamento.factory.js"
import { prisma } from "../lib/prisma.js"
import {
  buscarResumoIntegracaoMercadoPagoService
} from "./mercado-pago-oauth.service.js"
import type { AtualizarConfiguracaoPagamentoInput } from "../validators/configuracoes-pagamento.validators.js"

const configuracaoSelect = {
  provedor: true,
  status: true,
  ambiente: true,
  ativo: true,
  pixHabilitado: true,
  versao: true,
  atualizadoEm: true
} as const

const provedoresReais = new Set<ProvedorPagamento>([
  ProvedorPagamento.MERCADO_PAGO,
  ProvedorPagamento.ASAAS
])

async function obterEstadoIntegracoesPagamento(empresaId: number) {
  const modoMercadoPago = ambientePagamentosClientesMercadoPago()
  const ambienteMercadoPago = modoMercadoPago === "PRODUCAO"
    ? AmbientePagamento.PRODUCAO
    : AmbientePagamento.TESTE
  const simuladorHabilitado = gatewayPagamentoSimuladoHabilitado()
  const integracaoOAuth = await buscarResumoIntegracaoMercadoPagoService(
    empresaId
  )
  const mercadoPagoDisponivel =
    Boolean(modoMercadoPago) &&
    integracaoOAuth.conectado &&
    integracaoOAuth.oauthDisponivel

  const integracaoMercadoPago = integracaoOAuth

  let statusMercadoPago: "CONFIGURADA" | "NAO_CONFIGURADA" | "ERRO"
  let motivoMercadoPago: string | undefined

  if (mercadoPagoDisponivel) {
    statusMercadoPago = "CONFIGURADA"
  } else if (integracaoOAuth.status === "ERRO") {
    statusMercadoPago = "ERRO"
    motivoMercadoPago = "Reconecte a conta do Mercado Pago desta empresa."
  } else if (!modoMercadoPago) {
    statusMercadoPago = integracaoOAuth.oauthDisponivel
      ? "CONFIGURADA"
      : "NAO_CONFIGURADA"
    motivoMercadoPago =
      "Cobrancas Mercado Pago para clientes estao desabilitadas neste ambiente."
  } else if (integracaoOAuth.status === "BLOQUEADA") {
    statusMercadoPago = integracaoOAuth.oauthDisponivel
      ? "CONFIGURADA"
      : "NAO_CONFIGURADA"
    motivoMercadoPago =
      "A conta conectada pertence a outro ambiente do Mercado Pago. Reconecte a conta correta."
  } else {
    statusMercadoPago = integracaoOAuth.oauthDisponivel
      ? "CONFIGURADA"
      : "NAO_CONFIGURADA"
    motivoMercadoPago = integracaoOAuth.oauthDisponivel
      ? "Conecte a conta do Mercado Pago desta empresa."
      : integracaoOAuth.motivoIndisponibilidade ??
        "OAuth do Mercado Pago nao configurado no servidor."
  }

  const provedoresDisponiveis = [
    {
      provedor: ProvedorPagamento.MANUAL,
      nome: "Pagamento manual",
      disponivel: true,
      ambientes: [AmbientePagamento.TESTE, AmbientePagamento.PRODUCAO],
      configuracaoServidor: "CONFIGURADA" as const
    },
    {
      provedor: ProvedorPagamento.SIMULADO,
      nome: "Gateway simulado",
      disponivel: simuladorHabilitado,
      ambientes: [AmbientePagamento.TESTE],
      configuracaoServidor: simuladorHabilitado
        ? "CONFIGURADA" as const
        : "NAO_CONFIGURADA" as const,
      ...(!simuladorHabilitado && {
        motivoIndisponibilidade: "O simulador nao esta habilitado neste ambiente."
      })
    },
    {
      provedor: ProvedorPagamento.MERCADO_PAGO,
      nome: "Mercado Pago",
      disponivel: mercadoPagoDisponivel,
      ambientes: [ambienteMercadoPago],
      configuracaoServidor: statusMercadoPago,
      ...(motivoMercadoPago && {
        motivoIndisponibilidade: motivoMercadoPago
      })
    },
    {
      provedor: ProvedorPagamento.ASAAS,
      nome: "Asaas",
      disponivel: false,
      ambientes: [AmbientePagamento.TESTE, AmbientePagamento.PRODUCAO],
      configuracaoServidor: "NAO_CONFIGURADA" as const,
      motivoIndisponibilidade: "Integracao ainda nao implementada."
    }
  ]

  return { provedoresDisponiveis, integracaoMercadoPago }
}

export async function provedoresPagamentoDisponiveis(empresaId: number) {
  return (await obterEstadoIntegracoesPagamento(empresaId))
    .provedoresDisponiveis
}

async function garantirConfiguracaoPagamento(empresaId: number) {
  return prisma.configuracaoPagamento.upsert({
    where: { empresaId },
    create: { empresaId },
    update: {},
    select: configuracaoSelect
  })
}

export async function buscarConfiguracaoPagamentoService(
  empresaId: number
) {
  const [configuracao, integracoes] = await Promise.all([
    garantirConfiguracaoPagamento(empresaId),
    obterEstadoIntegracoesPagamento(empresaId)
  ])

  return {
    configuracao,
    provedoresDisponiveis: integracoes.provedoresDisponiveis,
    integracaoMercadoPago: integracoes.integracaoMercadoPago
  }
}

export async function atualizarConfiguracaoPagamentoService(
  empresaId: number,
  dados: AtualizarConfiguracaoPagamentoInput
) {
  const atual = await garantirConfiguracaoPagamento(empresaId)

  if (atual.versao !== dados.versaoEsperada) {
    return {
      sucesso: false as const,
      motivo: "conflito_atualizacao" as const,
      versaoEsperada: dados.versaoEsperada,
      versaoAtual: atual.versao,
      configuracaoAtual: atual
    }
  }

  const provedor = dados.provedor ?? atual.provedor
  const ambiente = dados.ambiente ?? atual.ambiente
  // Selecionar um provedor ainda nao conectado o deixa inativo por padrao.
  const ativo = dados.ativo ?? (
    dados.provedor !== undefined && provedoresReais.has(dados.provedor)
      ? false
      : atual.ativo
  )
  const pixHabilitado = dados.pixHabilitado ?? atual.pixHabilitado

  if (
    provedor === ProvedorPagamento.MERCADO_PAGO &&
    ambiente !== ambientePagamentosClientesMercadoPago()
  ) {
    return {
      sucesso: false as const,
      motivo: "mercado_pago_ambiente_indisponivel" as const
    }
  }

  const gateway = await resolverGatewayPagamento(
    provedor,
    { empresaId, ambiente }
  )

  if (provedoresReais.has(provedor) && ativo && !gateway) {
    return {
      sucesso: false as const,
      motivo: "provedor_nao_conectado" as const,
      provedor
    }
  }

  if (
    provedor === ProvedorPagamento.SIMULADO &&
    ambiente !== AmbientePagamento.TESTE
  ) {
    return {
      sucesso: false as const,
      motivo: "simulador_somente_teste" as const
    }
  }

  if (
    provedor === ProvedorPagamento.SIMULADO &&
    !gatewayPagamentoSimuladoHabilitado() &&
    ativo
  ) {
    return {
      sucesso: false as const,
      motivo: "simulador_indisponivel" as const
    }
  }

  const status = provedoresReais.has(provedor)
    ? gateway
      ? ativo
        ? StatusConfiguracaoPagamento.ATIVA
        : StatusConfiguracaoPagamento.INATIVA
      : StatusConfiguracaoPagamento.NAO_CONFIGURADA
    : ativo
      ? StatusConfiguracaoPagamento.ATIVA
      : StatusConfiguracaoPagamento.INATIVA

  const atualizacao = await prisma.configuracaoPagamento.updateMany({
    where: {
      empresaId,
      versao: dados.versaoEsperada
    },
    data: {
      provedor,
      ambiente,
      ativo,
      pixHabilitado,
      status,
      versao: { increment: 1 }
    }
  })

  if (atualizacao.count === 0) {
    const configuracaoAtual = await prisma.configuracaoPagamento.findUniqueOrThrow({
      where: { empresaId },
      select: configuracaoSelect
    })

    return {
      sucesso: false as const,
      motivo: "conflito_atualizacao" as const,
      versaoEsperada: dados.versaoEsperada,
      versaoAtual: configuracaoAtual.versao,
      configuracaoAtual
    }
  }

  const configuracao = await prisma.configuracaoPagamento.findUniqueOrThrow({
    where: { empresaId },
    select: configuracaoSelect
  })

  const integracoes = await obterEstadoIntegracoesPagamento(empresaId)

  return {
    sucesso: true as const,
    configuracao,
    provedoresDisponiveis: integracoes.provedoresDisponiveis,
    integracaoMercadoPago: integracoes.integracaoMercadoPago
  }
}
