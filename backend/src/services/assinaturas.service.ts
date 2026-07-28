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
import { identidadeLegalProducaoConfirmada } from "../config/legal-readiness.js"
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
const NAMESPACE_LOCK_ASSINATURA = 1_397_902_418
const OPCOES_TRANSACAO_ASSINATURA = {
  maxWait: 10_000,
  timeout: 140_000
} as const

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

function referenciaExternaReativacao(
  empresaId: number,
  proximaVersao: number
): string {
  // Derivar a referencia de estado persistido torna a tentativa repetivel
  // mesmo se o provedor responder e a transacao local falhar antes do commit.
  return `servix_empresa_${empresaId}_reativacao_${proximaVersao}`
}

async function bloquearAssinaturaDaEmpresaTx(
  tx: Prisma.TransactionClient,
  empresaId: number
): Promise<void> {
  // O lock transacional serializa o checkout por empresa inclusive quando ha
  // mais de uma instancia da API atendendo requisicoes no Railway.
  await tx.$queryRaw`
    SELECT 1 AS "bloqueado"
    FROM (
      SELECT pg_advisory_xact_lock(
        CAST(${NAMESPACE_LOCK_ASSINATURA} AS integer),
        CAST(${empresaId} AS integer)
      )
    ) AS "lockAssinatura"
  `
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

async function persistirAssinaturaMercadoPagoTx(
  tx: Prisma.TransactionClient,
  empresaId: number,
  assinaturaMercadoPago: AssinaturaMercadoPago,
  origem: OrigemHistoricoAssinatura = OrigemHistoricoAssinatura.CHECKOUT,
  permitirAtivacao = true,
  permitirRegularizacaoInadimplencia = false
) {
  const statusRecebido = statusInternoMercadoPago(assinaturaMercadoPago.status)
  const agora = new Date()
  const referenciaExterna = String(
    assinaturaMercadoPago.external_reference ?? referenciaExternaDaEmpresa(empresaId)
  )

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

    const preservarInadimplencia =
      atual.status === StatusAssinatura.INADIMPLENTE &&
      statusRecebido === StatusAssinatura.ATIVA &&
      !permitirRegularizacaoInadimplencia

    // Preapproval authorized confirma o vinculo, mas nao comprova que uma
    // fatura inadimplente foi paga. Apenas authorized_payment approved pode
    // regularizar e restaurar o acesso da empresa.
    const status = preservarInadimplencia
      ? StatusAssinatura.INADIMPLENTE
      : !permitirAtivacao
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

    if (!preservarInadimplencia) {
      await tx.empresa.update({
        where: { id: empresaId },
        data: { status: statusEmpresaPorAssinatura(status) }
      })
    }

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
}

async function persistirAssinaturaMercadoPago(
  empresaId: number,
  assinaturaMercadoPago: AssinaturaMercadoPago,
  origem: OrigemHistoricoAssinatura = OrigemHistoricoAssinatura.CHECKOUT,
  permitirAtivacao = true,
  permitirRegularizacaoInadimplencia = false
) {
  return prisma.$transaction(tx => persistirAssinaturaMercadoPagoTx(
    tx,
    empresaId,
    assinaturaMercadoPago,
    origem,
    permitirAtivacao,
    permitirRegularizacaoInadimplencia
  ))
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

  if (
    configuracao.modo === "PRODUCAO" &&
    !identidadeLegalProducaoConfirmada()
  ) {
    throw new AppError(
      "A contratacao em producao ainda nao foi liberada.",
      503,
      "IDENTIDADE_LEGAL_NAO_CONFIGURADA"
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

  const resultado = await prisma.$transaction(async tx => {
    await bloquearAssinaturaDaEmpresaTx(tx, empresaId)

    // A leitura ocorre depois do advisory lock. Assim uma segunda instância
    // observa o preapproval persistido pela primeira em vez de criar outro.
    const empresa = await tx.empresa.findUnique({
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

    if (empresa.assinatura.status === StatusAssinatura.ATIVA) {
      throw new AppError(
        "A empresa já possui uma assinatura ativa.",
        409,
        "ASSINATURA_JA_ATIVA"
      )
    }

    if (empresa.assinatura.mercadoPagoAssinaturaId) {
      let remota: AssinaturaMercadoPago

      try {
        remota = await obterAssinaturaMercadoPago(
          empresa.assinatura.mercadoPagoAssinaturaId
        )
      } catch (error) {
        return { sucesso: false as const, error }
      }

      return {
        sucesso: true as const,
        valor: {
          assinatura: await persistirAssinaturaMercadoPagoTx(
            tx,
            empresaId,
            remota
          ),
          recuperada: true
        }
      }
    }

    const referenciaExterna =
      empresa.assinatura.referenciaExterna ?? referenciaExternaDaEmpresa(empresaId)

    const preparada = await tx.assinaturaEmpresa.upsert({
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
      },
      select: {
        checkoutToken: true,
        mercadoPagoAssinaturaId: true
      }
    })

    await tx.empresa.update({
      where: { id: empresaId },
      data: { status: StatusEmpresa.PENDENTE_ASSINATURA }
    })

    let existente: AssinaturaMercadoPago | null
    let remota: AssinaturaMercadoPago

    try {
      if (preparada.mercadoPagoAssinaturaId) {
        remota = await obterAssinaturaMercadoPago(
          preparada.mercadoPagoAssinaturaId
        )
        existente = remota
      } else {
        // Recupera uma criação anterior cuja resposta possa ter sido perdida.
        existente = await buscarAssinaturaPorReferenciaMercadoPago(
          referenciaExterna
        )
        remota = existente ?? await criarAssinaturaMercadoPago({
          emailPagador,
          referenciaExterna,
          transactionAmount: Number(VALOR_MENSAL),
          currencyId: "BRL",
          backUrl: urlRetornoCheckout(
            configuracao.backUrl,
            preparada.checkoutToken
          )
        })
      }
    } catch (error) {
      // Confirmar a preparação preserva a referência para que o retry possa
      // pesquisar a criação cuja resposta se perdeu no caminho.
      return { sucesso: false as const, error }
    }

    if (!checkoutUrlMercadoPagoValida(remota.init_point)) {
      return {
        sucesso: false as const,
        error: new AppError(
          "O Mercado Pago não retornou um endereço de checkout válido.",
          502,
          "CHECKOUT_MERCADO_PAGO_INVALIDO"
        )
      }
    }

    return {
      sucesso: true as const,
      valor: {
        assinatura: await persistirAssinaturaMercadoPagoTx(
          tx,
          empresaId,
          remota
        ),
        recuperada: Boolean(existente)
      }
    }
  }, OPCOES_TRANSACAO_ASSINATURA)

  if (!resultado.sucesso) {
    traduzirErroMercadoPago(resultado.error)
  }

  return resultado.valor
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

  if (
    configuracao.modo === "PRODUCAO" &&
    !identidadeLegalProducaoConfirmada()
  ) {
    throw new AppError(
      "A contratacao em producao ainda nao foi liberada.",
      503,
      "IDENTIDADE_LEGAL_NAO_CONFIGURADA"
    )
  }

  const ambiente = configuracao.modo === "PRODUCAO"
    ? AmbienteAssinatura.PRODUCAO
    : AmbienteAssinatura.TESTE
  const provedor = ProvedorAssinatura.MERCADO_PAGO_SERVIX

  // A versao observada antes de aguardar o lock permite distinguir um clique
  // sequencial em "novo checkout" de duas requisicoes concorrentes iguais.
  const assinaturaObservada = await prisma.assinaturaEmpresa.findUnique({
    where: { empresaId },
    select: { versao: true }
  })

  if (!assinaturaObservada) {
    throw new AppError(
      "A assinatura da empresa nao foi encontrada.",
      404,
      "ASSINATURA_NAO_ENCONTRADA"
    )
  }

  const resultado = await prisma.$transaction(async tx => {
    await bloquearAssinaturaDaEmpresaTx(tx, empresaId)

    let assinatura = await tx.assinaturaEmpresa.findUnique({
      where: { empresaId },
      select: {
        id: true,
        status: true,
        ambiente: true,
        provedor: true,
        emailPagador: true,
        referenciaExterna: true,
        mercadoPagoAssinaturaId: true,
        checkoutUrl: true,
        valorMensal: true,
        versao: true
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
    const tentativaCompativel =
      reativacaoEmAndamento &&
      assinatura.ambiente === ambiente &&
      assinatura.provedor === provedor
    const mudouEnquantoAguardavaLock =
      assinatura.versao !== assinaturaObservada.versao
    const gerarNovoCheckout = Boolean(
      opcoes.gerarNovoCheckout &&
      !(tentativaCompativel && mudouEnquantoAguardavaLock)
    )

    if (
      tentativaCompativel &&
      checkoutUrlMercadoPagoValida(assinatura.checkoutUrl) &&
      !gerarNovoCheckout
    ) {
      return {
        sucesso: true as const,
        valor: {
          checkoutUrl: assinatura.checkoutUrl,
          status: assinatura.status,
          recuperada: true
        }
      }
    }

    if (tentativaCompativel && gerarNovoCheckout) {
      if (assinatura.mercadoPagoAssinaturaId) {
        let remotaAtual: AssinaturaMercadoPago

        try {
          remotaAtual = await obterAssinaturaMercadoPago(
            assinatura.mercadoPagoAssinaturaId
          )
        } catch (error) {
          return { sucesso: false as const, error }
        }

        const statusRemoto = statusInternoMercadoPago(remotaAtual.status)

        if (statusRemoto === StatusAssinatura.ATIVA) {
          throw new AppError(
            "O Mercado Pago ja confirmou esta assinatura. Aguarde o webhook para liberar o acesso.",
            409,
            "ASSINATURA_AGUARDANDO_WEBHOOK"
          )
        }

        if (statusRemoto === StatusAssinatura.PENDENTE) {
          try {
            await cancelarAssinaturaMercadoPago(
              assinatura.mercadoPagoAssinaturaId
            )
          } catch (error) {
            return { sucesso: false as const, error }
          }
        }
      }
    }

    if (!tentativaCompativel || gerarNovoCheckout) {
      const referenciaExterna = referenciaExternaReativacao(
        empresaId,
        assinatura.versao + 1
      )
      const statusAnterior = assinatura.status
      const assinaturaAnteriorId = assinatura.mercadoPagoAssinaturaId

      await tx.assinaturaEmpresa.update({
        where: { empresaId },
        data: {
          ambiente,
          provedor,
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
          assinaturaEmpresaId: assinatura.id,
          tipo: TipoHistoricoAssinatura.REATIVACAO_SOLICITADA,
          origem: OrigemHistoricoAssinatura.REATIVACAO_ADMIN,
          statusAnterior,
          statusNovo: StatusAssinatura.PENDENTE,
          mercadoPagoAssinaturaId: assinaturaAnteriorId
        }
      })

      assinatura = {
        ...assinatura,
        ambiente,
        provedor,
        status: StatusAssinatura.PENDENTE,
        referenciaExterna,
        mercadoPagoAssinaturaId: null,
        checkoutUrl: null,
        versao: assinatura.versao + 1
      }
    }

    const referenciaExterna = assinatura.referenciaExterna!
    let existente: AssinaturaMercadoPago | null
    let remota: AssinaturaMercadoPago

    try {
      existente = await buscarAssinaturaPorReferenciaMercadoPago(
        referenciaExterna
      )
      remota = existente ?? await criarAssinaturaMercadoPago({
        emailPagador,
        referenciaExterna,
        transactionAmount: Number(assinatura.valorMensal),
        currencyId: "BRL",
        backUrl: urlRetornoReativacao(configuracao.backUrl)
      })
    } catch (error) {
      // Mantem a referencia preparada para recuperar uma resposta perdida.
      return { sucesso: false as const, error }
    }

    if (!checkoutUrlMercadoPagoValida(remota.init_point)) {
      return {
        sucesso: false as const,
        error: new AppError(
          "O Mercado Pago nao retornou um checkout valido para reativacao.",
          502,
          "CHECKOUT_MERCADO_PAGO_INVALIDO"
        )
      }
    }

    const persistida = await persistirAssinaturaMercadoPagoTx(
      tx,
      empresaId,
      remota,
      OrigemHistoricoAssinatura.REATIVACAO_ADMIN,
      false
    )

    return {
      sucesso: true as const,
      valor: {
        checkoutUrl: persistida.checkoutUrl,
        status: persistida.status,
        recuperada: Boolean(existente)
      }
    }
  }, OPCOES_TRANSACAO_ASSINATURA)

  if (!resultado.sucesso) {
    traduzirErroMercadoPago(resultado.error)
  }

  return resultado.valor
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

function normalizarStatusPagamento(valor: string | undefined): string {
  return valor
    ?.trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ") ?? ""
}

const STATUS_FATURA_AGUARDANDO = new Set([
  "pending",
  "scheduled",
  "waiting",
  "waiting for gateway"
])

const STATUS_PAGAMENTO_AGUARDANDO = new Set([
  "authorized",
  "in mediation",
  "in process",
  "pending"
])

const STATUS_PAGAMENTO_FINAL_NAO_APROVADO = new Set([
  "canceled",
  "cancelled",
  "charged back",
  "refunded",
  "rejected"
])

function assinaturaComEstadoTerminal(status: StatusAssinatura): boolean {
  return (
    status === StatusAssinatura.CANCELADA ||
    status === StatusAssinatura.PAUSADA
  )
}

async function registrarInadimplenciaPagamento(
  empresaId: number,
  pagamento: Awaited<ReturnType<typeof obterPagamentoAutorizadoMercadoPago>>,
  suspenderEmpresa: boolean
) {
  return prisma.$transaction(async tx => {
    const atual = await tx.assinaturaEmpresa.findUniqueOrThrow({
      where: { empresaId },
      select: { id: true, status: true, mercadoPagoAssinaturaId: true }
    })

    // Uma notificacao atrasada de fatura nunca reabre assinatura encerrada.
    if (assinaturaComEstadoTerminal(atual.status)) {
      return { alterada: false as const }
    }

    await tx.assinaturaEmpresa.update({
      where: { empresaId },
      data: {
        status: StatusAssinatura.INADIMPLENTE,
        ultimaSincronizacaoEm: new Date(),
        versao: { increment: 1 }
      }
    })

    if (suspenderEmpresa) {
      await tx.empresa.update({
        where: { id: empresaId },
        data: { status: StatusEmpresa.SUSPENSA }
      })
    }

    await tx.historicoAssinaturaEmpresa.create({
      data: {
        empresaId,
        assinaturaEmpresaId: atual.id,
        tipo: TipoHistoricoAssinatura.INADIMPLENCIA_DETECTADA,
        origem: OrigemHistoricoAssinatura.WEBHOOK,
        statusAnterior: atual.status,
        statusNovo: StatusAssinatura.INADIMPLENTE,
        mercadoPagoAssinaturaId: atual.mercadoPagoAssinaturaId,
        requestIdProvedor: obterRequestIdMercadoPago(pagamento)
      }
    })

    return { alterada: true as const }
  })
}

async function processarPagamentoAutorizado(pagamentoId: string) {
  const pagamento = await obterPagamentoAutorizadoMercadoPago(pagamentoId)

  if (!pagamento.preapproval_id) {
    return { processada: false as const, motivo: "sem_preapproval" as const }
  }

  const local = await prisma.assinaturaEmpresa.findUnique({
    where: { mercadoPagoAssinaturaId: pagamento.preapproval_id },
    select: { empresaId: true, status: true }
  })

  if (!local) return { processada: false as const, motivo: "nao_encontrada" as const }

  if (assinaturaComEstadoTerminal(local.status)) {
    return {
      processada: true as const,
      ignorada: true as const,
      empresaId: local.empresaId
    }
  }

  const statusFatura = normalizarStatusPagamento(pagamento.status)
  const resumoFatura = normalizarStatusPagamento(pagamento.summarized)
  const statusPagamento = normalizarStatusPagamento(
    pagamento.payment?.status
  )

  if (statusPagamento === "approved") {
    const remota = await obterAssinaturaMercadoPago(pagamento.preapproval_id)
    await persistirAssinaturaMercadoPago(
      local.empresaId,
      remota,
      OrigemHistoricoAssinatura.WEBHOOK,
      true,
      true
    )

    return {
      processada: true as const,
      inadimplente: false as const,
      empresaId: local.empresaId
    }
  }

  if (statusFatura === "recycling") {
    await registrarInadimplenciaPagamento(
      local.empresaId,
      pagamento,
      false
    )

    // Enquanto a fatura esta em recycling, o Mercado Pago ainda pode realizar
    // ate quatro tentativas dentro da janela de dez dias. O acesso permanece.
    return {
      processada: true as const,
      inadimplente: true as const,
      suspensa: false as const,
      empresaId: local.empresaId
    }
  }

  const aguardando =
    STATUS_FATURA_AGUARDANDO.has(statusFatura) ||
    resumoFatura === "pending" ||
    STATUS_PAGAMENTO_AGUARDANDO.has(statusPagamento)

  if (aguardando) {
    return {
      processada: true as const,
      aguardando: true as const,
      empresaId: local.empresaId
    }
  }

  if (
    statusFatura === "processed" &&
    STATUS_PAGAMENTO_FINAL_NAO_APROVADO.has(statusPagamento)
  ) {
    await registrarInadimplenciaPagamento(
      local.empresaId,
      pagamento,
      true
    )

    return {
      processada: true as const,
      inadimplente: true as const,
      suspensa: true as const,
      empresaId: local.empresaId
    }
  }

  if (statusFatura === "processed") {
    // Uma fatura final sem resultado reconhecido nao deve liberar nem suspender
    // acesso por suposicao. A caixa de entrada tentara novamente e emitira
    // alerta se o provedor continuar retornando dados incompletos.
    throw new Error(
      "A fatura processada nao possui um status final de pagamento reconhecido."
    )
  }

  return {
    processada: true as const,
    ignorada: true as const,
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
