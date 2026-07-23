import { Prisma } from "../generated/prisma/client.js"
import {
  AmbientePagamento,
  FormaPagamento,
  OrigemPagamento,
  ProvedorPagamento,
  StatusCobranca,
  StatusConfiguracaoPagamento,
  StatusOrcamento,
  StatusOrdem,
  StatusRegistroPagamento
} from "../generated/prisma/enums.js"
import {
  pagamentosClientesMercadoPagoTesteHabilitados
} from "../config/env.js"
import { AppError } from "../errors/app-error.js"
import {
  obterGatewayPagamento,
  resolverGatewayPagamento
} from "../gateways/gateway-pagamento.factory.js"
import { ErroMercadoPagoGateway } from "../gateways/mercado-pago.gateway.js"
import { prisma } from "../lib/prisma.js"
import {
  abortarTransacaoComResultado,
  bloquearPagamentoDaEmpresaTx,
  executarTransacaoComRollback,
  OPCOES_TRANSACAO_PAGAMENTO
} from "../lib/transacao.js"
import type {
  CriarCobrancaInput,
  ListarCobrancasInput
} from "../validators/cobrancas.validators.js"

const cobrancaSelect = {
  id: true,
  empresaId: true,
  ordemId: true,
  orcamentoId: true,
  provedor: true,
  ambiente: true,
  formaPagamento: true,
  status: true,
  valor: true,
  chaveIdempotencia: true,
  identificadorExterno: true,
  codigoPix: true,
  qrCodeBase64: true,
  expiraEm: true,
  pagaEm: true,
  canceladaEm: true,
  estornadaEm: true,
  criadoEm: true,
  atualizadoEm: true,
  pagamento: {
    select: {
      id: true,
      status: true,
      pagoEm: true
    }
  }
} as const

// Consultas usadas pelas telas internas omitem a chave recebida na criacao.
// Ela e um detalhe de controle do servidor e nao precisa circular no navegador.
const cobrancaLeituraSelect = {
  ...cobrancaSelect,
  chaveIdempotencia: false
} as const

const cobrancaPublicaSelect = {
  id: true,
  status: true,
  valor: true,
  formaPagamento: true,
  codigoPix: true,
  expiraEm: true,
  pagaEm: true
} as const

const INTERVALO_SINCRONIZACAO_MERCADO_PAGO_MS = 5000
const DURACAO_PADRAO_COBRANCA_MS = 30 * 60 * 1000
const STATUS_SINCRONIZAVEIS_MERCADO_PAGO = new Set<StatusCobranca>([
  StatusCobranca.PENDENTE,
  StatusCobranca.EXPIRADA,
  StatusCobranca.CANCELADA
])

type ConfiguracaoPix = {
  provedor: ProvedorPagamento
  ambiente: AmbientePagamento
  status: StatusConfiguracaoPagamento
  ativo: boolean
  pixHabilitado: boolean
} | null

export function configuracaoPagamentoAceitaPix(
  configuracao: ConfiguracaoPix,
  empresaId?: number
): boolean {
  const conexaoGerenciadaNoBanco =
    pagamentosClientesMercadoPagoTesteHabilitados() &&
    configuracao?.provedor === ProvedorPagamento.MERCADO_PAGO &&
    configuracao.ambiente === AmbientePagamento.TESTE

  return Boolean(
    configuracao?.ativo &&
    configuracao.pixHabilitado &&
    configuracao.status === StatusConfiguracaoPagamento.ATIVA &&
    (
      conexaoGerenciadaNoBanco ||
      obterGatewayPagamento(configuracao.provedor, empresaId === undefined
        ? undefined
        : { empresaId, ambiente: configuracao.ambiente })
    )
  )
}

function decimal(valor: Prisma.Decimal | string | number | null | undefined) {
  return new Prisma.Decimal(valor ?? 0)
}

export async function expirarCobrancasVencidasService(
  empresaId: number
): Promise<number> {
  return prisma.$transaction(async tx => {
    await bloquearPagamentoDaEmpresaTx(tx, empresaId)
    const resultado = await tx.cobranca.updateMany({
      where: {
        empresaId,
        status: StatusCobranca.PENDENTE,
        expiraEm: { lte: new Date() }
      },
      data: { status: StatusCobranca.EXPIRADA }
    })

    return resultado.count
  }, OPCOES_TRANSACAO_PAGAMENTO)
}

export async function cancelarCobrancasPendentesTx(
  tx: Prisma.TransactionClient,
  empresaId: number,
  vinculo: { ordemId?: number; orcamentoId?: number },
  canceladaEm = new Date()
) {
  const vinculos: Prisma.CobrancaWhereInput[] = [
    ...(vinculo.ordemId !== undefined
      ? [{ ordemId: vinculo.ordemId }]
      : []),
    ...(vinculo.orcamentoId !== undefined
      ? [{ orcamentoId: vinculo.orcamentoId }]
      : [])
  ]

  if (vinculos.length === 0) {
    return { count: 0 }
  }

  await bloquearPagamentoDaEmpresaTx(tx, empresaId)
  return tx.cobranca.updateMany({
    where: {
      empresaId,
      status: StatusCobranca.PENDENTE,
      OR: vinculos
    },
    data: {
      status: StatusCobranca.CANCELADA,
      canceladaEm
    }
  })
}

