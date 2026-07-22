BEGIN;

CREATE TYPE "StatusOrcamento" AS ENUM (
    'RASCUNHO',
    'ENVIADO',
    'APROVADO',
    'REJEITADO',
    'EXPIRADO',
    'CONVERTIDO',
    'CANCELADO'
);

CREATE TYPE "TipoItemOrcamento" AS ENUM ('SERVICO', 'PECA', 'MATERIAL');
CREATE TYPE "StatusRegistroPagamento" AS ENUM ('CONFIRMADO', 'ESTORNADO');
CREATE TYPE "OrigemPagamento" AS ENUM ('MANUAL', 'MIGRACAO');

ALTER TABLE "Empresa"
    ADD COLUMN "proximoNumeroOrcamento" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "OrdemServico"
    ALTER COLUMN "valor" TYPE DECIMAL(12,2);

CREATE TABLE "Orcamento" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "equipamento" TEXT NOT NULL,
    "descricaoProblema" TEXT NOT NULL,
    "status" "StatusOrcamento" NOT NULL DEFAULT 'RASCUNHO',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "validade" TIMESTAMP(3),
    "observacoes" TEXT,
    "tokenPublico" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "enviadoEm" TIMESTAMP(3),
    "aprovadoEm" TIMESTAMP(3),
    "convertidoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ordemLegadaId" INTEGER,

    CONSTRAINT "Orcamento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Orcamento_valores_check" CHECK (
        "subtotal" >= 0 AND
        "desconto" >= 0 AND
        "desconto" <= "subtotal" AND
        "total" = "subtotal" - "desconto"
    )
);

CREATE TABLE "ItemOrcamento" (
    "id" SERIAL NOT NULL,
    "orcamentoId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "valorUnitario" DECIMAL(12,2) NOT NULL,
    "valorTotal" DECIMAL(12,2) NOT NULL,

    "tipo" "TipoItemOrcamento" NOT NULL,
    CONSTRAINT "ItemOrcamento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ItemOrcamento_valores_check" CHECK (
        "quantidade" > 0 AND
        "valorUnitario" >= 0 AND
        "valorTotal" = "quantidade" * "valorUnitario"
    )
);

CREATE TABLE "HistoricoStatusOrcamento" (
    "id" SERIAL NOT NULL,
    "orcamentoId" INTEGER NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "statusAnterior" "StatusOrcamento",
    "status" "StatusOrcamento" NOT NULL,
    "versaoResultante" INTEGER NOT NULL,
    "observacao" TEXT,
    "alteradoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoStatusOrcamento_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Pagamento" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "ordemId" INTEGER NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL,
    "status" "StatusRegistroPagamento" NOT NULL DEFAULT 'CONFIRMADO',
    "origem" "OrigemPagamento" NOT NULL DEFAULT 'MANUAL',
    "observacao" TEXT,
    "pagoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registradoPorId" INTEGER,
    "estornadoEm" TIMESTAMP(3),
    "estornadoPorId" INTEGER,
    "motivoEstorno" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Pagamento_valor_check" CHECK ("valor" > 0),
    CONSTRAINT "Pagamento_estorno_check" CHECK (
        (
            "status" = 'CONFIRMADO' AND
            "estornadoEm" IS NULL AND
            "estornadoPorId" IS NULL AND
            "motivoEstorno" IS NULL
        ) OR (
            "status" = 'ESTORNADO' AND
            "estornadoEm" IS NOT NULL AND
            "estornadoPorId" IS NOT NULL AND
            NULLIF(BTRIM("motivoEstorno"), '') IS NOT NULL
        )
    )
);

CREATE UNIQUE INDEX "Orcamento_id_empresaId_key"
    ON "Orcamento"("id", "empresaId");
CREATE UNIQUE INDEX "Orcamento_empresaId_numero_key"
    ON "Orcamento"("empresaId", "numero");
CREATE UNIQUE INDEX "Orcamento_tokenPublico_key"
    ON "Orcamento"("tokenPublico");
CREATE INDEX "Orcamento_empresaId_status_criadoEm_idx"
    ON "Orcamento"("empresaId", "status", "criadoEm");
CREATE INDEX "Orcamento_empresaId_clienteId_idx"
    ON "Orcamento"("empresaId", "clienteId");
CREATE INDEX "ItemOrcamento_orcamentoId_idx"
    ON "ItemOrcamento"("orcamentoId");
CREATE INDEX "HistoricoStatusOrcamento_empresaId_orcamentoId_criadoEm_idx"
    ON "HistoricoStatusOrcamento"("empresaId", "orcamentoId", "criadoEm");
CREATE INDEX "HistoricoStatusOrcamento_alteradoPorId_idx"
    ON "HistoricoStatusOrcamento"("alteradoPorId");
CREATE UNIQUE INDEX "HistoricoStatusOrcamento_orcamentoId_versaoResultante_key"
    ON "HistoricoStatusOrcamento"("orcamentoId", "versaoResultante");
CREATE UNIQUE INDEX "Pagamento_id_empresaId_key"
    ON "Pagamento"("id", "empresaId");
CREATE INDEX "Pagamento_empresaId_ordemId_pagoEm_idx"
    ON "Pagamento"("empresaId", "ordemId", "pagoEm");
CREATE INDEX "Pagamento_registradoPorId_idx"
    ON "Pagamento"("registradoPorId");
