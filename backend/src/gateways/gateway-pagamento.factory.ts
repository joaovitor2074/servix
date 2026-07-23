import {
  gatewayPagamentoSimuladoHabilitado,
  obterConfiguracaoOAuthMercadoPago,
  pagamentosClientesMercadoPagoTesteHabilitados
} from "../config/env.js"
import {
  AmbientePagamento,
  ProvedorPagamento
} from "../generated/prisma/enums.js"
import {
  obterCredencialMercadoPagoService
} from "../services/mercado-pago-oauth.service.js"
import { MercadoPagoGateway } from "./mercado-pago.gateway.js"
import { PagamentoSimuladoGateway } from "./pagamento-simulado.gateway.js"
import type { GatewayPagamento } from "./pagamentos.gateway.js"

export type ContextoGatewayPagamento = {
  empresaId: number
  ambiente: AmbientePagamento
}

export function obterGatewayPagamento(
  provedor: ProvedorPagamento,
  contexto?: ContextoGatewayPagamento
): GatewayPagamento | null {
  if (
    provedor === ProvedorPagamento.SIMULADO &&
    gatewayPagamentoSimuladoHabilitado()
  ) {
    return new PagamentoSimuladoGateway()
  }

  return null
}

// O resolvedor assincrono usa exclusivamente a conexao OAuth sandbox da
// empresa. Tokens avulsos de .env nao entram mais no fluxo de cobranca.
export async function resolverGatewayPagamento(
  provedor: ProvedorPagamento,
  contexto?: ContextoGatewayPagamento
): Promise<GatewayPagamento | null> {
  if (provedor === ProvedorPagamento.SIMULADO) {
    return obterGatewayPagamento(provedor, contexto)
  }

  if (
    provedor !== ProvedorPagamento.MERCADO_PAGO ||
    !pagamentosClientesMercadoPagoTesteHabilitados() ||
    contexto?.ambiente !== AmbientePagamento.TESTE
  ) {
    return null
  }

  const credencial = await obterCredencialMercadoPagoService(
    contexto.empresaId
  )

  if (credencial) {
    const configuracaoOAuth = obterConfiguracaoOAuthMercadoPago()
    return new MercadoPagoGateway({
      accessToken: credencial.accessToken,
      mercadoPagoUserIdEsperado: credencial.mercadoPagoUserId,
      timeoutMs: configuracaoOAuth.timeoutMs
    })
  }

  return null
}
