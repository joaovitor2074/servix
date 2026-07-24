-- A aprovação pertence ao orçamento. A ordem conserva apenas etapas operacionais.
-- O tipo temporário permite migrar também ordens e históricos já existentes.
BEGIN;

CREATE TYPE "StatusOrdem_novo" AS ENUM (
    'RECEBIDO',
    'EM_ANALISE',
    'EM_EXECUCAO',
    'AGUARDANDO_PECA',
    'PRONTO',
    'ENTREGUE',
    'CANCELADO'
);

ALTER TABLE "OrdemServico" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "OrdemServico"
    ALTER COLUMN "status" TYPE "StatusOrdem_novo"
    USING (
        CASE "status"::text
            WHEN 'ABERTA' THEN 'RECEBIDO'
            WHEN 'EM_ANALISE' THEN 'EM_ANALISE'
            WHEN 'AGUARDANDO_APROVACAO' THEN 'EM_ANALISE'
            WHEN 'APROVADA' THEN 'EM_ANALISE'
            WHEN 'EM_ANDAMENTO' THEN 'EM_EXECUCAO'
            WHEN 'AGUARDANDO_PECA' THEN 'AGUARDANDO_PECA'
            WHEN 'CONCLUIDA' THEN 'PRONTO'
            WHEN 'ENTREGUE' THEN 'ENTREGUE'
            WHEN 'CANCELADA' THEN 'CANCELADO'
        END
    )::"StatusOrdem_novo";

ALTER TABLE "HistoricoStatusOrdem"
    ALTER COLUMN "status" TYPE "StatusOrdem_novo"
    USING (
        CASE "status"::text
            WHEN 'ABERTA' THEN 'RECEBIDO'
            WHEN 'EM_ANALISE' THEN 'EM_ANALISE'
            WHEN 'AGUARDANDO_APROVACAO' THEN 'EM_ANALISE'
            WHEN 'APROVADA' THEN 'EM_ANALISE'
            WHEN 'EM_ANDAMENTO' THEN 'EM_EXECUCAO'
            WHEN 'AGUARDANDO_PECA' THEN 'AGUARDANDO_PECA'
            WHEN 'CONCLUIDA' THEN 'PRONTO'
            WHEN 'ENTREGUE' THEN 'ENTREGUE'
            WHEN 'CANCELADA' THEN 'CANCELADO'
        END
    )::"StatusOrdem_novo";

DROP TYPE "StatusOrdem";
ALTER TYPE "StatusOrdem_novo" RENAME TO "StatusOrdem";

ALTER TABLE "OrdemServico"
    ALTER COLUMN "status" SET DEFAULT 'RECEBIDO',
    ADD COLUMN "versao" INTEGER NOT NULL DEFAULT 1;

-- Ordens anteriores à criação da tabela de histórico podem não possuir o
-- evento inicial. O backfill mantém essas ordens auditáveis sem inventar autor.
INSERT INTO "HistoricoStatusOrdem" (
    "ordemId",
    "empresaId",
    "status",
    "alteradoPorId",
    "criadoEm"
)
SELECT
    "ordem"."id",
    "ordem"."empresaId",
    "ordem"."status",
    NULL,
    "ordem"."criadoEm"
FROM "OrdemServico" AS "ordem"
WHERE NOT EXISTS (
    SELECT 1
    FROM "HistoricoStatusOrdem" AS "historico"
    WHERE "historico"."ordemId" = "ordem"."id"
      AND "historico"."empresaId" = "ordem"."empresaId"
);

-- Não apaga auditoria antiga. Se os dados existentes contiverem uma sequência
-- impossível, a migration inteira falha e volta ao estado anterior para que a
-- inconsistência seja analisada explicitamente.
DO $$
BEGIN
    IF EXISTS (
        WITH "sequencia" AS (
            SELECT
                "status",
                LAG("status") OVER (
                    PARTITION BY "ordemId"
                    ORDER BY "criadoEm", "id"
                ) AS "anterior"
            FROM "HistoricoStatusOrdem"
        )
        SELECT 1
        FROM "sequencia"
        WHERE "anterior" IS NOT NULL
          AND "anterior" <> "status"
          AND NOT (
              ("anterior" = 'RECEBIDO' AND "status" IN ('EM_ANALISE', 'CANCELADO')) OR
              ("anterior" = 'EM_ANALISE' AND "status" IN ('EM_EXECUCAO', 'CANCELADO')) OR
              ("anterior" = 'EM_EXECUCAO' AND "status" IN ('AGUARDANDO_PECA', 'PRONTO', 'CANCELADO')) OR
              ("anterior" = 'AGUARDANDO_PECA' AND "status" IN ('EM_EXECUCAO', 'CANCELADO')) OR
              ("anterior" = 'PRONTO' AND "status" IN ('ENTREGUE', 'EM_EXECUCAO', 'CANCELADO'))
          )
    ) THEN
        RAISE EXCEPTION 'Histórico de ordem contém transição inválida; revise os dados antes de migrar';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        WITH "ultimoStatus" AS (
            SELECT DISTINCT ON ("ordemId", "empresaId")
                "ordemId",
                "empresaId",
                "status"
            FROM "HistoricoStatusOrdem"
            ORDER BY "ordemId", "empresaId", "criadoEm" DESC, "id" DESC
        )
        SELECT 1
        FROM "OrdemServico" AS "ordem"
        JOIN "ultimoStatus" AS "ultimo"
          ON "ultimo"."ordemId" = "ordem"."id"
         AND "ultimo"."empresaId" = "ordem"."empresaId"
        WHERE "ultimo"."status" <> "ordem"."status"
    ) THEN
        RAISE EXCEPTION 'Status atual da ordem diverge do último histórico; revise os dados antes de migrar';
    END IF;
END $$;

ALTER TABLE "HistoricoStatusOrdem"
    ADD COLUMN "statusAnterior" "StatusOrdem";

WITH "historicoOrdenado" AS (
    SELECT
        "id",
        LAG("status") OVER (
            PARTITION BY "ordemId"
            ORDER BY "criadoEm", "id"
        ) AS "statusAnterior"
    FROM "HistoricoStatusOrdem"
)
UPDATE "HistoricoStatusOrdem" AS "historico"
SET "statusAnterior" = "ordenado"."statusAnterior"
FROM "historicoOrdenado" AS "ordenado"
WHERE "historico"."id" = "ordenado"."id";

COMMIT;