CREATE INDEX "Pagamento_estornadoPorId_idx"
    ON "Pagamento"("estornadoPorId");

ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Orcamento" ADD CONSTRAINT "Orcamento_clienteId_empresaId_fkey"
    FOREIGN KEY ("clienteId", "empresaId") REFERENCES "Cliente"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemOrcamento" ADD CONSTRAINT "ItemOrcamento_orcamentoId_fkey"
    FOREIGN KEY ("orcamentoId") REFERENCES "Orcamento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HistoricoStatusOrcamento" ADD CONSTRAINT "HistoricoStatusOrcamento_orcamentoId_empresaId_fkey"
    FOREIGN KEY ("orcamentoId", "empresaId") REFERENCES "Orcamento"("id", "empresaId")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HistoricoStatusOrcamento" ADD CONSTRAINT "HistoricoStatusOrcamento_alteradoPorId_fkey"
    FOREIGN KEY ("alteradoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Cada OS existente recebe um orçamento legado convertido. O número é sequencial
-- por empresa e o token continua imprevisível sem depender de extensões do PG.
INSERT INTO "Orcamento" (
    "empresaId",
    "clienteId",
    "numero",
    "equipamento",
    "descricaoProblema",
    "status",
    "subtotal",
    "desconto",
    "total",
    "observacoes",
    "tokenPublico",
    "versao",
    "aprovadoEm",
    "convertidoEm",
    "criadoEm",
    "atualizadoEm",
    "ordemLegadaId"
)
SELECT
    "ordem"."empresaId",
    "ordem"."clienteId",
    ROW_NUMBER() OVER (
        PARTITION BY "ordem"."empresaId"
        ORDER BY "ordem"."criadoEm", "ordem"."id"
    )::INTEGER,
    "ordem"."equipamento",
    "ordem"."problemaRelatado",
    'CONVERTIDO',
    "ordem"."valor",
    0,
    "ordem"."valor",
    'Orçamento legado criado automaticamente para preservar a OS existente.',
    'legado-' || MD5(
        RANDOM()::text || ':' ||
        CLOCK_TIMESTAMP()::text || ':' ||
        "ordem"."empresaId"::text || ':' ||
        "ordem"."id"::text || ':' ||
        "ordem"."criadoEm"::text
    ),
    1,
    "ordem"."criadoEm",
    "ordem"."criadoEm",
    "ordem"."criadoEm",
    "ordem"."atualizadoEm",
    "ordem"."id"
FROM "OrdemServico" AS "ordem";

INSERT INTO "ItemOrcamento" (
    "orcamentoId",
    "descricao",
    "quantidade",
    "valorUnitario",
    "valorTotal",
    "tipo"
)
SELECT
    "orcamento"."id",
    COALESCE(
        NULLIF(BTRIM("ordem"."servicoRealizado"), ''),
        "ordem"."problemaRelatado"
    ),
    1,
    "ordem"."valor",
    "ordem"."valor",
    'SERVICO'
FROM "Orcamento" AS "orcamento"
JOIN "OrdemServico" AS "ordem"
  ON "ordem"."id" = "orcamento"."ordemLegadaId";

INSERT INTO "HistoricoStatusOrcamento" (
    "orcamentoId",
    "empresaId",
    "statusAnterior",
    "status",
    "versaoResultante",
    "observacao",
    "alteradoPorId",
    "criadoEm"
)
SELECT
    "id",
    "empresaId",
    NULL,
    'CONVERTIDO',
    1,
    'Orçamento legado vinculado automaticamente à ordem existente.',
    NULL,
    "criadoEm"
FROM "Orcamento";

ALTER TABLE "OrdemServico" ADD COLUMN "orcamentoId" INTEGER;

UPDATE "OrdemServico" AS "ordem"
SET "orcamentoId" = "orcamento"."id"
FROM "Orcamento" AS "orcamento"
WHERE "orcamento"."ordemLegadaId" = "ordem"."id";

ALTER TABLE "OrdemServico" ALTER COLUMN "orcamentoId" SET NOT NULL;
CREATE UNIQUE INDEX "OrdemServico_orcamentoId_empresaId_key"
    ON "OrdemServico"("orcamentoId", "empresaId");
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_orcamentoId_empresaId_fkey"
    FOREIGN KEY ("orcamentoId", "empresaId") REFERENCES "Orcamento"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_ordemId_empresaId_fkey"
    FOREIGN KEY ("ordemId", "empresaId") REFERENCES "OrdemServico"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_registradoPorId_fkey"
    FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_estornadoPorId_fkey"
    FOREIGN KEY ("estornadoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Ordens legadas já entregues recebem um pagamento migrado. Assim a nova regra
-- não transforma dados válidos do passado em ordens financeiramente pendentes.
INSERT INTO "Pagamento" (
    "empresaId",
    "ordemId",
    "valor",
    "formaPagamento",
    "status",
    "origem",
    "observacao",
    "pagoEm",
    "registradoPorId",
    "criadoEm"
)
SELECT
    "empresaId",
    "id",
    "valor",
    "formaDePagamento",
    'CONFIRMADO',
    'MIGRACAO',
    'Pagamento legado criado para uma ordem que já estava entregue.',
    "atualizadoEm",
    NULL,
    "atualizadoEm"
FROM "OrdemServico"
WHERE "status" = 'ENTREGUE'
  AND "valor" > 0;

UPDATE "Empresa" AS "empresa"
SET "proximoNumeroOrcamento" = COALESCE((
    SELECT MAX("orcamento"."numero") + 1
    FROM "Orcamento" AS "orcamento"
    WHERE "orcamento"."empresaId" = "empresa"."id"
), 1);

ALTER TABLE "Orcamento" DROP COLUMN "ordemLegadaId";

COMMIT;
