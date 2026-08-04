import {
  ModoEnvioWhatsApp,
  StatusGarantia,
  StatusMensagemWhatsApp,
  StatusOrdem,
  TipoMensagemWhatsApp
} from "../generated/prisma/enums.js"
import { obterConfiguracaoWhatsAppServidor, obterUrlFrontend } from "../config/env.js"
import { AppError } from "../errors/app-error.js"
import { prisma } from "../lib/prisma.js"
import type { PrepararMensagemWhatsAppInput } from "../validators/whatsapp.validators.js"
import {
  obterConfiguracaoWhatsAppCompleta,
  obterTokenCloudApi,
  renderizarTemplateWhatsApp,
  selecionarTemplateStatus
} from "./configuracoes-whatsapp.service.js"

type ConfiguracaoWhatsApp = Awaited<ReturnType<typeof obterConfiguracaoWhatsAppCompleta>>

const formatarMoeda = (valor: { toString(): string } | number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor))

const formatarData = (valor: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(valor)

function normalizarTelefoneWhatsApp(valor: string) {
  const digitos = valor.replace(/\D/g, "")
  const telefoneBrasil = digitos.startsWith("55") ? digitos : `55${digitos}`
  if (
    !/^55\d{10,11}$/.test(telefoneBrasil)
  ) {
    throw new AppError("O telefone do cliente precisa ter DDD.", 409, "WHATSAPP_TELEFONE_INVALIDO")
  }
  return telefoneBrasil
}

function linkPublico(caminho: string, incluirLink: boolean) {
  return incluirLink ? new URL(caminho, `${obterUrlFrontend()}/`).toString() : ""
}

function variaveisBase(dados: {
  cliente: string
  empresa: string
  numero: number
  equipamento: string
  link: string
  valor?: { toString(): string } | number
  validade?: Date
}) {
  return {
    cliente: dados.cliente,
    empresa: dados.empresa,
    numero: String(dados.numero),
    equipamento: dados.equipamento,
    link: dados.link,
    valor: dados.valor === undefined ? "" : formatarMoeda(dados.valor),
    validade: dados.validade ? formatarData(dados.validade) : ""
  }
}

export async function listarCentralWhatsAppService(empresaId: number) {
  const configuracao = await obterConfiguracaoWhatsAppCompleta(empresaId)
  const [empresa, ordens, orcamentos, garantias, historico] = await prisma.$transaction([
    prisma.empresa.findUnique({ where: { id: empresaId }, select: { nome: true } }),
    prisma.ordemServico.findMany({
      where: { empresaId, status: { notIn: [StatusOrdem.ENTREGUE, StatusOrdem.CANCELADO] } },
      select: {
        id: true,
        numero: true,
        equipamento: true,
        status: true,
        atualizadoEm: true,
        tokenAcompanhamento: true,
        cliente: { select: { nome: true, telefone: true } }
      },
      orderBy: { atualizadoEm: "desc" },
      take: 50
    }),
    prisma.orcamento.findMany({
      where: { empresaId, status: { in: ["RASCUNHO", "ENVIADO"] } },
      select: {
        id: true,
        numero: true,
        equipamento: true,
        total: true,
        status: true,
        tokenPublico: true,
        atualizadoEm: true,
        cliente: { select: { nome: true, telefone: true } }
      },
      orderBy: { atualizadoEm: "desc" },
      take: 50
    }),
    prisma.garantiaServico.findMany({
      where: { empresaId, status: StatusGarantia.ATIVA, expiraEm: { gte: new Date() } },
      select: {
        id: true,
        codigo: true,
        expiraEm: true,
        atualizadoEm: true,
        ordem: {
          select: {
            id: true,
            numero: true,
            equipamento: true,
            tokenAcompanhamento: true,
            cliente: { select: { nome: true, telefone: true } }
          }
        }
      },
      orderBy: { expiraEm: "asc" },
      take: 50
    }),
    prisma.registroMensagemWhatsApp.findMany({
      where: { empresaId },
      select: {
        id: true,
        tipo: true,
        modoEnvio: true,
        status: true,
        telefone: true,
        erro: true,
        criadoEm: true,
        registradoPor: { select: { nome: true } }
      },
      orderBy: { criadoEm: "desc" },
      take: 20
    })
  ])

  const nomeEmpresa = empresa?.nome ?? "Nossa assistência"
  return {
    configuracao: {
      ativo: configuracao.ativo,
      modoEnvio: configuracao.modoEnvio,
      incluirLink: configuracao.incluirLink,
      telefoneEmpresa: configuracao.telefoneEmpresa
    },
    ordens: ordens.map(ordem => ({
      ...ordem,
      mensagem: renderizarTemplateWhatsApp(
        selecionarTemplateStatus(configuracao, ordem.status),
        variaveisBase({
          cliente: ordem.cliente.nome,
          empresa: nomeEmpresa,
          numero: ordem.numero,
          equipamento: ordem.equipamento,
          link: configuracao.incluirLink ? "{{link}}" : ""
        })
      )
    })),
    orcamentos: orcamentos.map(orcamento => ({
      ...orcamento,
      mensagem: renderizarTemplateWhatsApp(
        configuracao.templateOrcamento,
        variaveisBase({
          cliente: orcamento.cliente.nome,
          empresa: nomeEmpresa,
          numero: orcamento.numero,
          equipamento: orcamento.equipamento,
          valor: orcamento.total,
          link: configuracao.incluirLink ? "{{link}}" : ""
        })
      )
    })),
    garantias: garantias.map(garantia => ({
      ...garantia,
      mensagem: renderizarTemplateWhatsApp(
        configuracao.templateGarantia,
        variaveisBase({
          cliente: garantia.ordem.cliente.nome,
          empresa: nomeEmpresa,
          numero: garantia.ordem.numero,
          equipamento: garantia.ordem.equipamento,
          validade: garantia.expiraEm,
          link: configuracao.incluirLink ? "{{link}}" : ""
        })
      )
    })),
    historico
  }
}

async function prepararConteudo(
  empresaId: number,
  configuracao: ConfiguracaoWhatsApp,
  origem: PrepararMensagemWhatsAppInput["origem"],
  referenciaId: number
) {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { nome: true }
  })
  if (!empresa) throw new AppError("Empresa não encontrada.", 404, "EMPRESA_NAO_ENCONTRADA")

  if (origem === "ORDEM") {
    const ordem = await prisma.ordemServico.findUnique({
      where: { id_empresaId: { id: referenciaId, empresaId } },
      select: {
        id: true,
        numero: true,
        equipamento: true,
        status: true,
        tokenAcompanhamento: true,
        cliente: { select: { nome: true, telefone: true } }
      }
    })
    if (!ordem) throw new AppError("Ordem não encontrada.", 404, "ORDEM_NAO_ENCONTRADA")
    return {
      ordemId: ordem.id,
      orcamentoId: null,
      tipo: ordem.status === StatusOrdem.PRONTO
        ? TipoMensagemWhatsApp.PRONTO_RETIRADA
        : TipoMensagemWhatsApp.STATUS_ORDEM,
      telefone: normalizarTelefoneWhatsApp(ordem.cliente.telefone),
      conteudo: renderizarTemplateWhatsApp(
        selecionarTemplateStatus(configuracao, ordem.status),
        variaveisBase({
          cliente: ordem.cliente.nome,
          empresa: empresa.nome,
          numero: ordem.numero,
          equipamento: ordem.equipamento,
          link: linkPublico(`/acompanhar/${ordem.tokenAcompanhamento}`, configuracao.incluirLink)
        })
      )
    }
  }

  if (origem === "ORCAMENTO") {
    const orcamento = await prisma.orcamento.findUnique({
      where: { id_empresaId: { id: referenciaId, empresaId } },
      select: {
        id: true,
        numero: true,
        equipamento: true,
        total: true,
        tokenPublico: true,
        cliente: { select: { nome: true, telefone: true } }
      }
    })
    if (!orcamento) throw new AppError("Orçamento não encontrado.", 404, "ORCAMENTO_NAO_ENCONTRADO")
    return {
      ordemId: null,
      orcamentoId: orcamento.id,
      tipo: TipoMensagemWhatsApp.ORCAMENTO,
      telefone: normalizarTelefoneWhatsApp(orcamento.cliente.telefone),
      conteudo: renderizarTemplateWhatsApp(
        configuracao.templateOrcamento,
        variaveisBase({
          cliente: orcamento.cliente.nome,
          empresa: empresa.nome,
          numero: orcamento.numero,
          equipamento: orcamento.equipamento,
          valor: orcamento.total,
          link: linkPublico(`/orcamento/${orcamento.tokenPublico}`, configuracao.incluirLink)
        })
      )
    }
  }

  const garantia = await prisma.garantiaServico.findUnique({
    where: { id_empresaId: { id: referenciaId, empresaId } },
    select: {
      id: true,
      expiraEm: true,
      ordem: {
        select: {
          id: true,
          numero: true,
          equipamento: true,
          tokenAcompanhamento: true,
          cliente: { select: { nome: true, telefone: true } }
        }
      }
    }
  })
  if (!garantia) throw new AppError("Garantia não encontrada.", 404, "GARANTIA_NAO_ENCONTRADA")
  return {
    ordemId: garantia.ordem.id,
    orcamentoId: null,
    tipo: TipoMensagemWhatsApp.GARANTIA,
    telefone: normalizarTelefoneWhatsApp(garantia.ordem.cliente.telefone),
    conteudo: renderizarTemplateWhatsApp(
      configuracao.templateGarantia,
      variaveisBase({
        cliente: garantia.ordem.cliente.nome,
        empresa: empresa.nome,
        numero: garantia.ordem.numero,
        equipamento: garantia.ordem.equipamento,
        validade: garantia.expiraEm,
        link: linkPublico(`/acompanhar/${garantia.ordem.tokenAcompanhamento}`, configuracao.incluirLink)
      })
    )
  }
}

