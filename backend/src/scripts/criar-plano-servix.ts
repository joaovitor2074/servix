import {
  obterConfiguracaoAssinaturasMercadoPago
} from "../config/env.js"
import {
  criarPlanoAssinaturaMercadoPago,
  ErroMercadoPagoAssinaturas
} from "../integrations/mercado-pago-assinaturas.client.js"

async function main(): Promise<void> {
  const configuracao = obterConfiguracaoAssinaturasMercadoPago()

  if (configuracao.status !== "CONFIGURADA") {
    throw new Error(configuracao.motivo)
  }

  if (configuracao.planId) {
    console.log("O plano de assinatura já está configurado.")
    console.log(
      `MERCADO_PAGO_SUBSCRIPTIONS_${configuracao.modo}_PLAN_ID="${configuracao.planId}"`
    )
    return
  }

  console.log("Criando plano mensal do Servix no Mercado Pago...")

  const plano = await criarPlanoAssinaturaMercadoPago({
    reason: "Servix - Plano mensal",
    transactionAmount: 79.9,
    currencyId: "BRL"
  })

  console.log("")
  console.log("Plano criado com sucesso.")
  console.log(`ID: ${plano.id}`)
  console.log(`Status: ${plano.status ?? "não informado"}`)

  if (plano.init_point) {
    console.log(`Checkout: ${plano.init_point}`)
  }

  console.log("")
  console.log("Adicione esta variável ao seu arquivo .env:")
  console.log("")
  console.log(
    `MERCADO_PAGO_SUBSCRIPTIONS_${configuracao.modo}_PLAN_ID="${plano.id}"`
  )
  console.log("")
  console.log(
    "Depois de salvar o ID, reinicie o backend."
  )
}

main().catch(error => {
  if (error instanceof ErroMercadoPagoAssinaturas) {
    console.error("")
    console.error("Falha ao criar o plano no Mercado Pago.")
    console.error(`Mensagem: ${error.message}`)

    if (error.statusHttp !== undefined) {
      console.error(`Status HTTP: ${error.statusHttp}`)
    }

    if (error.codigo !== undefined) {
      console.error(`Código: ${error.codigo}`)
    }
  } else if (error instanceof Error) {
    console.error("")
    console.error(`Erro: ${error.message}`)
  } else {
    console.error("")
    console.error("Ocorreu um erro inesperado.")
  }

  process.exitCode = 1
})