export function buscarCobrancaPagaNaoConciliadaTx(
  tx: Prisma.TransactionClient,
  empresaId: number,
  vinculo: { ordemId?: number; orcamentoId?: number }
) {
  const vinculos: Prisma.CobrancaWhereInput[] = [
    ...(vinculo.ordemId !== undefined
      ? [{ ordemId: vinculo.ordemId }]
      : []),
    ...(vinculo.orcamentoId !== undefined
      ? [{ orcamentoId: vinculo.orcamentoId }]
      : [])
  ]

  if (vinculos.length === 0) return Promise.resolve(null)

  return tx.cobranca.findFirst({
    where: {
      empresaId,
      status: StatusCobranca.PAGA,
      pagamento: { is: null },
      OR: vinculos
    },
    select: { id: true }
  })
}

export async function listarCobrancasService(
  empresaId: number,
  filtros: ListarCobrancasInput
) {
  await expirarCobrancasVencidasService(empresaId)

  const where = {
    empresaId,
    ...(filtros.status !== undefined && { status: filtros.status }),
    ...(filtros.ordemId !== undefined && { ordemId: filtros.ordemId }),
    ...(filtros.orcamentoId !== undefined && {
      orcamentoId: filtros.orcamentoId
    })
  }
  const skip = (filtros.pagina - 1) * filtros.limite

  const [cobrancas, total] = await Promise.all([
    prisma.cobranca.findMany({
      where,
      select: cobrancaLeituraSelect,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      skip,
      take: filtros.limite
    }),
    prisma.cobranca.count({ where })
  ])

  return {
    cobrancas,
    paginacao: {
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,
      totalPaginas: Math.ceil(total / filtros.limite)
    }
  }
}

export async function buscarCobrancaService(id: number, empresaId: number) {
  await sincronizarCobrancaMercadoPagoService(id, empresaId)
  await expirarCobrancasVencidasService(empresaId)

  return prisma.cobranca.findUnique({
    where: {
      id_empresaId: { id, empresaId }
    },
    select: cobrancaLeituraSelect
  })
}

