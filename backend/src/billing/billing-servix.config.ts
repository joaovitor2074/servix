import { env } from "../config/env.js"

export type ModoBillingServix = "TESTE" | "PRODUCAO" | "BLOQUEADO"

// O billing da plataforma usa um namespace de ambiente proprio. Nao existe
// fallback para MERCADO_PAGO_CLIENT_* ou para tokens OAuth das empresas.
export function obterModoBillingServix(): ModoBillingServix {
  const configurado = process.env.SERVIX_BILLING_MODE?.trim().toUpperCase()

  if (configurado === "TESTE" || configurado === "PRODUCAO") {
    return configurado
  }

  // Desenvolvimento local continua simples. Em uma hospedagem com NODE_ENV de
  // producao, a variavel precisa ser declarada explicitamente para evitar que
  // um checkout de teste seja ativado por engano.
  if (!configurado && env.nodeEnv !== "production") return "TESTE"

  return "BLOQUEADO"
}
