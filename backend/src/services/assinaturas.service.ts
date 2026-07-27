import { randomUUID } from "node:crypto"
import { Prisma } from "../generated/prisma/client.js"
import {
  AmbienteAssinatura,
  OrigemHistoricoAssinatura,
  ProvedorAssinatura,
  StatusAssinatura,
  StatusEmpresa,
  TipoHistoricoAssinatura
} from "../generated/prisma/enums.js"
import { obterConfiguracaoAssinaturasMercadoPago } from "../config/env.js"
import { AppError } from "../errors/app-error.js"
import {
  buscarAssinaturaPorReferenciaMercadoPago,
  cancelarAssinaturaMercadoPago,
  criarAssinaturaMercadoPago,
  ErroMercadoPagoAssinaturas,
  obterAssinaturaMercadoPago,
  obterPagamentoAutorizadoMercadoPago,
  obterRequestIdMercadoPago,
  type AssinaturaMercadoPago
} from "../integrations/mercado-pago-assinaturas.client.js"
import { prisma } from "../lib/prisma.js"

const PLANO_CODIGO = "SERVIX_MENSAL"
const PLANO_NOME = "Servix Mensal"
const VALOR_MENSAL = new Prisma.Decimal("79.90")

const assinaturaSelect = {
  id: true,
  empresaId: true,
  planoCodigo: true,
  planoNome: true,
  valorMensal: true,
  ambiente: true,
  provedor: true,
  status: true,
  mercadoPagoPlanoId: true,
  mercadoPagoAssinaturaId: true,
  referenciaExterna: true,
  emailPagador: true,
  checkoutUrl: true,
  ativadaEm: true,
  proximaCobrancaEm: true,
  ultimaSincronizacaoEm: true,
  canceladaEm: true,
  criadoEm: true,
  atualizadoEm: true
} as const

export type IniciarAssinaturaInput = {
  emailPagador: string
  versaoTermos: string
}

type TipoNotificacaoAssinaturaMercadoPago =
  | "subscription_preapproval"
  | "subscription_authorized_payment"

const UUID_CHECKOUT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validarCheckoutToken(checkoutToken: string): string {
  const tokenNormalizado = checkoutToken.trim()

  if (!UUID_CHECKOUT.test(tokenNormalizado)) {
    throw new AppError(
      "O token do checkout é inválido.",
      400,
      "CHECKOUT_ASSINATURA_INVALIDO"
    )
  }

  return tokenNormalizado
}

function dataOpcional(valor: string | null | undefined): Date | null {
  if (!valor) return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data
}

function statusInternoMercadoPago(status: string | undefined): StatusAssinatura {
  switch (status?.toLowerCase()) {
    case "authorized":
      return StatusAssinatura.ATIVA
    case "paused":
      return StatusAssinatura.PAUSADA
    case "canceled":
    case "cancelled":
      return StatusAssinatura.CANCELADA
    default:
      return StatusAssinatura.PENDENTE
  }
}

function statusEmpresaPorAssinatura(status: StatusAssinatura): StatusEmpresa {
  switch (status) {
    case StatusAssinatura.ATIVA:
    case StatusAssinatura.INADIMPLENTE:
      // INADIMPLENTE mantém acesso durante o período de tolerância.
      return StatusEmpresa.ATIVA
    case StatusAssinatura.PENDENTE:
      return StatusEmpresa.PENDENTE_ASSINATURA
    case StatusAssinatura.PAUSADA:
    case StatusAssinatura.CANCELADA:
      return StatusEmpresa.SUSPENSA
  }
}

function referenciaExternaDaEmpresa(empresaId: number): string {
  return `servix_empresa_${empresaId}`
}

function urlRetornoCheckout(
  baseUrl: string,
  checkoutToken: string
): string {
  // O Mercado Pago acrescenta os próprios parâmetros ao voltar. Manter o
  // token no caminho evita que ele seja concatenado ao valor de `checkout`.
  const url = new URL(
    `/cadastro/concluido/${encodeURIComponent(checkoutToken)}`,
    baseUrl
  )
  return url.toString()
}

