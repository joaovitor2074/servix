BEGIN;

ALTER TABLE "Cobranca"
    ADD COLUMN "mercadoPagoUserId" TEXT,
    ADD COLUMN "finalizadaNoGatewayEm" TIMESTAMP(3),
    ADD COLUMN "sincronizarApos" TIMESTAMP(3);

UPDATE "Cobranca" AS cobranca
SET "mercadoPagoUserId" = integracao."mercadoPagoUserId"
FROM "IntegracaoPagamento" AS integracao
WHERE cobranca."empresaId" = integracao."empresaId"
  AND cobranca."provedor" = 'MERCADO_PAGO'
  AND integracao."provedor" = 'MERCADO_PAGO'
  AND cobranca."mercadoPagoUserId" IS NULL;

UPDATE "Cobranca"
SET "finalizadaNoGatewayEm" = COALESCE(
    "pagaEm",
    "estornadaEm",
    "atualizadoEm"
)
WHERE "provedor" = 'MERCADO_PAGO'
  AND "status" IN ('PAGA', 'ESTORNADA')
  AND "finalizadaNoGatewayEm" IS NULL;

-- Reservas locais criadas antes de uma resposta do gateway nao podem ficar
-- pendentes para sempre. Trinta minutos e tambem o minimo aceito pelo Pix.
UPDATE "Cobranca"
SET "expiraEm" = "criadoEm" + INTERVAL '30 minutes'
WHERE "status" = 'PENDENTE'
  AND "expiraEm" IS NULL;

CREATE INDEX "Cobranca_provedor_status_sincronizarApos_idx"
    ON "Cobranca"("provedor", "status", "sincronizarApos");
CREATE INDEX "Cobranca_empresaId_provedor_mercadoPagoUserId_status_idx"
    ON "Cobranca"("empresaId", "provedor", "mercadoPagoUserId", "status");

COMMIT;
