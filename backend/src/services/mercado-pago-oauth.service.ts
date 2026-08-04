import { createHash, randomBytes } from "node:crypto"

import {
  ErroClienteOAuthMercadoPago,
  falhaOAuthMercadoPagoEhDefinitiva,
  MercadoPagoOAuthClient
} from "../clients/mercado-pago-oauth.client.js"
import {
  obterConfiguracaoOAuthMercadoPago,
  obterModoPagamentosClientesMercadoPago
} from "../config/env.js"
import {
  PapelUsuario,
  ProvedorPagamento,
  StatusCobranca,
  StatusConfiguracaoPagamento
} from "../generated/prisma/enums.js"
import {
  criptografarToken,
  descriptografarToken,
  ErroCriptografiaTokens
} from "../lib/criptografia-tokens.js"
import { prisma } from "../lib/prisma.js"
import { erroPrismaPossuiCodigo } from "../lib/prisma-errors.js"
import {
  bloquearPagamentoDaEmpresaTx,
  OPCOES_TRANSACAO_PAGAMENTO
} from "../lib/transacao.js"

const URL_AUTORIZACAO = "https://auth.mercadopago.com/authorization"
const DURACAO_ESTADO_MS = 10 * 60 * 1000
const MARGEM_RENOVACAO_MS = 5 * 60 * 1000
const LIMITE_CODIGO_OAUTH = 2048
const LIMITE_STATE = 512

type CodigoErroFluxoOAuthMercadoPago =
  | "OAUTH_NAO_CONFIGURADO"
  | "USUARIO_NAO_AUTORIZADO"
  | "STATE_INVALIDO"
  | "CALLBACK_INVALIDO"
  | "TROCA_TOKEN_FALHOU"

export class ErroFluxoOAuthMercadoPago extends Error {
  constructor(public readonly codigo: CodigoErroFluxoOAuthMercadoPago) {
    super("Nao foi possivel concluir a conexao com o Mercado Pago.")
    this.name = "ErroFluxoOAuthMercadoPago"
  }
}

function hashState(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex")
}

function contextoCodeVerifier(
  empresaId: number,
  usuarioId: number,
  stateHash: string
) {
  return `oauth:mercado-pago:${empresaId}:${usuarioId}:${stateHash}:verifier`
}

function contextoAccessToken(empresaId: number) {
  return `integracao:mercado-pago:${empresaId}:access-token`
}

function contextoRefreshToken(empresaId: number) {
  return `integracao:mercado-pago:${empresaId}:refresh-token`
}

function criarClienteOAuth() {
  const configuracao = obterConfiguracaoOAuthMercadoPago()

  if (configuracao.status !== "CONFIGURADA") {
    throw new ErroFluxoOAuthMercadoPago("OAUTH_NAO_CONFIGURADO")
  }

  return {
    configuracao,
    client: new MercadoPagoOAuthClient({
      clientId: configuracao.clientId,
      clientSecret: configuracao.clientSecret,
      redirectUri: configuracao.redirectUri,
      testToken: !configuracao.liveModeEsperado,
      timeoutMs: configuracao.timeoutMs
    })
  }
}

function tokenExpiraEm(expiresIn: number, agora: Date): Date {
  return new Date(agora.getTime() + expiresIn * 1000)
}

