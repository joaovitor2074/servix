import { describe, expect, it } from "vitest"

import { validarDeployMigrationsFinanceiroPreview } from "./financeiro-migrations.js"

describe("trava de deploy do financeiro preview", () => {
  it("falha fechado quando o modo está ausente", () => {
    expect(() => validarDeployMigrationsFinanceiroPreview({})).toThrow(
      "SERVIX_FINANCEIRO_MODE=PREVIEW"
    )
  })

  it("recusa qualquer modo diferente de PREVIEW", () => {
    expect(() => validarDeployMigrationsFinanceiroPreview({
      SERVIX_FINANCEIRO_MODE: "PRODUCAO"
    })).toThrow("Deploy de migrations bloqueado")
  })

  it("libera somente a decisão explícita de preview", () => {
    expect(() => validarDeployMigrationsFinanceiroPreview({
      SERVIX_FINANCEIRO_MODE: " preview "
    })).not.toThrow()
  })
})
