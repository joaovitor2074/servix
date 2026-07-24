import { Prisma } from "../generated/prisma/client.js"
import { prisma } from "./prisma.js"

// Namespace fixo dos advisory locks usados pelas operacoes de pagamento.
// A segunda chave e o empresaId, portanto empresas diferentes nao se bloqueiam.
const NAMESPACE_LOCK_PAGAMENTO = 1_397_902_416

export const OPCOES_TRANSACAO_PAGAMENTO = {
  maxWait: 5_000,
  timeout: 75_000
} as const

export async function bloquearPagamentoDaEmpresaTx(
  tx: Prisma.TransactionClient,
  empresaId: number
): Promise<void> {
  await tx.$queryRaw`
    SELECT 1 AS "bloqueado"
    FROM (
      SELECT pg_advisory_xact_lock(
        CAST(${NAMESPACE_LOCK_PAGAMENTO} AS integer),
        CAST(${empresaId} AS integer)
      )
    ) AS "lockPagamento"
  `
}

class TransacaoAbortadaComResultado extends Error {
  constructor(readonly resultado: unknown) {
    super("Transacao abortada por uma regra de concorrencia")
  }
}

// Retornar normalmente de um callback do Prisma confirma a transacao. Este
// adaptador permite devolver um conflito ao controller e, ao mesmo tempo,
// desfazer mutacoes preparatorias feitas antes de um CAS que perdeu a corrida.
export function abortarTransacaoComResultado(resultado: unknown): never {
  throw new TransacaoAbortadaComResultado(resultado)
}

export async function executarTransacaoComRollback<T>(
  executar: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  let ultimaFalha: unknown

  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    try {
      return await prisma.$transaction(executar, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      })
    } catch (error) {
      if (error instanceof TransacaoAbortadaComResultado) {
        return error.resultado as T
      }

      ultimaFalha = error
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        String(error.code) !== "P2034"
      ) {
        throw error
      }
    }
  }

  throw ultimaFalha
}