export async function iniciarOAuthMercadoPagoService(
  empresaId: number,
  usuarioId: number
) {
  const { configuracao } = criarClienteOAuth()
  const usuario = await prisma.usuario.findFirst({
    where: {
      id: usuarioId,
      empresaId,
      ativo: true,
      papel: PapelUsuario.ADMIN
    },
    select: { id: true }
  })

  if (!usuario) {
    throw new ErroFluxoOAuthMercadoPago("USUARIO_NAO_AUTORIZADO")
  }

  const agora = new Date()
  const state = randomBytes(32).toString("base64url")
  const stateHash = hashState(state)
  const codeVerifier = randomBytes(64).toString("base64url")
  const codeChallenge = createHash("sha256")
    .update(codeVerifier, "ascii")
    .digest("base64url")
  const expiraEm = new Date(agora.getTime() + DURACAO_ESTADO_MS)

  await prisma.$transaction(async tx => {
    await tx.estadoOAuthMercadoPago.updateMany({
      where: {
        empresaId,
        finalizadoEm: null,
        canceladoEm: null
      },
      data: { canceladoEm: agora }
    })
    await tx.estadoOAuthMercadoPago.deleteMany({
      where: {
        empresaId,
        expiraEm: { lte: agora },
        OR: [
          { canceladoEm: { not: null } },
          { finalizadoEm: { not: null } }
        ]
      }
    })
    await tx.estadoOAuthMercadoPago.create({
      data: {
        empresaId,
        usuarioId,
        stateHash,
        codeVerifierCriptografado: criptografarToken(
          codeVerifier,
          configuracao.tokenEncryptionKey,
          contextoCodeVerifier(empresaId, usuarioId, stateHash)
        ),
        expiraEm
      },
      select: { id: true }
    })
  })

  const url = new URL(URL_AUTORIZACAO)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", configuracao.clientId)
  url.searchParams.set("platform_id", "mp")
  url.searchParams.set("redirect_uri", configuracao.redirectUri)
  url.searchParams.set("state", state)
  url.searchParams.set("scope", "offline_access read write")
  url.searchParams.set("code_challenge", codeChallenge)
  url.searchParams.set("code_challenge_method", "S256")

  return { authorizationUrl: url.toString() }
}

async function consumirEstadoOAuthMercadoPago(
  state: string,
  chaveCriptografia: string
) {
  if (
    !state ||
    state.length > LIMITE_STATE ||
    !/^[A-Za-z0-9_-]+$/.test(state)
  ) {
    throw new ErroFluxoOAuthMercadoPago("STATE_INVALIDO")
  }

  const stateHash = hashState(state)
  const agora = new Date()
  const estado = await prisma.$transaction(async tx => {
    const encontrado = await tx.estadoOAuthMercadoPago.findUnique({
      where: { stateHash },
      select: {
        id: true,
        empresaId: true,
        usuarioId: true,
        stateHash: true,
        codeVerifierCriptografado: true,
        expiraEm: true,
        consumidoEm: true,
        canceladoEm: true,
        finalizadoEm: true
      }
    })

    if (
      !encontrado ||
      encontrado.consumidoEm ||
      encontrado.canceladoEm ||
      encontrado.finalizadoEm ||
      encontrado.expiraEm.getTime() <= agora.getTime()
    ) {
      return null
    }

    const consumo = await tx.estadoOAuthMercadoPago.updateMany({
      where: {
        id: encontrado.id,
        stateHash,
        consumidoEm: null,
        canceladoEm: null,
        finalizadoEm: null,
        expiraEm: { gt: agora }
      },
      data: { consumidoEm: agora }
    })

    if (consumo.count !== 1) return null

    const usuario = await tx.usuario.findFirst({
      where: {
        id: encontrado.usuarioId,
        empresaId: encontrado.empresaId,
        ativo: true,
        papel: PapelUsuario.ADMIN
      },
      select: { id: true }
    })

    return usuario ? encontrado : null
  })

  if (!estado) {
    throw new ErroFluxoOAuthMercadoPago("STATE_INVALIDO")
  }

  try {
    return {
      empresaId: estado.empresaId,
      usuarioId: estado.usuarioId,
      estadoId: estado.id,
      codeVerifier: descriptografarToken(
        estado.codeVerifierCriptografado,
        chaveCriptografia,
        contextoCodeVerifier(
          estado.empresaId,
          estado.usuarioId,
          estado.stateHash
        )
      )
    }
  } catch (error) {
    if (error instanceof ErroCriptografiaTokens) {
      throw new ErroFluxoOAuthMercadoPago("STATE_INVALIDO")
    }
    throw error
  }
}

