import {
  StatusOrcamento,
  type StatusOrcamento as StatusOrcamentoType
} from "../generated/prisma/enums.js"

// A conversao e intencionalmente excluida desta tabela: APROVADO -> CONVERTIDO
// so pode acontecer junto da criacao da ordem de servico.
const transicoesPublicas: Record<
  StatusOrcamentoType,
  readonly StatusOrcamentoType[]
> = {
  [StatusOrcamento.RASCUNHO]: [
    StatusOrcamento.ENVIADO,
    StatusOrcamento.CANCELADO
  ],
  [StatusOrcamento.ENVIADO]: [
    StatusOrcamento.APROVADO,
    StatusOrcamento.REJEITADO,
    StatusOrcamento.EXPIRADO,
    StatusOrcamento.CANCELADO
  ],
  [StatusOrcamento.REJEITADO]: [
    StatusOrcamento.RASCUNHO,
    StatusOrcamento.CANCELADO
  ],
  [StatusOrcamento.EXPIRADO]: [
    StatusOrcamento.RASCUNHO,
    StatusOrcamento.CANCELADO
  ],
  [StatusOrcamento.APROVADO]: [StatusOrcamento.CANCELADO],
  [StatusOrcamento.CONVERTIDO]: [],
  [StatusOrcamento.CANCELADO]: []
}

export function listarStatusOrcamentoPermitidos(
  statusAtual: StatusOrcamentoType
): StatusOrcamentoType[] {
  return [...transicoesPublicas[statusAtual]]
}

// Repetir o status atual e um no-op idempotente, como no fluxo das ordens.
export function transicaoStatusOrcamentoEhPermitida(
  statusAtual: StatusOrcamentoType,
  proximoStatus: StatusOrcamentoType
): boolean {
  return (
    statusAtual === proximoStatus ||
    transicoesPublicas[statusAtual].includes(proximoStatus)
  )
}

export function orcamentoPodeSerConvertido(
  statusAtual: StatusOrcamentoType
): boolean {
  return statusAtual === StatusOrcamento.APROVADO
}
