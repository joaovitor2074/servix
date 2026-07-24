import type { ZodType } from "zod"

// União discriminada: quando `valido` é true, TypeScript sabe que `dados`
// existe; quando é false, disponibiliza mensagem e detalhes dos campos.
export type ResultadoValidacao<T> =
  | { valido: true; dados: T }
  | {
      valido: false
      erro: string
      detalhes: Array<{ campo: string; mensagem: string }>
    }

// Adaptador comum para todos os schemas. Ele evita repetir safeParse e a
// conversão dos erros do Zod em um formato estável para a API.
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

  // Converte caminhos como `["administrador", "email"]` em
  // `administrador.email`, formato mais simples para o frontend.
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