async function prepararCobrancaService(
  empresaId: number,
  dados: CriarCobrancaInput
) {
  // Fase 1: valida e reserva o saldo em uma transacao curta. O advisory lock
  // impede que a conexao da empresa seja trocada no meio da reserva.
  return prisma.$transaction(async tx => {
    await bloquearPagamentoDaEmpresaTx(tx, empresaId)

    await tx.cobranca.updateMany({
      where: {
        empresaId,
        orcamentoId: dados.orcamentoId,
        status: StatusCobranca.PENDENTE,
        expiraEm: { lte: new Date() }
      },
      data: { status: StatusCobranca.EXPIRADA }
    })

    const existente = await tx.cobranca.findUnique({
      where: {
        empresaId_chaveIdempotencia: {
          empresaId,
          chaveIdempotencia: dados.chaveIdempotencia
        }
      },
      select: cobrancaSelect
    })

    if (existente) {
      if (
        existente.orcamentoId !== dados.orcamentoId ||
        (dados.ordemId !== undefined && existente.ordemId !== dados.ordemId)
      ) {
        return {
          sucesso: false as const,
          motivo: "chave_idempotencia_em_uso" as const
        }
      }

      if (
        existente.status !== StatusCobranca.PENDENTE ||
        (existente.identificadorExterno && existente.codigoPix)
      ) {
        return {
          sucesso: true as const,
          finalizada: true as const,
          cobranca: existente,
          reutilizada: true as const
        }
      }

      const orcamento = await tx.orcamento.findUnique({
        where: {
          id_empresaId: { id: existente.orcamentoId, empresaId }
        },
        select: { numero: true }
      })

      if (!orcamento) {
        return {
          sucesso: false as const,
          motivo: "orcamento_nao_encontrado" as const
        }
      }

      return {
        sucesso: true as const,
        finalizada: false as const,
        cobranca: existente,
        reutilizada: true as const,
        descricao: `Orcamento Servix #${orcamento.numero}`
      }
    }

    const configuracao = await tx.configuracaoPagamento.findUnique({
      where: { empresaId },
      select: {
        provedor: true,
        ambiente: true,
        ativo: true,
        pixHabilitado: true,
        status: true
      }
    })

    if (
      !configuracao ||
      !configuracao.ativo ||
      configuracao.status !== StatusConfiguracaoPagamento.ATIVA
    ) {
      return {
        sucesso: false as const,
        motivo: "gateway_nao_configurado" as const
      }
    }

    if (!configuracao.pixHabilitado) {
      return {
        sucesso: false as const,
        motivo: "pix_nao_habilitado" as const
      }
    }

    if (!configuracaoPagamentoAceitaPix(configuracao, empresaId)) {
      const motivo = configuracao.provedor === ProvedorPagamento.SIMULADO
        ? "simulador_indisponivel" as const
        : "provedor_nao_conectado" as const

      return {
        sucesso: false as const,
        motivo,
        provedor: configuracao.provedor
      }
    }

    const orcamento = await tx.orcamento.findUnique({
      where: {
        id_empresaId: {
          id: dados.orcamentoId,
          empresaId
        }
      },
      select: {
        id: true,
        numero: true,
        total: true,
        status: true,
        versao: true,
        ordem: {
          select: {
            id: true,
            status: true,
            versao: true
          }
        }
      }
    })

    if (!orcamento) {
      return {
        sucesso: false as const,
        motivo: "orcamento_nao_encontrado" as const
      }
    }

    if (
      orcamento.status !== StatusOrcamento.APROVADO &&
      orcamento.status !== StatusOrcamento.CONVERTIDO
    ) {
      return {
        sucesso: false as const,
        motivo: "orcamento_nao_aprovado" as const,
        statusAtual: orcamento.status
      }
    }

    const ordemId = dados.ordemId ?? orcamento.ordem?.id

    if (
      dados.ordemId !== undefined &&
      orcamento.ordem?.id !== dados.ordemId
    ) {
      return {
        sucesso: false as const,
        motivo: "ordem_nao_pertence_orcamento" as const
      }
    }

    if (
      orcamento.ordem &&
      (orcamento.ordem.status === StatusOrdem.ENTREGUE ||
        orcamento.ordem.status === StatusOrdem.CANCELADO)
    ) {
      return {
        sucesso: false as const,
        motivo: "ordem_finalizada" as const,
        statusAtual: orcamento.ordem.status
      }
    }

    const cobrancaIncompleta = await tx.cobranca.findFirst({
      where: {
        empresaId,
        orcamentoId: dados.orcamentoId,
        status: StatusCobranca.PENDENTE,
        OR: [
          { identificadorExterno: null },
          { codigoPix: null },
          { expiraEm: null }
        ]
      },
      select: cobrancaSelect,
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }]
    })

    if (cobrancaIncompleta) {
      return {
        sucesso: true as const,
        finalizada: false as const,
        cobranca: cobrancaIncompleta,
        reutilizada: true as const,
        descricao: `Orcamento Servix #${orcamento.numero}`
      }
    }

    let totalPago = new Prisma.Decimal(0)

    if (ordemId !== undefined) {
      const pagamentoConfirmado = await tx.pagamento.aggregate({
        where: {
          empresaId,
          ordemId,
          status: StatusRegistroPagamento.CONFIRMADO
        },
        _sum: { valor: true }
      })
      totalPago = decimal(pagamentoConfirmado._sum.valor)
    }

    const cobrancasEmAberto = await tx.cobranca.findMany({
      where: {
        empresaId,
        orcamentoId: dados.orcamentoId,
        status: {
          in: [StatusCobranca.PENDENTE, StatusCobranca.PAGA]
        }
      },
      select: {
        status: true,
        valor: true,
        pagamento: { select: { id: true } }
      }
    })

    const valorReservado = cobrancasEmAberto.reduce(
      (total, cobranca) =>
        cobranca.status === StatusCobranca.PENDENTE || !cobranca.pagamento
          ? total.plus(cobranca.valor)
          : total,
      new Prisma.Decimal(0)
    )
    const valor = decimal(orcamento.total)
      .minus(totalPago)
      .minus(valorReservado)

    if (valor.lessThanOrEqualTo(0)) {
      return {
        sucesso: false as const,
        motivo: "sem_saldo_para_cobranca" as const
      }
    }

    const cobranca = await tx.cobranca.create({
      data: {
        empresaId,
        orcamentoId: dados.orcamentoId,
        ...(ordemId !== undefined && { ordemId }),
        provedor: configuracao.provedor,
        ambiente: configuracao.ambiente,
        formaPagamento: FormaPagamento.PIX,
        status: StatusCobranca.PENDENTE,
        valor,
        chaveIdempotencia: dados.chaveIdempotencia,
        // Evita uma reserva pendente eterna caso a resposta do gateway seja
        // perdida. O mesmo vencimento e enviado ao provedor logo abaixo.
        expiraEm: new Date(Date.now() + DURACAO_PADRAO_COBRANCA_MS)
      },
      select: cobrancaSelect
    })

    const serializacao = ordemId !== undefined && orcamento.ordem
      ? await tx.ordemServico.updateMany({
          where: {
            id: ordemId,
            empresaId,
            status: orcamento.ordem.status,
            versao: orcamento.ordem.versao
          },
          data: { versao: { increment: 1 } }
        })
      : await tx.orcamento.updateMany({
          where: {
            id: orcamento.id,
            empresaId,
            status: orcamento.status,
            versao: orcamento.versao
          },
          data: { versao: { increment: 1 } }
        })

    if (serializacao.count === 0) {
      throw Object.assign(
        new Error("Conflito ao serializar a criacao da cobranca"),
        { code: "P2034" }
      )
    }

    return {
      sucesso: true as const,
      finalizada: false as const,
      cobranca,
      reutilizada: false as const,
      descricao: `Orcamento Servix #${orcamento.numero}`
    }
  }, {
    ...OPCOES_TRANSACAO_PAGAMENTO,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  })
}