function urlRetornoReativacao(baseUrl: string): string {
  const url = new URL("/assinatura-suspensa", baseUrl)
  url.searchParams.set("retorno", "mercado-pago")
  return url.toString()
}

function checkoutUrlMercadoPagoValida(valor: string | null | undefined):
  valor is string {
  if (!valor) return false

  try {
    const url = new URL(valor)
    return (
      url.protocol === "https:" &&
      /(^|\.)mercadopago\.com(?:\.[a-z]{2})?$/i.test(url.hostname)
    )
  } catch {
    return false
  }
}

function traduzirErroMercadoPago(error: unknown): never {
  if (error instanceof ErroMercadoPagoAssinaturas) {
    const timeout = error.codigo === "TEMPO_LIMITE"

    // Somente metadados seguros seguem para a resposta. Credenciais, payload e
    // token do cartão nunca são registrados nem devolvidos ao cliente.
    console.error("Falha na API de assinaturas do Mercado Pago:", {
      statusHttp: error.statusHttp,
      codigo: error.codigo,
      requestId: error.requestId
    })

    throw new AppError(
      timeout
        ? "O Mercado Pago demorou para responder. Tente novamente."
        : error.message,
      timeout ? 504 : 502,
      timeout ? "MERCADO_PAGO_TEMPO_LIMITE" : "MERCADO_PAGO_ASSINATURAS_ERRO",
      {
        provedor: "MERCADO_PAGO",
        ...(error.statusHttp && { statusHttp: error.statusHttp }),
        ...(error.codigo && { codigoProvedor: error.codigo }),
        ...(error.requestId && { requestId: error.requestId })
      }
    )
  }

  throw error
}

async function persistirAssinaturaMercadoPago(
  empresaId: number,
  assinaturaMercadoPago: AssinaturaMercadoPago,
  origem: OrigemHistoricoAssinatura = OrigemHistoricoAssinatura.CHECKOUT,
  permitirAtivacao = true
) {
  const statusRecebido = statusInternoMercadoPago(assinaturaMercadoPago.status)
  const agora = new Date()
  const referenciaExterna = String(
    assinaturaMercadoPago.external_reference ?? referenciaExternaDaEmpresa(empresaId)
  )

  return prisma.$transaction(async tx => {
    const atual = await tx.assinaturaEmpresa.findUnique({
      where: { empresaId },
      select: {
        id: true,
        status: true,
        ativadaEm: true,
        canceladaEm: true
      }
    })

    if (!atual) {
      throw new AppError(
        "A assinatura da empresa nao foi encontrada.",
        404,
        "ASSINATURA_NAO_ENCONTRADA"
      )
    }

    // Na reativacao, somente o webhook pode promover para ATIVA. Se ele tiver
    // vencido a corrida contra a resposta do checkout, preservamos a ativacao.
    const status = !permitirAtivacao
      ? atual.status === StatusAssinatura.ATIVA
        ? StatusAssinatura.ATIVA
        : statusRecebido === StatusAssinatura.ATIVA
          ? StatusAssinatura.PENDENTE
          : statusRecebido
      : statusRecebido

    const assinatura = await tx.assinaturaEmpresa.update({
      where: { empresaId },
      data: {
        status,
        mercadoPagoAssinaturaId: assinaturaMercadoPago.id,
        referenciaExterna,
        ...(assinaturaMercadoPago.payer_email && {
          emailPagador: assinaturaMercadoPago.payer_email.toLowerCase()
        }),
        ...(assinaturaMercadoPago.init_point && {
          checkoutUrl: assinaturaMercadoPago.init_point
        }),
        proximaCobrancaEm: dataOpcional(
          assinaturaMercadoPago.next_payment_date
        ),
        ultimaSincronizacaoEm: agora,
        ativadaEm:
          status === StatusAssinatura.ATIVA
            ? atual.canceladaEm
              ? agora
              : atual.ativadaEm ?? agora
            : atual?.ativadaEm ?? null,
        canceladaEm:
          status === StatusAssinatura.CANCELADA
            ? atual.canceladaEm ?? agora
            : status === StatusAssinatura.ATIVA
              ? null
              : atual.canceladaEm,
        versao: { increment: 1 }
      },
      select: assinaturaSelect
    })

    await tx.empresa.update({
      where: { id: empresaId },
      data: { status: statusEmpresaPorAssinatura(status) }
    })

    const tipo = status === StatusAssinatura.CANCELADA
      ? TipoHistoricoAssinatura.CANCELADA
      : status === StatusAssinatura.ATIVA && atual.status !== StatusAssinatura.ATIVA
        ? atual.ativadaEm
          ? TipoHistoricoAssinatura.REATIVADA
          : TipoHistoricoAssinatura.ATIVADA
        : TipoHistoricoAssinatura.SINCRONIZADA

    await tx.historicoAssinaturaEmpresa.create({
      data: {
        empresaId,
        assinaturaEmpresaId: atual.id,
        tipo,
        origem,
        statusAnterior: atual.status,
        statusNovo: status,
        mercadoPagoAssinaturaId: assinaturaMercadoPago.id,
        requestIdProvedor: obterRequestIdMercadoPago(assinaturaMercadoPago)
      }
    })

    return assinatura
  })
}


