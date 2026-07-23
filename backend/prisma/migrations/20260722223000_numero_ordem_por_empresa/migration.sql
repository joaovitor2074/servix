BEGIN;

-- A migration anterior precisava preencher ordens legadas antes do NOT NULL.
-- Estes tokens identificáveis são rotacionados para UUIDs gerados pela fonte
-- criptográfica do PostgreSQL antes que os links sejam disponibilizados.
UPDATE "OrdemServico"
SET "tokenAcompanhamento" = GEN_RANDOM_UUID()::TEXT
WHERE "tokenAcompanhamento" LIKE 'acomp-%';

-- A numeração apresentada ao cliente pertence a cada empresa. Ela não usa o
-- id global da tabela e, portanto, não revela o volume de outras empresas.
ALTER TABLE "Empresa"
    ADD COLUMN "proximoNumeroOrdem" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "OrdemServico"
    ADD COLUMN "numero" INTEGER;

WITH "ordensNumeradas" AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "empresaId"
            ORDER BY "criadoEm", "id"
        )::INTEGER AS "numero"
    FROM "OrdemServico"
)
UPDATE "OrdemServico" AS "ordem"
SET "numero" = "numerada"."numero"
FROM "ordensNumeradas" AS "numerada"
WHERE "ordem"."id" = "numerada"."id";

ALTER TABLE "OrdemServico"
    ALTER COLUMN "numero" SET NOT NULL;

CREATE UNIQUE INDEX "OrdemServico_empresaId_numero_key"
    ON "OrdemServico"("empresaId", "numero");

UPDATE "Empresa" AS "empresa"
SET "proximoNumeroOrdem" = COALESCE(
    (
        SELECT MAX("ordem"."numero") + 1
        FROM "OrdemServico" AS "ordem"
        WHERE "ordem"."empresaId" = "empresa"."id"
    ),
    1
);

COMMIT;
