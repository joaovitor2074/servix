import type { ZodType } from "zod"

export type ResultadoValidacao<T> =
  | { valido: true; dados: T }
  | {
      valido: false
      erro: string
      detalhes: Array<{ campo: string; mensagem: string }>
    }

export function validarComSchema<T>(
  schema: ZodType<T>,
  dados: unknown
): ResultadoValidacao<T> {
  const resultado = schema.safeParse(dados)

  if (resultado.success) {
    return {
      valido: true,
      dados: resultado.data
    }
  }

  const detalhes = resultado.error.issues.map(issue => ({
    campo: issue.path.map(String).join(".") || "corpo",
    mensagem: issue.message
  }))

  return {
    valido: false,
    erro: "Dados inválidos",
    detalhes
  }
}
