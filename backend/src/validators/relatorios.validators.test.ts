import { describe, expect, it } from "vitest"
import { validarQueryRelatorioOperacional } from "./relatorios.validators.js"

describe("validador de relatório operacional", () => {
  it("aceita um período de até um ano", () => {
    expect(validarQueryRelatorioOperacional({ inicio: "2026-07-01", fim: "2026-07-31" }).valido).toBe(true)
  })

  it("rejeita período invertido", () => {
    expect(validarQueryRelatorioOperacional({ inicio: "2026-08-01", fim: "2026-07-01" }).valido).toBe(false)
  })

  it("rejeita consultas maiores que 366 dias", () => {
    expect(validarQueryRelatorioOperacional({ inicio: "2024-01-01", fim: "2026-01-01" }).valido).toBe(false)
  })
})
