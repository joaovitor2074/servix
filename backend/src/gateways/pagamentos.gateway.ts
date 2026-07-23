import type {
  AmbientePagamento,
  ProvedorPagamento
} from "../generated/prisma/enums.js"

export type CriarCobrancaGatewayInput = {
  empresaId: number
  cobrancaLocalId?: number
  chaveIdempotencia: string
  valor: string
  descricao: string
  ambiente: AmbientePagamento
  expiraEm?: Date
}

export type CobrancaCriadaNoGateway = {
  identificadorExterno: string
  mercadoPagoUserId?: string
  codigoPix: string
  qrCodeBase64?: string
  expiraEm: Date
}

export type StatusCobrancaNoGateway =
  | "PENDENTE"
  | "PAGA"
  | "EXPIRADA"
  | "CANCELADA"

export type CobrancaConsultadaNoGateway = {
  status: StatusCobrancaNoGateway
  mercadoPagoUserId?: string
  pagaEm?: Date
}

export type CobrancaEsperadaNoGateway = {
  valor: string
  referenciaExterna: string
}

// Contrato neutro entre o dominio Servix e qualquer provedor externo. Nenhum
// controller ou service conhece SDKs de Mercado Pago, Asaas ou outro gateway.
export interface GatewayPagamento {
  readonly provedor: ProvedorPagamento

  criarCobranca(
    dados: CriarCobrancaGatewayInput
  ): Promise<CobrancaCriadaNoGateway>

  consultarCobranca(
    identificadorExterno: string,
    esperada?: CobrancaEsperadaNoGateway
  ): Promise<CobrancaConsultadaNoGateway>
}