export async function iniciarAssinaturaEmpresaService(
  empresaId: number,
  dados: IniciarAssinaturaInput
) {
  const configuracao = obterConfiguracaoAssinaturasMercadoPago()

  if (configuracao.status !== "CONFIGURADA") {
    throw new AppError(
      "As assinaturas do Servix não estão configuradas no servidor.",
      503,
      "ASSINATURAS_NAO_CONFIGURADAS"
    )
  }

  const emailPagador = dados.emailPagador.trim().toLowerCase()
  const versaoTermos = dados.versaoTermos.trim()
  const ambiente = configuracao.modo === "PRODUCAO"
    ? AmbienteAssinatura.PRODUCAO
    : AmbienteAssinatura.TESTE

  if (!emailPagador || !emailPagador.includes("@")) {
    throw new AppError("Informe um e-mail válido.", 400, "EMAIL_INVALIDO")
  }

  if (
    configuracao.modo === "TESTE" &&
    (
      !emailPagador.endsWith("@testuser.com") ||
      emailPagador === "test@testuser.com"
    )
  ) {
    throw new AppError(
      "Use o e-mail exato de uma conta do tipo Comprador criada em Contas de teste do Mercado Pago. O endereço test@testuser.com não é válido para este fluxo de Assinaturas.",
      400,
      "COMPRADOR_TESTE_INVALIDO"
    )
  }

  if (!versaoTermos) {
    throw new AppError(
      "A versão dos termos é obrigatória.",
      400,
      "VERSAO_TERMOS_OBRIGATORIA"
    )
  }

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      assinatura: {
        select: {
          status: true,
          mercadoPagoAssinaturaId: true,
          referenciaExterna: true,
          checkoutToken: true
        }
      }
    }
  })

  if (!empresa) {
    throw new AppError("Empresa não encontrada.", 404, "EMPRESA_NAO_ENCONTRADA")
  }

  if (!empresa.assinatura) {
    throw new AppError(
      "A empresa não possui uma assinatura preparada para checkout.",
      409,
      "ASSINATURA_NAO_PREPARADA"
    )
  }

  if (empresa.assinatura?.status === StatusAssinatura.ATIVA) {
    throw new AppError(
      "A empresa já possui uma assinatura ativa.",
      409,
      "ASSINATURA_JA_ATIVA"
    )
  }

  if (empresa.assinatura?.mercadoPagoAssinaturaId) {
    try {
      const remota = await obterAssinaturaMercadoPago(
        empresa.assinatura.mercadoPagoAssinaturaId
      )
      return {
        assinatura: await persistirAssinaturaMercadoPago(empresaId, remota),
        recuperada: true
      }
    } catch (error) {
      traduzirErroMercadoPago(error)
    }
  }

  const referenciaExterna =
    empresa.assinatura?.referenciaExterna ?? referenciaExternaDaEmpresa(empresaId)

  await prisma.$transaction(async tx => {
    await tx.assinaturaEmpresa.upsert({
      where: { empresaId },
      create: {
        empresaId,
        planoCodigo: PLANO_CODIGO,
        planoNome: PLANO_NOME,
        valorMensal: VALOR_MENSAL,
        ambiente,
        provedor: ProvedorAssinatura.MERCADO_PAGO_SERVIX,
        status: StatusAssinatura.PENDENTE,
        mercadoPagoPlanoId: null,
        referenciaExterna,
        emailPagador,
        versaoTermos,
        termosAceitosEm: new Date()
      },
      update: {
        planoCodigo: PLANO_CODIGO,
        planoNome: PLANO_NOME,
        valorMensal: VALOR_MENSAL,
        ambiente,
        provedor: ProvedorAssinatura.MERCADO_PAGO_SERVIX,
        status: StatusAssinatura.PENDENTE,
        mercadoPagoPlanoId: null,
        referenciaExterna,
        emailPagador,
        versaoTermos,
        termosAceitosEm: new Date(),
        canceladaEm: null,
        versao: { increment: 1 }
      }
    })

    await tx.empresa.update({
      where: { id: empresaId },
      data: { status: StatusEmpresa.PENDENTE_ASSINATURA }
    })
  })

  try {
    // Recupera uma criação anterior cuja resposta possa ter sido perdida.
    const existente = await buscarAssinaturaPorReferenciaMercadoPago(
      referenciaExterna
    )

    const remota =
      existente ??
      (await criarAssinaturaMercadoPago({
        emailPagador,
        referenciaExterna,
        transactionAmount: Number(VALOR_MENSAL),
        currencyId: "BRL",
        backUrl: urlRetornoCheckout(
          configuracao.backUrl,
          empresa.assinatura.checkoutToken
        )
      }))

    if (!checkoutUrlMercadoPagoValida(remota.init_point)) {
      throw new AppError(
        "O Mercado Pago não retornou um endereço de checkout válido.",
        502,
        "CHECKOUT_MERCADO_PAGO_INVALIDO"
      )
    }

    return {
      assinatura: await persistirAssinaturaMercadoPago(empresaId, remota),
      recuperada: Boolean(existente)
    }
  } catch (error) {
    traduzirErroMercadoPago(error)
  }
}

