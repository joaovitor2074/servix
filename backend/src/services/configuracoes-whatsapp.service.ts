import { ModoEnvioWhatsApp, StatusOrdem } from "../generated/prisma/enums.js"
import { obterConfiguracaoWhatsAppServidor } from "../config/env.js"
import { AppError } from "../errors/app-error.js"
import { prisma } from "../lib/prisma.js"
import { criptografarToken, descriptografarToken } from "../lib/criptografia-tokens.js"
import type { AtualizarConfiguracaoWhatsAppInput } from "../validators/whatsapp.validators.js"

export const TEMPLATES_WHATSAPP_PADRAO = {
  templateOrcamento: "Olá, {{cliente}}! Seu orçamento #{{numero}} para {{equipamento}} está disponível no valor de {{valor}}. Confira e responda aqui: {{link}} — {{empresa}}",
  templateRecebido: "Olá, {{cliente}}! Recebemos seu {{equipamento}} na ordem #{{numero}}. Você pode acompanhar o atendimento aqui: {{link}} — {{empresa}}",
  templateEmAnalise: "Olá, {{cliente}}! A ordem #{{numero}} do seu {{equipamento}} está em análise técnica. Acompanhe: {{link}} — {{empresa}}",
  templateEmExecucao: "Olá, {{cliente}}! O serviço da ordem #{{numero}} entrou em execução. Acompanhe seu {{equipamento}} aqui: {{link}} — {{empresa}}",
  templateAguardandoPeca: "Olá, {{cliente}}! A ordem #{{numero}} está aguardando uma peça. Avisaremos assim que o serviço continuar. Acompanhe: {{link}} — {{empresa}}",
  templatePronto: "Olá, {{cliente}}! Seu {{equipamento}} da ordem #{{numero}} está pronto para retirada. Veja os detalhes: {{link}} — {{empresa}}",
  templateEntregue: "Olá, {{cliente}}! A ordem #{{numero}} foi concluída e entregue. Obrigado por escolher a {{empresa}}.",
  templateGarantia: "Olá, {{cliente}}! A garantia da ordem #{{numero}} para {{equipamento}} é válida até {{validade}}. Guarde seu certificado: {{link}} — {{empresa}}"
} as const

function dadosCriacao(empresaId: number) {
  return { empresaId, ...TEMPLATES_WHATSAPP_PADRAO }
}

export async function obterConfiguracaoWhatsAppCompleta(empresaId: number) {
  return prisma.configuracaoWhatsApp.upsert({
    where: { empresaId },
    create: dadosCriacao(empresaId),
    update: {}
  })
}

export function apresentarConfiguracaoWhatsApp(configuracao: Awaited<ReturnType<typeof obterConfiguracaoWhatsAppCompleta>>) {
  const servidor = obterConfiguracaoWhatsAppServidor()
  const { apiAccessTokenCifrado: _token, ...dados } = configuracao
  return {
    ...dados,
    possuiApiAccessToken: Boolean(configuracao.apiAccessTokenCifrado),
    integracaoApiDisponivelNoServidor: Boolean(servidor.tokenEncryptionKey),
    graphApiVersion: servidor.graphApiVersion
  }
}

export async function buscarConfiguracaoWhatsAppService(empresaId: number) {
  return apresentarConfiguracaoWhatsApp(await obterConfiguracaoWhatsAppCompleta(empresaId))
}

