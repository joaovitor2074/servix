export function identidadeLegalProducaoConfirmada(): boolean {
  return (
    process.env.SERVIX_LEGAL_IDENTITY_READY
      ?.trim()
      .toLowerCase() === "true"
  )
}