export async function buscarAssinaturaEmpresaService(empresaId: number) {
  return prisma.assinaturaEmpresa.findUnique({
    where: { empresaId },
    select: assinaturaSelect
  })
}

export async function sincronizarAssinaturaEmpresaService(empresaId: number) {
  const assinatura = await prisma.assinaturaEmpresa.findUnique({
    where: { empresaId },
    select: { mercadoPagoAssinaturaId: true }
  })

  if (!assinatura?.mercadoPagoAssinaturaId) {
    throw new AppError(
      "A empresa ainda não possui assinatura no Mercado Pago.",
      404,
      "ASSINATURA_MERCADO_PAGO_NAO_ENCONTRADA"
    )
  }

  try {
    const remota = await obterAssinaturaMercadoPago(
      assinatura.mercadoPagoAssinaturaId
    )
    return persistirAssinaturaMercadoPago(
      empresaId,
      remota,
      OrigemHistoricoAssinatura.SINCRONIZACAO_MANUAL
    )
  } catch (error) {
    traduzirErroMercadoPago(error)
  }
}

function statusMercadoPagoCancelado(status: string | undefined): boolean {
  const normalizado = status?.trim().toLowerCase()
  return normalizado === "canceled" || normalizado === "cancelled"
}

export async function cancelarAssinaturaEmpresaService(empresaId: number) {
  const assinatura = await prisma.assinaturaEmpresa.findUnique({
    where: { empresaId },
    select: {
      status: true,
      mercadoPagoAssinaturaId: true
    }
  })

  if (!assinatura?.mercadoPagoAssinaturaId) {
    throw new AppError(
      "A empresa ainda não possui assinatura no Mercado Pago.",
      404,
      "ASSINATURA_MERCADO_PAGO_NAO_ENCONTRADA"
    )
  }

  if (assinatura.status === StatusAssinatura.CANCELADA) {
    return buscarAssinaturaEmpresaService(empresaId)
  }

  try {
    const cancelada = await cancelarAssinaturaMercadoPago(
      assinatura.mercadoPagoAssinaturaId
    )

    // O PUT normalmente devolve o estado completo. Caso o provedor responda
    // sem confirmar o status, uma leitura adicional evita suspender a empresa
    // com base em uma resposta parcial.
    const remota = statusMercadoPagoCancelado(cancelada.status)
      ? cancelada
      : await obterAssinaturaMercadoPago(
          assinatura.mercadoPagoAssinaturaId
        )

    if (!statusMercadoPagoCancelado(remota.status)) {
      throw new AppError(
        "O Mercado Pago não confirmou o cancelamento da assinatura.",
        409,
        "CANCELAMENTO_ASSINATURA_NAO_CONFIRMADO"
      )
    }

    return persistirAssinaturaMercadoPago(
      empresaId,
      remota,
      OrigemHistoricoAssinatura.CANCELAMENTO_ADMIN
    )
  } catch (error) {
    traduzirErroMercadoPago(error)
  }
}

