import {
  StatusOrdem,
  type StatusOrdem as StatusOrdemType
} from "../generated/prisma/enums.js"

// Máquina de estados da ordem de serviço. Cada chave representa o status atual
// e sua lista contém apenas os próximos estados aceitos pela regra de negócio.
const transicoesPermitidas: Record<
  StatusOrdemType,
  readonly StatusOrdemType[]
> = {
  [StatusOrdem.RECEBIDO]: [
    StatusOrdem.EM_ANALISE,
    StatusOrdem.CANCELADO
  ],
  [StatusOrdem.EM_ANALISE]: [
    StatusOrdem.EM_EXECUCAO,
    StatusOrdem.CANCELADO
  ],
  [StatusOrdem.EM_EXECUCAO]: [
    StatusOrdem.AGUARDANDO_PECA,
    StatusOrdem.PRONTO,
    StatusOrdem.CANCELADO
  ],
  [StatusOrdem.AGUARDANDO_PECA]: [
    StatusOrdem.EM_EXECUCAO,
    StatusOrdem.CANCELADO
  ],
  [StatusOrdem.PRONTO]: [
    StatusOrdem.ENTREGUE,
    StatusOrdem.EM_EXECUCAO,
    StatusOrdem.CANCELADO
  ],
  [StatusOrdem.ENTREGUE]: [],
  [StatusOrdem.CANCELADO]: []
}

// Retorna uma cópia para impedir que outro módulo modifique a tabela original.
export function listarStatusPermitidos(
  statusAtual: StatusOrdemType
): StatusOrdemType[] {
  return [...transicoesPermitidas[statusAtual]]
}

// Repetir o status atual também é permitido para tornar a operação idempotente.
export function transicaoStatusEhPermitida(
  statusAtual: StatusOrdemType,
  proximoStatus: StatusOrdemType
): boolean {
  return (
    statusAtual === proximoStatus ||
    transicoesPermitidas[statusAtual].includes(proximoStatus)
  )
}
