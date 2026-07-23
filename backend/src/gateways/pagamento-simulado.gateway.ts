import { createHash } from "node:crypto"

import { ProvedorPagamento } from "../generated/prisma/enums.js"
import type {
  CobrancaConsultadaNoGateway,
  CobrancaCriadaNoGateway,
  CriarCobrancaGatewayInput,
  GatewayPagamento
} from "./pagamentos.gateway.js"

const DURACAO_PADRAO_MS = 30 * 60 * 1000

// O simulador nunca conversa com bancos nem cria um Pix valido. O mesmo par
// empresa/chave sempre produz o mesmo identificador para facilitar testes de
// idempotencia e desenvolvimento local.
export class PagamentoSimuladoGateway implements GatewayPagamento {
  readonly provedor = ProvedorPagamento.SIMULADO

  async criarCobranca(
    dados: CriarCobrancaGatewayInput
  ): Promise<CobrancaCriadaNoGateway> {
    const hash = createHash("sha256")
      .update(`${dados.empresaId}:${dados.chaveIdempotencia}`)
      .digest("hex")
      .slice(0, 24)
    const identificadorExterno = `sim_${hash}`

    return {
      identificadorExterno,
      // Prefixo propositalmente nao bancario: este texto nao pode ser pago.
      codigoPix: `PIX_SIMULADO|${identificadorExterno}|${dados.valor}`,
      expiraEm: dados.expiraEm ?? new Date(Date.now() + DURACAO_PADRAO_MS)
    }
  }

  async consultarCobranca(): Promise<CobrancaConsultadaNoGateway> {
    return { status: "PENDENTE" }
  }
}