function falhaDeConcorrenciaRepetivel(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false
  }

  const codigo = String(error.code)
  return codigo === "P2002" || codigo === "P2034"
}

async function prepararCobrancaComRetry(
  empresaId: number,
  dados: CriarCobrancaInput
) {
  let ultimaFalha: unknown

  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    try {
      return await prepararCobrancaService(empresaId, dados)
    } catch (error) {
      ultimaFalha = error
      if (!falhaDeConcorrenciaRepetivel(error)) {
        throw error
      }
    }
  }

  throw ultimaFalha
}

export async function criarCobrancaService(
  empresaId: number,
  dados: CriarCobrancaInput
) {
  const preparacao = await prepararCobrancaComRetry(empresaId, dados)

  if (!preparacao.sucesso || preparacao.finalizada) {
    return preparacao
  }

  // Fase 2: o mesmo lock usado para trocar/desconectar a conta permanece ativo
  // desde a resolucao da credencial ate a persistencia da resposta. Assim uma
  // Order nunca nasce usando uma conexao removida no meio da requisicao.
  // O limite transacional cobre uma eventual renovacao OAuth e o timeout da
  // chamada Orders sem liberar o lock antes de persistir a resposta.
  const operacaoGateway = await prisma.$transaction(async tx => {
    await bloquearPagamentoDaEmpresaTx(tx, empresaId)

    const gateway = await resolverGatewayPagamento(
      preparacao.cobranca.provedor,
      {
        empresaId,
        ambiente: preparacao.cobranca.ambiente
      }
    )

    if (!gateway) {
      const motivo = preparacao.cobranca.provedor === ProvedorPagamento.SIMULADO
        ? "simulador_indisponivel" as const
        : "provedor_nao_conectado" as const

      return {
        sucesso: false as const,
        motivo,
        provedor: preparacao.cobranca.provedor
      }
    }

    let criadaNoGateway

    try {
      criadaNoGateway = await gateway.criarCobranca({
        empresaId,
        cobrancaLocalId: preparacao.cobranca.id,
        chaveIdempotencia: preparacao.cobranca.chaveIdempotencia,
        valor: preparacao.cobranca.valor.toFixed(2),
        descricao: preparacao.descricao,
        ambiente: preparacao.cobranca.ambiente,
        ...(preparacao.cobranca.expiraEm && {
          expiraEm: preparacao.cobranca.expiraEm
        })
      })
    } catch (error) {
      if (error instanceof ErroMercadoPagoGateway) {
        const tempoLimite = error.codigo === "TEMPO_LIMITE"
        throw new AppError(
          tempoLimite
            ? "O Mercado Pago demorou para responder. Tente novamente."
            : "O Mercado Pago nao conseguiu gerar o Pix. Tente novamente.",
          tempoLimite ? 504 : 502,
          tempoLimite
            ? "MERCADO_PAGO_TEMPO_LIMITE"
            : "MERCADO_PAGO_INDISPONIVEL"
        )
      }

      throw error
    }

    // A chave idempotente permite repetir o POST se a resposta de rede se
    // perder. Persistimos somente enquanto a reserva local continua pendente.
    await tx.cobranca.updateMany({
      where: {
        id: preparacao.cobranca.id,
        empresaId,
        status: StatusCobranca.PENDENTE,
        identificadorExterno: null
      },
      data: {
        identificadorExterno: criadaNoGateway.identificadorExterno,
        ...(criadaNoGateway.mercadoPagoUserId && {
          mercadoPagoUserId: criadaNoGateway.mercadoPagoUserId
        }),
        codigoPix: criadaNoGateway.codigoPix,
        ...(criadaNoGateway.qrCodeBase64 !== undefined && {
          qrCodeBase64: criadaNoGateway.qrCodeBase64
        }),
        expiraEm: criadaNoGateway.expiraEm
      }
    })
    return { sucesso: true as const }
  }, OPCOES_TRANSACAO_PAGAMENTO)

  if (!operacaoGateway.sucesso) return operacaoGateway

  const cobranca = await prisma.cobranca.findUniqueOrThrow({
    where: {
      id_empresaId: { id: preparacao.cobranca.id, empresaId }
    },
    select: cobrancaSelect
  })

  return {
    sucesso: true as const,
    cobranca,
    reutilizada: preparacao.reutilizada
  }
}

