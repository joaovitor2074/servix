import type { Prisma } from "../generated/prisma/client.js"

import { AMBIENTE_FINANCEIRO_PREVIEW } from "../financeiro/financeiro-preview.js"

type RegistrarAuditoriaInput = {
  empresaId: number
  usuarioId: number
  acao: string
  entidade: string
  entidadeId?: number
  dadosAntes?: unknown
  dadosDepois?: unknown
}
function serializarJson(valor: unknown): Prisma.InputJsonValue {
  // Converte Date e Decimal para suas representacoes JSON estaveis e remove
  // propriedades undefined, que nao sao aceitas pelo tipo Json do Prisma.
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue
}

export function registrarAuditoriaFinanceiraTx(
  tx: Prisma.TransactionClient,
  dados: RegistrarAuditoriaInput
) {
  return tx.auditoriaFinanceira.create({
    data: {
      empresaId: dados.empresaId,
      ambiente: AMBIENTE_FINANCEIRO_PREVIEW,
      usuarioId: dados.usuarioId,
      acao: dados.acao,
      entidade: dados.entidade,
      ...(dados.entidadeId !== undefined && {
        entidadeId: dados.entidadeId
      }),
      ...(dados.dadosAntes !== undefined && {
        dadosAntes: serializarJson(dados.dadosAntes)
      }),
      ...(dados.dadosDepois !== undefined && {
        dadosDepois: serializarJson(dados.dadosDepois)
      })
    }
  })
}
