import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const migration = readFileSync(
  new URL(
    "../../prisma/migrations/20260724183000_financeiro_preview/migration.sql",
    import.meta.url
  ),
  "utf8"
)

describe("contrato estatico da migration do financeiro preview", () => {
  it("aceita movimentacoes novas somente como confirmadas", () => {
    expect(migration).toContain("MovimentacaoFinanceira deve nascer CONFIRMADA")
    expect(migration).toMatch(
      /CREATE TRIGGER "MovimentacaoFinanceira_validar_data_insert"\s+BEFORE INSERT/
    )
  })

  it("impede que um estorno seja anterior a criacao da movimentacao", () => {
    expect(migration).toMatch(/"estornadoEm"\s*>=\s*"criadoEm"/)
    expect(migration).toMatch(
      /NEW\."estornadoEm"\s*<\s*OLD\."criadoEm"/
    )
  })

  it("valida estados finais de lancamentos e pares de transferencia no commit", () => {
    expect(migration).toMatch(
      /CREATE CONSTRAINT TRIGGER "LancamentoFinanceiro_estado_final"[\s\S]*?DEFERRABLE INITIALLY DEFERRED/
    )
    expect(migration).toMatch(
      /CREATE CONSTRAINT TRIGGER "MovimentacaoFinanceira_transferencia_par_final"[\s\S]*?DEFERRABLE INITIALLY DEFERRED/
    )
    expect(migration).toContain(
      "Transferencia exige par equivalente em contas distintas"
    )
  })

  it("torna conclusao idempotente terminal e preserva tenant e ambiente", () => {
    expect(migration).toContain("IdempotenciaFinanceira concluida e terminal")
    expect(migration).toMatch(
      /CREATE TRIGGER "IdempotenciaFinanceira_ciclo_terminal"\s+BEFORE INSERT OR UPDATE OR DELETE/
    )
    expect(migration).toContain(
      "Identidade, empresa e ambiente financeiros sao imutaveis"
    )
  })

  it("usa NO ACTION e nunca CASCADE nas atualizacoes de FKs financeiras", () => {
    expect(migration).not.toContain("ON UPDATE CASCADE")
    expect(
      migration.match(/ON DELETE RESTRICT ON UPDATE NO ACTION;/g)?.length
    ).toBe(18)
  })
})