export async function sincronizarCobrancaMercadoPagoService(
  id: number,
  empresaId: number,
  forcar = false
) {
  const cobranca = await prisma.cobranca.findUnique({
    where: { id_empresaId: { id, empresaId } },
    select: {
      id: true,
      provedor: true,
      ambiente: true,
      status: true,
      identificadorExterno: true,
      mercadoPagoUserId: true,
      valor: true,
      finalizadaNoGatewayEm: true,
      sincronizarApos: true,
      atualizadoEm: true
    }
  })

  if (
    !cobranca ||
    cobranca.provedor !== ProvedorPagamento.MERCADO_PAGO ||
    cobranca.ambiente !== AmbientePagamento.TESTE ||
    !cobranca.identificadorExterno ||
    !STATUS_SINCRONIZAVEIS_MERCADO_PAGO.has(cobranca.status)
  ) {
    return { sincronizada: false as const, motivo: "nao_aplicavel" as const }
  }

  const agora = new Date()

  if (
    cobranca.sincronizarApos &&
    cobranca.sincronizarApos.getTime() > agora.getTime()
  ) {
    return {
      sincronizada: false as const,
      motivo: "aguarde_provedor" as const
    }
  }

  const limite = new Date(
    agora.getTime() - INTERVALO_SINCRONIZACAO_MERCADO_PAGO_MS
  )

  if (!forcar && cobranca.atualizadoEm > limite) {
    return { sincronizada: false as const, motivo: "aguarde" as const }
  }

  // A atualizacao do timestamp funciona como um lease curto entre instancias:
  // somente uma delas consulta o provedor dentro de cada janela.
  const reserva = await prisma.cobranca.updateMany({
    where: {
      id,
      empresaId,
      provedor: ProvedorPagamento.MERCADO_PAGO,
      ambiente: AmbientePagamento.TESTE,
      status: {
        in: [
          StatusCobranca.PENDENTE,
          StatusCobranca.EXPIRADA,
          StatusCobranca.CANCELADA
        ]
      },
      identificadorExterno: cobranca.identificadorExterno,
      OR: [
        { sincronizarApos: null },
        { sincronizarApos: { lte: agora } }
      ],
      ...(!forcar && { atualizadoEm: { lte: limite } })
    },
    data: {
      atualizadoEm: agora,
      sincronizarApos: null
    }
  })

  if (reserva.count === 0) {
    return { sincronizada: false as const, motivo: "em_andamento" as const }
  }

  const gateway = await resolverGatewayPagamento(
    ProvedorPagamento.MERCADO_PAGO,
    {
      empresaId,
      ambiente: AmbientePagamento.TESTE
    }
  )

  if (!gateway) {
    return {
      sincronizada: false as const,
      motivo: "gateway_indisponivel" as const
    }
  }

  let consulta

  try {
    consulta = await gateway.consultarCobranca(
      cobranca.identificadorExterno,
      {
        valor: cobranca.valor.toFixed(2),
        referenciaExterna: `servix_${empresaId}_${cobranca.id}`
      }
    )
  } catch (error) {
    if (error instanceof ErroMercadoPagoGateway) {
      if (error.codigo === "LIMITE_REQUISICOES") {
        const espera = error.tentarNovamenteEmMs ?? 10_000
        await prisma.cobranca.updateMany({
          where: {
            id,
            empresaId,
            provedor: ProvedorPagamento.MERCADO_PAGO,
            status: {
              in: [
                StatusCobranca.PENDENTE,
                StatusCobranca.EXPIRADA,
                StatusCobranca.CANCELADA
              ]
            }
          },
          data: {
            sincronizarApos: new Date(Date.now() + espera)
          }
        })

        return {
          sincronizada: false as const,
          motivo: "aguarde_provedor" as const
        }
      }

      return {
        sincronizada: false as const,
        motivo: "gateway_indisponivel" as const
      }
    }

    throw error
  }

  if (
    cobranca.mercadoPagoUserId &&
    consulta.mercadoPagoUserId &&
    cobranca.mercadoPagoUserId !== consulta.mercadoPagoUserId
  ) {
    return {
      sincronizada: false as const,
      motivo: "conta_gateway_divergente" as const
    }
  }

  if (consulta.status === "PENDENTE") {
    if (
      consulta.mercadoPagoUserId &&
      !cobranca.mercadoPagoUserId
    ) {
      await prisma.cobranca.updateMany({
        where: {
          id,
          empresaId,
          mercadoPagoUserId: null
        },
        data: { mercadoPagoUserId: consulta.mercadoPagoUserId }
      })
    }

    return {
      sincronizada: true as const,
      status: StatusCobranca.PENDENTE
    }
  }

  if (consulta.status === "PAGA") {
    await executarTransacaoComRollback(async tx => {
      await tx.cobranca.updateMany({
        where: {
          id,
          empresaId,
          provedor: ProvedorPagamento.MERCADO_PAGO,
          status: {
            in: [
              StatusCobranca.PENDENTE,
              StatusCobranca.EXPIRADA,
              StatusCobranca.CANCELADA
            ]
          }
        },
        data: {
          status: StatusCobranca.PAGA,
          pagaEm: consulta.pagaEm ?? new Date(),
          finalizadaNoGatewayEm: new Date(),
          ...(consulta.mercadoPagoUserId && {
            mercadoPagoUserId: consulta.mercadoPagoUserId
          })
        }
      })

      await materializarPagamentoDaCobrancaTx(tx, id, empresaId)
    })

    return {
      sincronizada: true as const,
      status: StatusCobranca.PAGA
    }
  }

  const status = consulta.status === "EXPIRADA"
    ? StatusCobranca.EXPIRADA
    : StatusCobranca.CANCELADA

  await prisma.cobranca.updateMany({
    where: {
      id,
      empresaId,
      provedor: ProvedorPagamento.MERCADO_PAGO,
      status: {
        in: [
          StatusCobranca.PENDENTE,
          StatusCobranca.EXPIRADA,
          StatusCobranca.CANCELADA
        ]
      }
    },
    data: {
      status,
      finalizadaNoGatewayEm: new Date(),
      ...(consulta.mercadoPagoUserId && {
        mercadoPagoUserId: consulta.mercadoPagoUserId
      }),
      ...(status === StatusCobranca.CANCELADA && {
        canceladaEm: new Date()
      })
    }
  })

  return { sincronizada: true as const, status }
}