export async function buscarPortalAssinaturaEmpresaService(empresaId: number) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      status: true,
      assinatura: { select: assinaturaSelect }
    }
  })

  if (!empresa) {
    throw new AppError("Empresa nao encontrada.", 404, "EMPRESA_NAO_ENCONTRADA")
  }

  return {
    statusEmpresa: empresa.status,
    assinatura: empresa.assinatura
  }
}

export async function buscarPainelAssinaturaEmpresaService(empresaId: number) {
  const [assinatura, historico, webhooks, falhas] = await Promise.all([
    buscarAssinaturaEmpresaService(empresaId),
    prisma.historicoAssinaturaEmpresa.findMany({
      where: { empresaId },
      orderBy: { criadoEm: "desc" },
      take: 30,
      select: {
        id: true,
        tipo: true,
        origem: true,
        statusAnterior: true,
        statusNovo: true,
        mercadoPagoAssinaturaId: true,
        requestIdProvedor: true,
        criadoEm: true
      }
    }),
    prisma.eventoWebhookAssinatura.findMany({
      where: { empresaId },
      orderBy: { recebidoEm: "desc" },
      take: 30,
      select: {
        id: true,
        requestId: true,
        tipo: true,
        recursoId: true,
        status: true,
        tentativas: true,
        ultimaTentativaEm: true,
        proximaTentativaEm: true,
        processadoEm: true,
        ultimoErro: true,
        alertaEmitidoEm: true,
        recebidoEm: true
      }
    }),
    prisma.eventoWebhookAssinatura.count({
      where: {
        empresaId,
        status: "FALHA"
      }
    })
  ])

  return {
    assinatura,
    historico,
    webhooks,
    monitoramento: {
      falhasPendentes: falhas,
      alerta: webhooks.some(evento => Boolean(evento.alertaEmitidoEm))
    }
  }
}

type OpcoesReativacaoAssinatura = {
  gerarNovoCheckout?: boolean
}