export async function enviarMensagemWhatsAppService(
  empresaId: number,
  usuarioId: number,
  dados: PrepararMensagemWhatsAppInput
) {
  const configuracao = await obterConfiguracaoWhatsAppCompleta(empresaId)
  if (!configuracao.ativo) {
    throw new AppError("A Central do WhatsApp está desativada nas configurações.", 409, "WHATSAPP_DESATIVADO")
  }
  const mensagem = await prepararConteudo(empresaId, configuracao, dados.origem, dados.referenciaId)
  const registro = await prisma.registroMensagemWhatsApp.create({
    data: {
      empresaId,
      ordemId: mensagem.ordemId,
      orcamentoId: mensagem.orcamentoId,
      tipo: mensagem.tipo,
      modoEnvio: configuracao.modoEnvio,
      telefone: mensagem.telefone,
      conteudo: mensagem.conteudo,
      registradoPorId: usuarioId
    }
  })

  if (configuracao.modoEnvio === ModoEnvioWhatsApp.LINK_MANUAL) {
    return {
      modoEnvio: configuracao.modoEnvio,
      status: StatusMensagemWhatsApp.PREPARADA,
      registroId: registro.id,
      mensagem: mensagem.conteudo,
      url: `https://wa.me/${mensagem.telefone}?text=${encodeURIComponent(mensagem.conteudo)}`
    }
  }

  const accessToken = obterTokenCloudApi(configuracao)
  if (!accessToken || !configuracao.apiPhoneNumberId) {
    await prisma.registroMensagemWhatsApp.update({
      where: { id_empresaId: { id: registro.id, empresaId } },
      data: { status: StatusMensagemWhatsApp.FALHA, erro: "Integração oficial incompleta" }
    })
    throw new AppError("A integração oficial do WhatsApp precisa ser configurada novamente.", 409, "WHATSAPP_API_INCOMPLETA")
  }

  const servidor = obterConfiguracaoWhatsAppServidor()
  try {
    const resposta = await fetch(
      `https://graph.facebook.com/${servidor.graphApiVersion}/${encodeURIComponent(configuracao.apiPhoneNumberId)}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: mensagem.telefone,
          type: "text",
          text: { preview_url: configuracao.incluirLink, body: mensagem.conteudo }
        }),
        signal: AbortSignal.timeout(servidor.timeoutMs)
      }
    )
    const corpo = await resposta.json().catch(() => null) as { messages?: Array<{ id?: string }> } | null
    if (!resposta.ok) throw new Error("PROVEDOR_RECUSOU")
    const providerMessageId = corpo?.messages?.[0]?.id ?? null
    await prisma.registroMensagemWhatsApp.update({
      where: { id_empresaId: { id: registro.id, empresaId } },
      data: { status: StatusMensagemWhatsApp.ENVIADA, providerMessageId }
    })
    return {
      modoEnvio: configuracao.modoEnvio,
      status: StatusMensagemWhatsApp.ENVIADA,
      registroId: registro.id,
      providerMessageId
    }
  } catch {
    await prisma.registroMensagemWhatsApp.update({
      where: { id_empresaId: { id: registro.id, empresaId } },
      data: { status: StatusMensagemWhatsApp.FALHA, erro: "Falha no envio pela API oficial" }
    })
    throw new AppError(
      "O WhatsApp não aceitou o envio. Verifique a conexão e se a conversa permite mensagem de texto livre.",
      502,
      "WHATSAPP_ENVIO_RECUSADO"
    )
  }
}