function sanitizarCobrancaPublica(
  cobranca: Prisma.CobrancaGetPayload<{ select: typeof cobrancaPublicaSelect }>
) {
  return cobranca
}

export async function buscarCobrancaPublicaService(token: string) {
  const orcamento = await prisma.orcamento.findUnique({
    where: { tokenPublico: token },
    select: {
      id: true,
      empresaId: true
    }
  })

  if (!orcamento) {
    return {
      encontrado: false as const,
      cobranca: null
    }
  }

  const cobrancaPendente = await prisma.cobranca.findFirst({
    where: {
      empresaId: orcamento.empresaId,
      orcamentoId: orcamento.id,
      provedor: ProvedorPagamento.MERCADO_PAGO,
      status: {
        in: [StatusCobranca.PENDENTE, StatusCobranca.EXPIRADA]
      },
      identificadorExterno: { not: null }
    },
    select: {
      id: true,
      expiraEm: true
    },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }]
  })

  if (cobrancaPendente) {
    await sincronizarCobrancaMercadoPagoService(
      cobrancaPendente.id,
      orcamento.empresaId,
      Boolean(
        cobrancaPendente.expiraEm &&
        cobrancaPendente.expiraEm.getTime() <= Date.now()
      )
    )
  }

  await expirarCobrancasVencidasService(orcamento.empresaId)

  const cobranca = await prisma.cobranca.findFirst({
    where: {
      empresaId: orcamento.empresaId,
      orcamentoId: orcamento.id
    },
    select: cobrancaPublicaSelect,
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }]
  })

  return {
    encontrado: true as const,
    cobranca: cobranca ? sanitizarCobrancaPublica(cobranca) : null
  }
}

export async function criarCobrancaPublicaService(
  token: string,
  chaveIdempotencia: string
) {
  const orcamento = await prisma.orcamento.findUnique({
    where: { tokenPublico: token },
    select: {
      id: true,
      empresaId: true,
      formaPagamentoEscolhida: true
    }
  })

  if (!orcamento) {
    return {
      sucesso: false as const,
      motivo: "orcamento_nao_encontrado" as const
    }
  }

  if (orcamento.formaPagamentoEscolhida !== FormaPagamento.PIX) {
    return {
      sucesso: false as const,
      motivo: "forma_pagamento_nao_pix" as const
    }
  }

  const resultado = await criarCobrancaService(orcamento.empresaId, {
    orcamentoId: orcamento.id,
    chaveIdempotencia
  })

  if (!resultado.sucesso) {
    return resultado
  }

  const cobranca = await prisma.cobranca.findUniqueOrThrow({
    where: {
      id_empresaId: {
        id: resultado.cobranca.id,
        empresaId: orcamento.empresaId
      }
    },
    select: cobrancaPublicaSelect
  })

  return {
    sucesso: true as const,
    cobranca: sanitizarCobrancaPublica(cobranca),
    reutilizada: resultado.reutilizada
  }
}