export async function concluirOAuthMercadoPagoService(dados: {
  state: string
  code?: string
  erro?: string
}) {
  const { configuracao, client } = criarClienteOAuth()
  const estado = await consumirEstadoOAuthMercadoPago(
    dados.state,
    configuracao.tokenEncryptionKey
  )

  if (dados.erro) {
    await prisma.estadoOAuthMercadoPago.updateMany({
      where: {
        id: estado.estadoId,
        consumidoEm: { not: null },
        canceladoEm: null,
        finalizadoEm: null
      },
      data: { finalizadoEm: new Date() }
    })
    return {
      sucesso: false as const,
      codigo: "AUTORIZACAO_NEGADA" as const
    }
  }

  if (
    !dados.code ||
    dados.code.length > LIMITE_CODIGO_OAUTH ||
    /[\r\n]/.test(dados.code)
  ) {
    throw new ErroFluxoOAuthMercadoPago("CALLBACK_INVALIDO")
  }

  let tokens

  try {
    tokens = await client.trocarCodigoPorTokens(
      dados.code,
      estado.codeVerifier
    )
  } catch (error) {
    if (error instanceof ErroClienteOAuthMercadoPago) {
      throw new ErroFluxoOAuthMercadoPago("TROCA_TOKEN_FALHOU")
    }
    throw error
  }

  const agora = new Date()

  if (tokens.liveMode !== configuracao.liveModeEsperado) {
    const finalizacao = await prisma.estadoOAuthMercadoPago.updateMany({
      where: {
        id: estado.estadoId,
        consumidoEm: { not: null },
        canceladoEm: null,
        finalizadoEm: null
      },
      data: { finalizadoEm: agora }
    })

    if (finalizacao.count !== 1) {
      return { sucesso: false as const, codigo: "STATE_INVALIDO" as const }
    }

    // Nunca persiste uma credencial de ambiente diferente do selecionado.
    return {
      sucesso: false as const,
      codigo: "AMBIENTE_INCOMPATIVEL" as const
    }
  }

  const accessTokenCriptografado = criptografarToken(
    tokens.accessToken,
    configuracao.tokenEncryptionKey,
    contextoAccessToken(estado.empresaId)
  )
  const refreshTokenCriptografado = criptografarToken(
    tokens.refreshToken,
    configuracao.tokenEncryptionKey,
    contextoRefreshToken(estado.empresaId)
  )

  try {
    const persistencia = await prisma.$transaction(async tx => {
      await bloquearPagamentoDaEmpresaTx(tx, estado.empresaId)

      const finalizacao = await tx.estadoOAuthMercadoPago.updateMany({
        where: {
          id: estado.estadoId,
          consumidoEm: { not: null },
          canceladoEm: null,
          finalizadoEm: null
        },
        data: { finalizadoEm: agora }
      })

      if (finalizacao.count !== 1) {
        return { sucesso: false as const, codigo: "STATE_INVALIDO" as const }
      }

      await tx.cobranca.updateMany({
        where: {
          empresaId: estado.empresaId,
          provedor: ProvedorPagamento.MERCADO_PAGO,
          status: StatusCobranca.PENDENTE,
          expiraEm: { lte: agora }
        },
        data: { status: StatusCobranca.EXPIRADA }
      })

      const existente = await tx.integracaoPagamento.findUnique({
        where: {
          empresaId_provedor: {
            empresaId: estado.empresaId,
            provedor: ProvedorPagamento.MERCADO_PAGO
          }
        },
        select: {
          mercadoPagoUserId: true,
          liveMode: true
        }
      })
      const trocaDeContaOuModo = Boolean(
        existente && (
          existente.mercadoPagoUserId !== tokens.mercadoPagoUserId ||
          existente.liveMode !== tokens.liveMode
        )
      )

      if (!existente || trocaDeContaOuModo) {
        const pendentes = await tx.cobranca.count({
          where: {
            empresaId: estado.empresaId,
            provedor: ProvedorPagamento.MERCADO_PAGO,
            OR: [
              { status: StatusCobranca.PENDENTE },
              {
                status: {
                  in: [StatusCobranca.EXPIRADA, StatusCobranca.CANCELADA]
                },
                finalizadaNoGatewayEm: null
              }
            ]
          }
        })

        if (pendentes > 0) {
          return { sucesso: false as const, codigo: "COBRANCAS_PENDENTES" as const }
        }
      }

      const vinculadaAOutraEmpresa = await tx.integracaoPagamento.findFirst({
        where: {
          provedor: ProvedorPagamento.MERCADO_PAGO,
          mercadoPagoUserId: tokens.mercadoPagoUserId,
          empresaId: { not: estado.empresaId }
        },
        select: { id: true }
      })

      if (vinculadaAOutraEmpresa) {
        return { sucesso: false as const, codigo: "CONTA_JA_CONECTADA" as const }
      }

      await tx.integracaoPagamento.upsert({
        where: {
          empresaId_provedor: {
            empresaId: estado.empresaId,
            provedor: ProvedorPagamento.MERCADO_PAGO
          }
        },
        create: {
          empresaId: estado.empresaId,
          provedor: ProvedorPagamento.MERCADO_PAGO,
          mercadoPagoUserId: tokens.mercadoPagoUserId,
          accessTokenCriptografado,
          refreshTokenCriptografado,
          tokenExpiraEm: tokenExpiraEm(tokens.expiresIn, agora),
          liveMode: tokens.liveMode,
          status: StatusConfiguracaoPagamento.ATIVA,
          conectadoEm: agora
        },
        update: {
          mercadoPagoUserId: tokens.mercadoPagoUserId,
          accessTokenCriptografado,
          refreshTokenCriptografado,
          tokenExpiraEm: tokenExpiraEm(tokens.expiresIn, agora),
          liveMode: tokens.liveMode,
          status: StatusConfiguracaoPagamento.ATIVA,
          renovacaoBloqueadaAte: null,
          conectadoEm: agora
        },
        select: { id: true }
      })

      // Conectar uma conta nao escolhe o provedor operacional em nome do
      // administrador. Se ele ja usava Mercado Pago e apenas reconectou uma
      // credencial sandbox, restauramos somente o estado da configuracao.
      const configuracaoAtual = await tx.configuracaoPagamento.findUnique({
        where: { empresaId: estado.empresaId },
        select: {
          provedor: true,
          ativo: true
        }
      })

      if (configuracaoAtual?.provedor === ProvedorPagamento.MERCADO_PAGO) {
        await tx.configuracaoPagamento.updateMany({
          where: {
            empresaId: estado.empresaId,
            provedor: ProvedorPagamento.MERCADO_PAGO
          },
          data: {
            status: configuracaoAtual.ativo
              ? StatusConfiguracaoPagamento.ATIVA
              : StatusConfiguracaoPagamento.INATIVA,
            versao: { increment: 1 }
          }
        })
      }

      return { sucesso: true as const }
    }, OPCOES_TRANSACAO_PAGAMENTO)

    if (!persistencia.sucesso) return persistencia
  } catch (error) {
    if (erroPrismaPossuiCodigo(error, "P2002")) {
      return {
        sucesso: false as const,
        codigo: "CONTA_JA_CONECTADA" as const
      }
    }
    throw error
  }

  return {
    sucesso: true as const,
    empresaId: estado.empresaId,
    liveMode: tokens.liveMode
  }
}