export async function reativarAssinaturaEmpresaService(
  empresaId: number,
  opcoes: OpcoesReativacaoAssinatura = {}
) {
  const configuracao = obterConfiguracaoAssinaturasMercadoPago()

  if (configuracao.status !== "CONFIGURADA") {
    throw new AppError(
      "As assinaturas do Servix nao estao configuradas no servidor.",
      503,
      "ASSINATURAS_NAO_CONFIGURADAS"
    )
  }

  let assinatura = await prisma.assinaturaEmpresa.findUnique({
    where: { empresaId },
    select: {
      id: true,
      status: true,
      emailPagador: true,
      referenciaExterna: true,
      mercadoPagoAssinaturaId: true,
      checkoutUrl: true,
      valorMensal: true
    }
  })

  if (!assinatura) {
    throw new AppError(
      "A assinatura da empresa nao foi encontrada.",
      404,
      "ASSINATURA_NAO_ENCONTRADA"
    )
  }

  if (assinatura.status === StatusAssinatura.ATIVA) {
    throw new AppError(
      "A assinatura ja esta ativa.",
      409,
      "ASSINATURA_JA_ATIVA"
    )
  }

  if (assinatura.status === StatusAssinatura.PAUSADA) {
    throw new AppError(
      "Uma assinatura pausada deve ser revisada pelo suporte antes da reativacao.",
      409,
      "ASSINATURA_PAUSADA"
    )
  }

  const emailPagador = assinatura.emailPagador?.trim().toLowerCase()
  if (!emailPagador) {
    throw new AppError(
      "A assinatura nao possui e-mail pagador para gerar um novo checkout.",
      409,
      "EMAIL_PAGADOR_NAO_ENCONTRADO"
    )
  }

  const reativacaoEmAndamento =
    assinatura.status === StatusAssinatura.PENDENTE &&
    assinatura.referenciaExterna?.includes("_reativacao_")

  if (
    reativacaoEmAndamento &&
    checkoutUrlMercadoPagoValida(assinatura.checkoutUrl) &&
    !opcoes.gerarNovoCheckout
  ) {
    return {
      checkoutUrl: assinatura.checkoutUrl,
      status: assinatura.status,
      recuperada: true
    }
  }

  if (reativacaoEmAndamento && opcoes.gerarNovoCheckout) {
    if (assinatura.mercadoPagoAssinaturaId) {
      const remotaAtual = await obterAssinaturaMercadoPago(
        assinatura.mercadoPagoAssinaturaId
      )
      const statusRemoto = statusInternoMercadoPago(remotaAtual.status)

      if (statusRemoto === StatusAssinatura.ATIVA) {
        throw new AppError(
          "O Mercado Pago ja confirmou esta assinatura. Aguarde o webhook para liberar o acesso.",
          409,
          "ASSINATURA_AGUARDANDO_WEBHOOK"
        )
      }

      if (statusRemoto === StatusAssinatura.PENDENTE) {
        await cancelarAssinaturaMercadoPago(
          assinatura.mercadoPagoAssinaturaId
        )
      }
    }

    assinatura = {
      ...assinatura,
      status: StatusAssinatura.CANCELADA
    }
  }

  if (!reativacaoEmAndamento || opcoes.gerarNovoCheckout) {
    const referenciaExterna =
      `servix_empresa_${empresaId}_reativacao_${randomUUID()}`

    await prisma.$transaction(async tx => {
      await tx.assinaturaEmpresa.update({
        where: { empresaId },
        data: {
          status: StatusAssinatura.PENDENTE,
          referenciaExterna,
          mercadoPagoAssinaturaId: null,
          checkoutUrl: null,
          proximaCobrancaEm: null,
          ativadaEm: null,
          canceladaEm: null,
          ultimaSincronizacaoEm: null,
          versao: { increment: 1 }
        }
      })
      await tx.empresa.update({
        where: { id: empresaId },
        data: { status: StatusEmpresa.PENDENTE_ASSINATURA }
      })
      await tx.historicoAssinaturaEmpresa.create({
        data: {
          empresaId,
          assinaturaEmpresaId: assinatura!.id,
          tipo: TipoHistoricoAssinatura.REATIVACAO_SOLICITADA,
          origem: OrigemHistoricoAssinatura.REATIVACAO_ADMIN,
          statusAnterior: assinatura!.status,
          statusNovo: StatusAssinatura.PENDENTE,
          mercadoPagoAssinaturaId: assinatura!.mercadoPagoAssinaturaId
        }
      })
    })

    assinatura = {
      ...assinatura,
      status: StatusAssinatura.PENDENTE,
      referenciaExterna,
      mercadoPagoAssinaturaId: null,
      checkoutUrl: null
    }
  }

  const referenciaExterna = assinatura.referenciaExterna!

  try {
    const existente = await buscarAssinaturaPorReferenciaMercadoPago(
      referenciaExterna
    )
    const remota = existente ?? await criarAssinaturaMercadoPago({
      emailPagador,
      referenciaExterna,
      transactionAmount: Number(assinatura.valorMensal),
      currencyId: "BRL",
      backUrl: urlRetornoReativacao(configuracao.backUrl)
    })

    if (!checkoutUrlMercadoPagoValida(remota.init_point)) {
      throw new AppError(
        "O Mercado Pago nao retornou um checkout valido para reativacao.",
        502,
        "CHECKOUT_MERCADO_PAGO_INVALIDO"
      )
    }

    const persistida = await persistirAssinaturaMercadoPago(
      empresaId,
      remota,
      OrigemHistoricoAssinatura.REATIVACAO_ADMIN,
      false
    )

    return {
      checkoutUrl: persistida.checkoutUrl,
      status: persistida.status,
      recuperada: Boolean(existente)
    }
  } catch (error) {
    traduzirErroMercadoPago(error)
  }
}