// Converte uma cobranca ja paga em uma unica entrada do ledger quando a OS
// existe. createMany/skipDuplicates usa a chave unica de cobrancaId como a
// ultima barreira de idempotencia mesmo sob confirmacoes simultaneas.
export async function materializarPagamentoDaCobrancaTx(
  tx: Prisma.TransactionClient,
  cobrancaId: number,
  empresaId: number,
  incrementarVersaoOrdem = true
) {
  const cobranca = await tx.cobranca.findUnique({
    where: {
      id_empresaId: { id: cobrancaId, empresaId }
    },
    select: {
      id: true,
      status: true,
      valor: true,
      pagaEm: true,
      ordemId: true,
      pagamento: { select: { id: true } },
      orcamento: {
        select: {
          ordem: { select: { id: true } }
        }
      }
    }
  })

  if (
    !cobranca ||
    cobranca.status !== StatusCobranca.PAGA ||
    cobranca.pagamento
  ) {
    return cobranca?.pagamento ?? null
  }

  const ordemId = cobranca.ordemId ?? cobranca.orcamento.ordem?.id

  if (ordemId === undefined) {
    return null
  }

  if (cobranca.ordemId === null) {
    await tx.cobranca.updateMany({
      where: { id: cobrancaId, empresaId, ordemId: null },
      data: { ordemId }
    })
  }

  // O CAS da versao da OS serializa esta conciliacao com pagamentos manuais.
  // Assim, o valor aplicado ao ledger nunca ultrapassa o saldo mais recente,
  // embora a cobranca preserve integralmente o que o gateway confirmou.
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    const ordem = await tx.ordemServico.findUnique({
      where: {
        id_empresaId: { id: ordemId, empresaId }
      },
      select: {
        valor: true,
        versao: true,
        status: true
      }
    })

    if (!ordem) {
      return null
    }

    if (
      ordem.status === StatusOrdem.ENTREGUE ||
      ordem.status === StatusOrdem.CANCELADO
    ) {
      return null
    }

    const pagamentosConfirmados = await tx.pagamento.aggregate({
      where: {
        empresaId,
        ordemId,
        status: StatusRegistroPagamento.CONFIRMADO
      },
      _sum: { valor: true }
    })
    const saldo = decimal(ordem.valor)
      .minus(decimal(pagamentosConfirmados._sum.valor))

    if (saldo.lessThanOrEqualTo(0)) {
      return tx.pagamento.findFirst({
        where: { cobrancaId, empresaId },
        select: { id: true }
      })
    }

    const valorAplicado = cobranca.valor.lessThan(saldo)
      ? cobranca.valor
      : saldo
    const conciliacao = await tx.ordemServico.updateMany({
      where: {
        id: ordemId,
        empresaId,
        versao: ordem.versao,
        status: {
          notIn: [StatusOrdem.ENTREGUE, StatusOrdem.CANCELADO]
        }
      },
      data: {
        versao: { increment: incrementarVersaoOrdem ? 1 : 0 }
      }
    })

    if (conciliacao.count === 0) {
      continue
    }

    const valorIntegral = valorAplicado.equals(cobranca.valor)
    await tx.pagamento.createMany({
      data: [{
        empresaId,
        ordemId,
        cobrancaId,
        valor: valorAplicado,
        formaPagamento: FormaPagamento.PIX,
        status: StatusRegistroPagamento.CONFIRMADO,
        origem: OrigemPagamento.GATEWAY,
        observacao: valorIntegral
          ? `Confirmado automaticamente na cobranca #${cobrancaId}`
          : `Cobranca #${cobrancaId} confirmada em ${cobranca.valor.toFixed(2)}; ${valorAplicado.toFixed(2)} conciliados ao saldo da OS`,
        pagoEm: cobranca.pagaEm ?? new Date()
      }],
      skipDuplicates: true
    })

    return tx.pagamento.findFirst({
      where: { cobrancaId, empresaId },
      select: { id: true }
    })
  }

  throw Object.assign(
    new Error("Nao foi possivel conciliar a cobranca com a versao atual da OS"),
    { code: "P2034" }
  )
}