export async function atualizarConfiguracaoWhatsAppService(
  empresaId: number,
  dados: AtualizarConfiguracaoWhatsAppInput
) {
  const atual = await obterConfiguracaoWhatsAppCompleta(empresaId)
  if (atual.versao !== dados.versaoEsperada) {
    throw new AppError("A configuração foi alterada em outra sessão. Recarregue a página.", 409, "WHATSAPP_CONFIGURACAO_CONFLITANTE")
  }

  const servidor = obterConfiguracaoWhatsAppServidor()
  let tokenCifrado: string | null | undefined
  if (dados.removerApiAccessToken) tokenCifrado = null
  if (dados.apiAccessToken) {
    if (!servidor.tokenEncryptionKey) {
      throw new AppError("A proteção de credenciais do WhatsApp não está configurada no servidor.", 503, "WHATSAPP_CRIPTOGRAFIA_INDISPONIVEL")
    }
    tokenCifrado = criptografarToken(dados.apiAccessToken, servidor.tokenEncryptionKey, `whatsapp:${empresaId}`)
  }

  const phoneNumberId = dados.apiPhoneNumberId ?? atual.apiPhoneNumberId
  const tokenFinal = tokenCifrado === undefined ? atual.apiAccessTokenCifrado : tokenCifrado
  if (dados.modoEnvio === ModoEnvioWhatsApp.CLOUD_API && (!phoneNumberId || !tokenFinal)) {
    throw new AppError("Informe o Phone Number ID e o token da API oficial antes de ativar o envio automático.", 409, "WHATSAPP_API_INCOMPLETA")
  }

  const alteracao = await prisma.configuracaoWhatsApp.updateMany({
    where: { id: atual.id, empresaId, versao: dados.versaoEsperada },
    data: {
      ativo: dados.ativo,
      modoEnvio: dados.modoEnvio,
      telefoneEmpresa: dados.telefoneEmpresa ?? null,
      incluirLink: dados.incluirLink,
      templateOrcamento: dados.templateOrcamento,
      templateRecebido: dados.templateRecebido,
      templateEmAnalise: dados.templateEmAnalise,
      templateEmExecucao: dados.templateEmExecucao,
      templateAguardandoPeca: dados.templateAguardandoPeca,
      templatePronto: dados.templatePronto,
      templateEntregue: dados.templateEntregue,
      templateGarantia: dados.templateGarantia,
      apiPhoneNumberId: dados.apiPhoneNumberId ?? null,
      apiBusinessAccountId: dados.apiBusinessAccountId ?? null,
      ...(tokenCifrado !== undefined && {
        apiAccessTokenCifrado: tokenCifrado,
        apiAccessTokenAtualizadoEm: tokenCifrado ? new Date() : null
      }),
      versao: { increment: 1 }
    }
  })
  if (alteracao.count === 0) {
    throw new AppError("A configuração foi alterada em outra sessão. Recarregue a página.", 409, "WHATSAPP_CONFIGURACAO_CONFLITANTE")
  }
  return buscarConfiguracaoWhatsAppService(empresaId)
}

export function selecionarTemplateStatus(
  configuracao: Awaited<ReturnType<typeof obterConfiguracaoWhatsAppCompleta>>,
  status: StatusOrdem
) {
  return {
    [StatusOrdem.RECEBIDO]: configuracao.templateRecebido,
    [StatusOrdem.EM_ANALISE]: configuracao.templateEmAnalise,
    [StatusOrdem.EM_EXECUCAO]: configuracao.templateEmExecucao,
    [StatusOrdem.AGUARDANDO_PECA]: configuracao.templateAguardandoPeca,
    [StatusOrdem.PRONTO]: configuracao.templatePronto,
    [StatusOrdem.ENTREGUE]: configuracao.templateEntregue,
    [StatusOrdem.CANCELADO]: configuracao.templateEntregue
  }[status]
}

export function renderizarTemplateWhatsApp(template: string, variaveis: Record<string, string>) {
  return template.replace(/\{\{([a-zA-Z]+)\}\}/g, (original, nome: string) => variaveis[nome] ?? original)
}

export function obterTokenCloudApi(configuracao: { empresaId: number; apiAccessTokenCifrado: string | null }) {
  const servidor = obterConfiguracaoWhatsAppServidor()
  if (!servidor.tokenEncryptionKey || !configuracao.apiAccessTokenCifrado) return null
  return descriptografarToken(configuracao.apiAccessTokenCifrado, servidor.tokenEncryptionKey, `whatsapp:${configuracao.empresaId}`)
}

export async function testarConexaoWhatsAppService(empresaId: number) {
  const configuracao = await obterConfiguracaoWhatsAppCompleta(empresaId)
  const accessToken = obterTokenCloudApi(configuracao)
  if (!accessToken || !configuracao.apiPhoneNumberId) {
    throw new AppError("Salve o Phone Number ID e o token antes de testar.", 409, "WHATSAPP_API_INCOMPLETA")
  }
  const servidor = obterConfiguracaoWhatsAppServidor()
  try {
    const resposta = await fetch(
      `https://graph.facebook.com/${servidor.graphApiVersion}/${encodeURIComponent(configuracao.apiPhoneNumberId)}?fields=display_phone_number,verified_name,quality_rating`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(servidor.timeoutMs) }
    )
    const corpo = await resposta.json().catch(() => null) as Record<string, unknown> | null
    if (!resposta.ok) {
      throw new AppError("A Meta recusou as credenciais informadas. Revise o token e o Phone Number ID.", 409, "WHATSAPP_CONEXAO_RECUSADA")
    }
    return {
      conectado: true,
      nomeVerificado: typeof corpo?.verified_name === "string" ? corpo.verified_name : null,
      telefone: typeof corpo?.display_phone_number === "string" ? corpo.display_phone_number : null,
      qualidade: typeof corpo?.quality_rating === "string" ? corpo.quality_rating : null
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError("Não foi possível acessar a Meta agora. Tente o teste novamente.", 502, "WHATSAPP_CONEXAO_INDISPONIVEL")
  }
}