async function processarPreapproval(assinaturaId: string) {
  const remota = await obterAssinaturaMercadoPago(assinaturaId)
  const referencia = String(remota.external_reference ?? "")

  const local = await prisma.assinaturaEmpresa.findFirst({
    where: {
      OR: [
        { mercadoPagoAssinaturaId: remota.id },
        ...(referencia ? [{ referenciaExterna: referencia }] : [])
      ]
    },
    select: { empresaId: true }
  })

  if (!local) return { processada: false as const, motivo: "nao_encontrada" as const }

  await persistirAssinaturaMercadoPago(
    local.empresaId,
    remota,
    OrigemHistoricoAssinatura.WEBHOOK
  )
  return { processada: true as const, empresaId: local.empresaId }
}

async function processarPagamentoAutorizado(pagamentoId: string) {
  const pagamento = await obterPagamentoAutorizadoMercadoPago(pagamentoId)

  if (!pagamento.preapproval_id) {
    return { processada: false as const, motivo: "sem_preapproval" as const }
  }

  const local = await prisma.assinaturaEmpresa.findUnique({
    where: { mercadoPagoAssinaturaId: pagamento.preapproval_id },
    select: { empresaId: true }
  })

  if (!local) return { processada: false as const, motivo: "nao_encontrada" as const }

  if (pagamento.status?.toLowerCase() === "recycling") {
    await prisma.$transaction(async tx => {
      const atual = await tx.assinaturaEmpresa.findUniqueOrThrow({
        where: { empresaId: local.empresaId },
        select: { id: true, status: true, mercadoPagoAssinaturaId: true }
      })
      await tx.assinaturaEmpresa.update({
        where: { empresaId: local.empresaId },
        data: {
          status: StatusAssinatura.INADIMPLENTE,
          ultimaSincronizacaoEm: new Date(),
          versao: { increment: 1 }
        }
      })
      await tx.historicoAssinaturaEmpresa.create({
        data: {
          empresaId: local.empresaId,
          assinaturaEmpresaId: atual.id,
          tipo: TipoHistoricoAssinatura.INADIMPLENCIA_DETECTADA,
          origem: OrigemHistoricoAssinatura.WEBHOOK,
          statusAnterior: atual.status,
          statusNovo: StatusAssinatura.INADIMPLENTE,
          mercadoPagoAssinaturaId: atual.mercadoPagoAssinaturaId,
          requestIdProvedor: obterRequestIdMercadoPago(pagamento)
        }
      })
    })

    // O acesso permanece ativo durante a tolerância. Uma rotina posterior pode
    // suspender a empresa após o limite comercial definido pelo Servix.
    return {
      processada: true as const,
      inadimplente: true as const,
      empresaId: local.empresaId
    }
  }

  // Para processed, waiting for gateway ou scheduled, a assinatura é a fonte
  // de verdade do vínculo. Relê o preapproval e sincroniza o estado atual.
  const remota = await obterAssinaturaMercadoPago(pagamento.preapproval_id)
  await persistirAssinaturaMercadoPago(
    local.empresaId,
    remota,
    OrigemHistoricoAssinatura.WEBHOOK
  )
  return {
    processada: true as const,
    inadimplente: false as const,
    empresaId: local.empresaId
  }
}