export async function desconectarMercadoPagoService(empresaId: number) {
  return prisma.$transaction(async tx => {
    await bloquearPagamentoDaEmpresaTx(tx, empresaId)

    const agora = new Date()
    await tx.cobranca.updateMany({
      where: {
        empresaId,
        provedor: ProvedorPagamento.MERCADO_PAGO,
        status: StatusCobranca.PENDENTE,
        expiraEm: { lte: agora }
      },
      data: { status: StatusCobranca.EXPIRADA }
    })
    const pendentes = await tx.cobranca.count({
      where: {
        empresaId,
        provedor: ProvedorPagamento.MERCADO_PAGO,
        OR: [
          { status: StatusCobranca.PENDENTE },
          {
            status: {
              in: [StatusCobranca.EXPIRADA, StatusCobranca.CANCELADA]
            },
            finalizadaNoGatewayEm: null
          }
        ]
      }
    })

    if (pendentes > 0) {
      return {
        sucesso: false as const,
        codigo: "COBRANCAS_PENDENTES" as const
      }
    }

    await tx.estadoOAuthMercadoPago.updateMany({
      where: {
        empresaId,
        finalizadoEm: null,
        canceladoEm: null
      },
      data: { canceladoEm: agora }
    })
    await tx.integracaoPagamento.deleteMany({
      where: {
        empresaId,
        provedor: ProvedorPagamento.MERCADO_PAGO
      }
    })
    await tx.configuracaoPagamento.updateMany({
      where: {
        empresaId,
        provedor: ProvedorPagamento.MERCADO_PAGO
      },
      data: {
        status: StatusConfiguracaoPagamento.NAO_CONFIGURADA,
        ativo: false,
        pixHabilitado: false,
        versao: { increment: 1 }
      }
    })

    return { sucesso: true as const }
  }, OPCOES_TRANSACAO_PAGAMENTO)
}