export async function confirmarCobrancaSimuladaService(
  id: number,
  empresaId: number
) {
  return executarTransacaoComRollback(async tx => {
    const atual = await tx.cobranca.findUnique({
      where: {
        id_empresaId: { id, empresaId }
      },
      select: {
        ...cobrancaSelect,
        orcamento: {
          select: {
            id: true,
            status: true,
            versao: true,
            ordem: {
              select: {
                id: true,
                status: true
              }
            }
          }
        }
      }
    })

    if (!atual) {
      return {
        sucesso: false as const,
        motivo: "cobranca_nao_encontrada" as const
      }
    }

    if (atual.provedor !== ProvedorPagamento.SIMULADO) {
      return {
        sucesso: false as const,
        motivo: "cobranca_nao_simulada" as const
      }
    }

    if (atual.status === StatusCobranca.PAGA) {
      await materializarPagamentoDaCobrancaTx(tx, id, empresaId)
      const cobranca = await tx.cobranca.findUniqueOrThrow({
        where: { id_empresaId: { id, empresaId } },
        select: cobrancaSelect
      })

      return {
        sucesso: true as const,
        cobranca,
        idempotente: true as const
      }
    }

    if (
      atual.orcamento.ordem &&
      (atual.orcamento.ordem.status === StatusOrdem.ENTREGUE ||
        atual.orcamento.ordem.status === StatusOrdem.CANCELADO)
    ) {
      return {
        sucesso: false as const,
        motivo: "ordem_finalizada" as const,
        statusAtual: atual.orcamento.ordem.status
      }
    }

    if (
      !atual.orcamento.ordem &&
      atual.orcamento.status !== StatusOrcamento.APROVADO
    ) {
      return {
        sucesso: false as const,
        motivo: "orcamento_nao_confirmavel" as const,
        statusAtual: atual.orcamento.status
      }
    }

    if (atual.status !== StatusCobranca.PENDENTE) {
      return {
        sucesso: false as const,
        motivo: "status_nao_confirmavel" as const,
        statusAtual: atual.status
      }
    }

    const pagoEm = new Date()

    if (atual.expiraEm && atual.expiraEm.getTime() <= pagoEm.getTime()) {
      await tx.cobranca.updateMany({
        where: {
          id,
          empresaId,
          status: StatusCobranca.PENDENTE,
          expiraEm: { lte: pagoEm }
        },
        data: { status: StatusCobranca.EXPIRADA }
      })

      const cobranca = await tx.cobranca.findUniqueOrThrow({
        where: { id_empresaId: { id, empresaId } },
        select: cobrancaSelect
      })

      if (cobranca.status === StatusCobranca.PAGA) {
        await materializarPagamentoDaCobrancaTx(tx, id, empresaId)
        return {
          sucesso: true as const,
          cobranca,
          idempotente: true as const
        }
      }

      return {
        sucesso: false as const,
        motivo: "status_nao_confirmavel" as const,
        statusAtual: cobranca.status
      }
    }

    const ordemId = atual.ordemId ?? atual.orcamento.ordem?.id
    const atualizacao = await tx.cobranca.updateMany({
      where: {
        id,
        empresaId,
        status: StatusCobranca.PENDENTE,
        OR: [
          { expiraEm: null },
          { expiraEm: { gt: pagoEm } }
        ]
      },
      data: {
        status: StatusCobranca.PAGA,
        pagaEm: pagoEm,
        ...(ordemId !== undefined && atual.ordemId === null && { ordemId })
      }
    })

    if (atualizacao.count === 0) {
      const cobranca = await tx.cobranca.findUniqueOrThrow({
        where: { id_empresaId: { id, empresaId } },
        select: cobrancaSelect
      })

      if (cobranca.status === StatusCobranca.PAGA) {
        await materializarPagamentoDaCobrancaTx(tx, id, empresaId)
        return {
          sucesso: true as const,
          cobranca,
          idempotente: true as const
        }
      }

      return {
        sucesso: false as const,
        motivo: "status_nao_confirmavel" as const,
        statusAtual: cobranca.status
      }
    }

    if (!atual.orcamento.ordem) {
      const serializacao = await tx.orcamento.updateMany({
        where: {
          id: atual.orcamento.id,
          empresaId,
          status: StatusOrcamento.APROVADO,
          versao: atual.orcamento.versao
        },
        data: { versao: { increment: 1 } }
      })

      if (serializacao.count === 0) {
        const orcamentoAtual = await tx.orcamento.findUnique({
          where: {
            id_empresaId: {
              id: atual.orcamento.id,
              empresaId
            }
          },
          select: {
            status: true,
            ordem: {
              select: {
                id: true,
                status: true
              }
            }
          }
        })

        if (
          orcamentoAtual?.status === StatusOrcamento.CONVERTIDO &&
          orcamentoAtual.ordem &&
          orcamentoAtual.ordem.status !== StatusOrdem.ENTREGUE &&
          orcamentoAtual.ordem.status !== StatusOrdem.CANCELADO
        ) {
          // A conversão venceu a corrida. A materialização comum logo abaixo
          // relê a relação e associa esta cobrança à OS recém-criada.
        } else if (orcamentoAtual?.status === StatusOrcamento.APROVADO) {
          throw Object.assign(
            new Error("Conflito ao serializar a confirmacao da cobranca"),
            { code: "P2034" }
          )
        } else {
          abortarTransacaoComResultado({
            sucesso: false as const,
            motivo: "orcamento_nao_confirmavel" as const,
            statusAtual: orcamentoAtual?.status ?? atual.orcamento.status
          })
        }
      }
    }

    await materializarPagamentoDaCobrancaTx(tx, id, empresaId)

    const cobranca = await tx.cobranca.findUniqueOrThrow({
      where: { id_empresaId: { id, empresaId } },
      select: cobrancaSelect
    })

    return {
      sucesso: true as const,
      cobranca,
      idempotente: false as const
    }
  })
}
