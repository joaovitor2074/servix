import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

import { validarDeployMigrationsFinanceiroPreview } from "../financeiro/financeiro-migrations.js"

try {
  validarDeployMigrationsFinanceiroPreview()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
  process.exit()
}

// Executa o binário local sem shell, preservando sinais e o código de saída.
const prismaCli = fileURLToPath(
  new URL("../../node_modules/prisma/build/index.js", import.meta.url)
)
const filho = spawn(process.execPath, [prismaCli, "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env
})
filho.once("error", error => {
  console.error("Não foi possível iniciar o Prisma Migrate:", error)
  process.exitCode = 1
})

filho.once("exit", (codigo, sinal) => {
  if (sinal) {
    console.error(`Prisma Migrate encerrado pelo sinal ${sinal}`)
    process.exitCode = 1
    return
  }

  process.exitCode = codigo ?? 1
})
