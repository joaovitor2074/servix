import { describe, expect, it, vi } from "vitest"
import { criarGarantiaDaEntregaTx, DIAS_GARANTIA_PADRAO, TERMOS_GARANTIA_PADRAO } from "./garantias.service.js"

describe("criação automática de garantia", () => {
  it("cria uma garantia idempotente de 90 dias para a ordem entregue", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: 7 })
    const inicioEm = new Date("2026-07-31T12:00:00.000Z")
    await criarGarantiaDaEntregaTx(
      { garantiaServico: { upsert } } as never,
      { ordemId: 12, empresaId: 3, usuarioId: 9, inicioEm }
    )

    const chamada = upsert.mock.calls[0]?.[0]
    expect(chamada.where.ordemId_empresaId).toEqual({ ordemId: 12, empresaId: 3 })
    expect(chamada.create.dias).toBe(DIAS_GARANTIA_PADRAO)
    expect(chamada.create.termos).toBe(TERMOS_GARANTIA_PADRAO)
    expect(chamada.create.expiraEm.toISOString()).toBe("2026-10-29T12:00:00.000Z")
  })
})
