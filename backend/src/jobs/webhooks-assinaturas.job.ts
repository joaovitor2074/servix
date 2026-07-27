import { processarWebhooksAssinaturaPendentesService } from "../services/webhooks-assinaturas.service.js"

const INTERVALO_MS = 60_000

export function iniciarProcessadorWebhooksAssinaturas() {
  let executando = false

  const executar = async () => {
    if (executando) return
    executando = true
    try {
      await processarWebhooksAssinaturaPendentesService()
    } catch (error) {
      console.error("Falha no processador de webhooks de assinatura:", {
        erro: error instanceof Error ? error.message : "erro desconhecido"
      })
    } finally {
      executando = false
    }
  }

  const timer = setInterval(() => void executar(), INTERVALO_MS)
  timer.unref()
  void executar()

  return () => clearInterval(timer)
}