export async function processarNotificacaoAssinaturaMercadoPagoService(
  tipo: TipoNotificacaoAssinaturaMercadoPago,
  recursoId: string
) {
  try {
    if (tipo === "subscription_preapproval") {
      return await processarPreapproval(recursoId)
    }

    return await processarPagamentoAutorizado(recursoId)
  } catch (error) {
    traduzirErroMercadoPago(error)
  }
}
type DadosIniciarAssinatura =
  Parameters<typeof iniciarAssinaturaEmpresaService>[1]

export async function iniciarAssinaturaPorCheckoutTokenService(
  checkoutToken: string,
  dados: DadosIniciarAssinatura
) {
  const tokenNormalizado = validarCheckoutToken(checkoutToken)

  const assinatura =
    await prisma.assinaturaEmpresa.findUnique({
      where: {
        checkoutToken: tokenNormalizado
      },
      select: {
        empresaId: true,
        status: true
      }
    })

  if (!assinatura) {
    throw new AppError(
      "O checkout informado não existe ou não está mais disponível.",
      404,
      "CHECKOUT_ASSINATURA_NAO_ENCONTRADO"
    )
  }

  if (assinatura.status === "CANCELADA") {
    throw new AppError(
      "Esta assinatura foi cancelada e não pode ser confirmada.",
      409,
      "CHECKOUT_ASSINATURA_CANCELADA"
    )
  }

  return iniciarAssinaturaEmpresaService(
    assinatura.empresaId,
    dados
  )
}

export async function sincronizarAssinaturaPorCheckoutTokenService(
  checkoutToken: string
) {
  const tokenNormalizado = validarCheckoutToken(checkoutToken)
  const assinatura = await prisma.assinaturaEmpresa.findUnique({
    where: { checkoutToken: tokenNormalizado },
    select: {
      empresaId: true,
      mercadoPagoAssinaturaId: true
    }
  })

  if (!assinatura) {
    throw new AppError(
      "Este checkout não existe ou não está mais disponível.",
      404,
      "CHECKOUT_ASSINATURA_NAO_ENCONTRADO"
    )
  }

  if (!assinatura.mercadoPagoAssinaturaId) {
    return buscarCheckoutPorTokenService(tokenNormalizado)
  }

  try {
    const remota = await obterAssinaturaMercadoPago(
      assinatura.mercadoPagoAssinaturaId
    )
    await persistirAssinaturaMercadoPago(assinatura.empresaId, remota)
    return buscarCheckoutPorTokenService(tokenNormalizado)
  } catch (error) {
    traduzirErroMercadoPago(error)
  }
}
export async function buscarCheckoutPorTokenService(
  checkoutToken: string
) {
  const tokenNormalizado = validarCheckoutToken(checkoutToken)

  const assinatura =
    await prisma.assinaturaEmpresa.findUnique({
      where: {
        checkoutToken: tokenNormalizado
      },
      select: {
        planoCodigo: true,
        planoNome: true,
        valorMensal: true,
        ambiente: true,
        status: true,

        empresa: {
          select: {
            nome: true,
            slug: true,
            email: true
          }
        }
      }
    })

  if (!assinatura) {
    throw new AppError(
      "Este checkout não existe ou não está mais disponível.",
      404,
      "CHECKOUT_ASSINATURA_NAO_ENCONTRADO"
    )
  }

  return {
    empresa: {
      nome: assinatura.empresa.nome,
      slug: assinatura.empresa.slug,
      email: assinatura.empresa.email
    },

    assinatura: {
      planoCodigo: assinatura.planoCodigo,
      planoNome: assinatura.planoNome,
      valorMensal: Number(
        assinatura.valorMensal
      ),
      ambiente: assinatura.ambiente,
      status: assinatura.status
    }
  }
}