export async function buscarResumoIntegracaoMercadoPagoService(
  empresaId: number
) {
  const configuracao = obterConfiguracaoOAuthMercadoPago()
  const integracao = await prisma.integracaoPagamento.findUnique({
    where: {
      empresaId_provedor: {
        empresaId,
        provedor: ProvedorPagamento.MERCADO_PAGO
      }
    },
    select: {
      mercadoPagoUserId: true,
      tokenExpiraEm: true,
      liveMode: true,
      status: true,
      conectadoEm: true
    }
  })
  const modo = obterModoPagamentosClientesMercadoPago()
  const ambienteCompativel = integracao && modo !== "DESABILITADO"
    ? integracao.liveMode === (modo === "PRODUCAO")
    : false
  const status = !integracao
    ? "DESCONECTADA" as const
    : !ambienteCompativel
      ? "BLOQUEADA" as const
      : integracao.status === StatusConfiguracaoPagamento.ATIVA
      ? "CONECTADA" as const
      : integracao.status === StatusConfiguracaoPagamento.ERRO
        ? "ERRO" as const
        : "DESCONECTADA" as const

  return {
    conectado: status === "CONECTADA",
    status,
    ...(integracao && {
      mercadoPagoUserId: integracao.mercadoPagoUserId,
      conectadoEm: integracao.conectadoEm,
      tokenExpiraEm: integracao.tokenExpiraEm,
      liveMode: integracao.liveMode
    }),
    origem: integracao ? "OAUTH" as const : null,
    oauthDisponivel: configuracao.status === "CONFIGURADA",
    ...(configuracao.status !== "CONFIGURADA" && {
      motivoIndisponibilidade: configuracao.motivo
    })
  }
}

async function marcarIntegracaoComErroService(
  empresaId: number,
  renovacaoBloqueadaAte?: Date
) {
  await prisma.$transaction(async tx => {
    const integracao = await tx.integracaoPagamento.updateMany({
      where: {
        empresaId,
        provedor: ProvedorPagamento.MERCADO_PAGO,
        ...(renovacaoBloqueadaAte && { renovacaoBloqueadaAte })
      },
      data: {
        status: StatusConfiguracaoPagamento.ERRO,
        renovacaoBloqueadaAte: null
      }
    })

    if (integracao.count === 0) return

    await tx.configuracaoPagamento.updateMany({
      where: {
        empresaId,
        provedor: ProvedorPagamento.MERCADO_PAGO
      },
      data: {
        status: StatusConfiguracaoPagamento.ERRO,
        ativo: false,
        pixHabilitado: false,
        versao: { increment: 1 }
      }
    })
  })
}

