BEGIN;

-- O token nasce nulo para que ordens existentes recebam um valor imprevisivel
-- antes da restricao NOT NULL. A composicao abaixo nao depende de extensoes do
-- PostgreSQL e inclui dados distintos de cada linha no material aleatorio.
ALTER TABLE "OrdemServico"
    ADD COLUMN "tokenAcompanhamento" TEXT;

UPDATE "OrdemServico"
SET "tokenAcompanhamento" =
    'acomp-' ||
    MD5(
        RANDOM()::text || ':' ||
        CLOCK_TIMESTAMP()::text || ':' ||
        "empresaId"::text || ':' ||
        "id"::text || ':' ||
        "criadoEm"::text
    ) ||
    MD5(
        RANDOM()::text || ':' ||
        CLOCK_TIMESTAMP()::text || ':' ||
        "id"::text
    );

ALTER TABLE "OrdemServico"
    ALTER COLUMN "tokenAcompanhamento" SET NOT NULL;

CREATE UNIQUE INDEX "OrdemServico_tokenAcompanhamento_key"
    ON "OrdemServico"("tokenAcompanhamento");

-- Somente este texto, escrito especificamente para o cliente, podera aparecer
-- na linha do tempo publica. Observacoes tecnicas e o autor continuam internos.
ALTER TABLE "HistoricoStatusOrdem"
    ADD COLUMN "mensagemPublica" TEXT;

COMMIT;
