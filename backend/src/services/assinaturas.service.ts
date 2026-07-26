import { Prisma } from "../generated/prisma/client.js"
import {
  AmbienteAssinatura,
  ProvedorAssinatura,
  StatusAssinatura,
  StatusEmpresa
} from "../generated/prisma/enums.js"
import { obterConfiguracaoAssinaturasMercadoPago } from "../config/env.js"
import { AppError } from "../errors/app-error.js"
import {
  buscarAssinaturaPorReferenciaMercadoPago,
  criarAssinaturaMercadoPago,
  ErroMercadoPagoAssinaturas,
  obterAssinaturaMercadoPago,
  obterPagamentoAutorizadoMercadoPago,
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
  assinaturaMercadoPago: AssinaturaMercadoPago
) {
  const status = statusInternoMercadoPago(assinaturaMercadoPago.status)
  const agora = new Date()
  const referenciaExterna = String(
    assinaturaMercadoPago.external_reference ?? referenciaExternaDaEmpresa(empresaId)
  )

  return prisma.$transaction(async tx => {
    const atual = await tx.assinaturaEmpresa.findUnique({
      where: { empresaId },
      select: { ativadaEm: true }
    })

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
            ? atual?.ativadaEm ?? agora
            : atual?.ativadaEm ?? null,
        canceladaEm:
          status === StatusAssinatura.CANCELADA ? agora : null,
        versao: { increment: 1 }
      },
      select: assinaturaSelect
    })

    await tx.empresa.update({
      where: { id: empresaId },
      data: { status: statusEmpresaPorAssinatura(status) }
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
        ambiente: AmbienteAssinatura.TESTE,
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
        ambiente: AmbienteAssinatura.TESTE,
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
    return persistirAssinaturaMercadoPago(empresaId, remota)
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

  await persistirAssinaturaMercadoPago(local.empresaId, remota)
  return { processada: true as const }
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
    await prisma.assinaturaEmpresa.update({
      where: { empresaId: local.empresaId },
      data: {
        status: StatusAssinatura.INADIMPLENTE,
        ultimaSincronizacaoEm: new Date(),
        versao: { increment: 1 }
      }
    })

    // O acesso permanece ativo durante a tolerância. Uma rotina posterior pode
    // suspender a empresa após o limite comercial definido pelo Servix.
    return { processada: true as const, inadimplente: true as const }
  }

  // Para processed, waiting for gateway ou scheduled, a assinatura é a fonte
  // de verdade do vínculo. Relê o preapproval e sincroniza o estado atual.
  const remota = await obterAssinaturaMercadoPago(pagamento.preapproval_id)
  await persistirAssinaturaMercadoPago(local.empresaId, remota)
  return { processada: true as const, inadimplente: false as const }
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
    throw Object.assign(
      new Error(
        "O checkout informado não existe ou não está mais disponível."
      ),
      {
        statusCode: 404
      }
    )
  }

  if (assinatura.status === "CANCELADA") {
    throw Object.assign(
      new Error(
        "Esta assinatura foi cancelada e não pode ser confirmada."
      ),
      {
        statusCode: 409
      }
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
    throw Object.assign(
      new Error(
        "Este checkout não existe ou não está mais disponível."
      ),
      {
        statusCode: 404
      }
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
