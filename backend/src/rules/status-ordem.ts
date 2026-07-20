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
  [StatusOrdem.ABERTA]: [
    StatusOrdem.EM_ANALISE,
    StatusOrdem.CANCELADA
  ],
  [StatusOrdem.EM_ANALISE]: [
    StatusOrdem.AGUARDANDO_APROVACAO,
    StatusOrdem.EM_ANDAMENTO,
    StatusOrdem.CANCELADA
  ],
  [StatusOrdem.AGUARDANDO_APROVACAO]: [
    StatusOrdem.APROVADA,
    StatusOrdem.EM_ANALISE,
    StatusOrdem.CANCELADA
  ],
  [StatusOrdem.APROVADA]: [
    StatusOrdem.EM_ANDAMENTO,
    StatusOrdem.CANCELADA
  ],
  [StatusOrdem.EM_ANDAMENTO]: [
    StatusOrdem.AGUARDANDO_PECA,
    StatusOrdem.CONCLUIDA,
    StatusOrdem.CANCELADA
  ],
  [StatusOrdem.AGUARDANDO_PECA]: [
    StatusOrdem.EM_ANDAMENTO,
    StatusOrdem.CANCELADA
  ],
  [StatusOrdem.CONCLUIDA]: [
    StatusOrdem.ENTREGUE,
    StatusOrdem.EM_ANDAMENTO,
    StatusOrdem.CANCELADA
  ],
  [StatusOrdem.ENTREGUE]: [],
  [StatusOrdem.CANCELADA]: []
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