async function liberarLeaseRenovacao(
  empresaId: number,
  renovacaoBloqueadaAte: Date
) {
  await prisma.integracaoPagamento.updateMany({
    where: {
      empresaId,
      provedor: ProvedorPagamento.MERCADO_PAGO,
      renovacaoBloqueadaAte
    },
    data: { renovacaoBloqueadaAte: null }
  })
}

async function adiarLeaseRenovacao(
  empresaId: number,
  renovacaoBloqueadaAte: Date,
  esperaMs: number
) {
  await prisma.integracaoPagamento.updateMany({
    where: {
      empresaId,
      provedor: ProvedorPagamento.MERCADO_PAGO,
      renovacaoBloqueadaAte
    },
    data: {
      renovacaoBloqueadaAte: new Date(Date.now() + esperaMs)
    }
  })
}

// Resolve a credencial estritamente pela empresa. A renovacao usa um lease
// curto e CAS: nenhuma chamada de rede permanece dentro de uma transacao.
export type CredencialMercadoPagoEmpresa = {
  accessToken: string
  mercadoPagoUserId: string
}

export async function obterCredencialMercadoPagoService(
  empresaId: number
): Promise<CredencialMercadoPagoEmpresa | null> {
  const configuracao = obterConfiguracaoOAuthMercadoPago()
  if (configuracao.status !== "CONFIGURADA") return null

  const client = new MercadoPagoOAuthClient({
    clientId: configuracao.clientId,
    clientSecret: configuracao.clientSecret,
    redirectUri: configuracao.redirectUri,
    testToken: !configuracao.liveModeEsperado,
    timeoutMs: configuracao.timeoutMs
  })

  const integracao = await prisma.integracaoPagamento.findUnique({
    where: {
      empresaId_provedor: {
        empresaId,
        provedor: ProvedorPagamento.MERCADO_PAGO
      }
    },
    select: {
      mercadoPagoUserId: true,
      accessTokenCriptografado: true,
      refreshTokenCriptografado: true,
      tokenExpiraEm: true,
      liveMode: true,
      status: true
    }
  })

  if (
    !integracao ||
    integracao.status !== StatusConfiguracaoPagamento.ATIVA ||
    integracao.liveMode !== configuracao.liveModeEsperado ||
    !integracao.accessTokenCriptografado
  ) {
    return null
  }

  const agora = new Date()

  if (
    integracao.tokenExpiraEm.getTime() >
    agora.getTime() + MARGEM_RENOVACAO_MS
  ) {
    try {
      return {
        accessToken: descriptografarToken(
          integracao.accessTokenCriptografado,
          configuracao.tokenEncryptionKey,
          contextoAccessToken(empresaId)
        ),
        mercadoPagoUserId: integracao.mercadoPagoUserId
      }
    } catch (error) {
      if (error instanceof ErroCriptografiaTokens) {
        await marcarIntegracaoComErroService(empresaId)
        return null
      }
      throw error
    }
  }

  if (!integracao.refreshTokenCriptografado) {
    await marcarIntegracaoComErroService(empresaId)
    return null
  }

  const renovacaoBloqueadaAte = new Date(
    agora.getTime() + Math.max(15_000, configuracao.timeoutMs + 5000)
  )
  const reserva = await prisma.integracaoPagamento.updateMany({
    where: {
      empresaId,
      provedor: ProvedorPagamento.MERCADO_PAGO,
      status: StatusConfiguracaoPagamento.ATIVA,
      liveMode: configuracao.liveModeEsperado,
      refreshTokenCriptografado: integracao.refreshTokenCriptografado,
      tokenExpiraEm: integracao.tokenExpiraEm,
      OR: [
        { renovacaoBloqueadaAte: null },
        { renovacaoBloqueadaAte: { lte: agora } }
      ]
    },
    data: { renovacaoBloqueadaAte }
  })

  if (reserva.count === 0) {
    if (integracao.tokenExpiraEm.getTime() <= agora.getTime()) return null

    try {
      return {
        accessToken: descriptografarToken(
          integracao.accessTokenCriptografado,
          configuracao.tokenEncryptionKey,
          contextoAccessToken(empresaId)
        ),
        mercadoPagoUserId: integracao.mercadoPagoUserId
      }
    } catch {
      return null
    }
  }

  let refreshToken: string

  try {
    refreshToken = descriptografarToken(
      integracao.refreshTokenCriptografado,
      configuracao.tokenEncryptionKey,
      contextoRefreshToken(empresaId)
    )
  } catch (error) {
    if (error instanceof ErroCriptografiaTokens) {
      await marcarIntegracaoComErroService(
        empresaId,
        renovacaoBloqueadaAte
      )
      return null
    }
    throw error
  }

  let renovados

  try {
    renovados = await client.renovarTokens(refreshToken)
  } catch (error) {
    if (falhaOAuthMercadoPagoEhDefinitiva(error)) {
      await marcarIntegracaoComErroService(
        empresaId,
        renovacaoBloqueadaAte
      )
    } else if (
      error instanceof ErroClienteOAuthMercadoPago &&
      error.statusHttp === 429
    ) {
      await adiarLeaseRenovacao(
        empresaId,
        renovacaoBloqueadaAte,
        error.tentarNovamenteEmMs ?? 15_000
      )
    } else {
      await liberarLeaseRenovacao(empresaId, renovacaoBloqueadaAte)
    }
    if (error instanceof ErroClienteOAuthMercadoPago) return null
    throw error
  }

  if (
    renovados.mercadoPagoUserId !== integracao.mercadoPagoUserId ||
    renovados.liveMode !== configuracao.liveModeEsperado
  ) {
    await marcarIntegracaoComErroService(
      empresaId,
      renovacaoBloqueadaAte
    )
    return null
  }

  const accessTokenCriptografado = criptografarToken(
    renovados.accessToken,
    configuracao.tokenEncryptionKey,
    contextoAccessToken(empresaId)
  )
  const refreshTokenCriptografado = criptografarToken(
    renovados.refreshToken,
    configuracao.tokenEncryptionKey,
    contextoRefreshToken(empresaId)
  )
  const atualizacao = await prisma.integracaoPagamento.updateMany({
    where: {
      empresaId,
      provedor: ProvedorPagamento.MERCADO_PAGO,
      renovacaoBloqueadaAte,
      refreshTokenCriptografado: integracao.refreshTokenCriptografado,
      status: StatusConfiguracaoPagamento.ATIVA,
      liveMode: configuracao.liveModeEsperado
    },
    data: {
      accessTokenCriptografado,
      refreshTokenCriptografado,
      tokenExpiraEm: tokenExpiraEm(renovados.expiresIn, agora),
      renovacaoBloqueadaAte: null
    }
  })

  if (atualizacao.count === 0) return null
  return {
    accessToken: renovados.accessToken,
    mercadoPagoUserId: integracao.mercadoPagoUserId
  }
}

// Mantem uma API pequena para consumidores que precisam apenas verificar a
// resolucao do token. O gateway usa a credencial completa para conferir o
// user_id devolvido pela Orders API.
export async function obterAccessTokenMercadoPagoService(
  empresaId: number
): Promise<string | null> {
  return (await obterCredencialMercadoPagoService(empresaId))?.accessToken
    ?? null
}
