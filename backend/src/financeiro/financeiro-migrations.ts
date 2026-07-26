export function validarDeployMigrationsFinanceiroPreview(
  ambiente: NodeJS.ProcessEnv = process.env
): void {
  const modo = ambiente.SERVIX_FINANCEIRO_MODE?.trim().toUpperCase()

  if (modo !== "PREVIEW") {
    throw new Error(
      "Deploy de migrations bloqueado: SERVIX_FINANCEIRO_MODE=PREVIEW é obrigatório enquanto a migration do financeiro preview fizer parte do artefato."
    )
  }
}
