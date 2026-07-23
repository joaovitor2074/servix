BEGIN;

ALTER TYPE "OrigemPagamento" ADD VALUE IF NOT EXISTS 'GATEWAY';

CREATE TYPE "ProvedorPagamento" AS ENUM (
    'MANUAL',
    'SIMULADO',
    'MERCADO_PAGO',
    'ASAAS'
);

CREATE TYPE "AmbientePagamento" AS ENUM ('TESTE', 'PRODUCAO');

CREATE TYPE "StatusConfiguracaoPagamento" AS ENUM (
    'NAO_CONFIGURADA',
    'ATIVA',
    'INATIVA',
    'ERRO'
);

CREATE TYPE "StatusCobranca" AS ENUM (
    'PENDENTE',
    'PAGA',
    'EXPIRADA',
    'CANCELADA',
    'ESTORNADA'
);

CREATE TABLE "ConfiguracaoPagamento" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "provedor" "ProvedorPagamento" NOT NULL DEFAULT 'MANUAL',
    "status" "StatusConfiguracaoPagamento" NOT NULL DEFAULT 'ATIVA',
    "ambiente" "AmbientePagamento" NOT NULL DEFAULT 'TESTE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "pixHabilitado" BOOLEAN NOT NULL DEFAULT false,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoPagamento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ConfiguracaoPagamento_estado_check" CHECK (
        ("ativo" = true AND "status" = 'ATIVA') OR
        ("ativo" = false AND "status" IN ('NAO_CONFIGURADA', 'INATIVA', 'ERRO'))
    )
);

-- Toda empresa existente recebe configuracao manual. Novas empresas criam a
-- mesma linha de forma aninhada no service de cadastro.
INSERT INTO "ConfiguracaoPagamento" (
    "empresaId",
    "provedor",
    "status",
    "ambiente",
    "ativo",
    "pixHabilitado",
    "criadoEm",
    "atualizadoEm"
)
SELECT
    "id",
    'MANUAL',
    'ATIVA',
    'TESTE',
    true,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Empresa";

CREATE TABLE "Cobranca" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "ordemId" INTEGER,
    "orcamentoId" INTEGER NOT NULL,
    "provedor" "ProvedorPagamento" NOT NULL,
    "ambiente" "AmbientePagamento" NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL DEFAULT 'PIX',
    "status" "StatusCobranca" NOT NULL DEFAULT 'PENDENTE',
    "valor" DECIMAL(12,2) NOT NULL,
    "chaveIdempotencia" TEXT NOT NULL,
    "identificadorExterno" TEXT,
    "codigoPix" TEXT,
    "qrCodeBase64" TEXT,
    "expiraEm" TIMESTAMP(3),
    "pagaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "estornadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Cobranca_valor_check" CHECK ("valor" > 0),
    CONSTRAINT "Cobranca_datas_status_check" CHECK (
        ("status" = 'PENDENTE' AND "pagaEm" IS NULL AND "canceladaEm" IS NULL AND "estornadaEm" IS NULL) OR
        ("status" = 'PAGA' AND "pagaEm" IS NOT NULL AND "canceladaEm" IS NULL AND "estornadaEm" IS NULL) OR
        ("status" = 'EXPIRADA' AND "pagaEm" IS NULL AND "canceladaEm" IS NULL AND "estornadaEm" IS NULL) OR
        ("status" = 'CANCELADA' AND "pagaEm" IS NULL AND "canceladaEm" IS NOT NULL AND "estornadaEm" IS NULL) OR
        ("status" = 'ESTORNADA' AND "pagaEm" IS NOT NULL AND "canceladaEm" IS NULL AND "estornadaEm" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "ConfiguracaoPagamento_empresaId_key"
    ON "ConfiguracaoPagamento"("empresaId");
CREATE INDEX "ConfiguracaoPagamento_empresaId_status_idx"
    ON "ConfiguracaoPagamento"("empresaId", "status");

CREATE UNIQUE INDEX "Cobranca_id_empresaId_key"
    ON "Cobranca"("id", "empresaId");
CREATE UNIQUE INDEX "Cobranca_empresaId_chaveIdempotencia_key"
    ON "Cobranca"("empresaId", "chaveIdempotencia");
CREATE UNIQUE INDEX "Cobranca_empresaId_provedor_identificadorExterno_key"
    ON "Cobranca"("empresaId", "provedor", "identificadorExterno");
CREATE INDEX "Cobranca_empresaId_status_criadoEm_idx"
    ON "Cobranca"("empresaId", "status", "criadoEm");
CREATE INDEX "Cobranca_empresaId_ordemId_idx"
    ON "Cobranca"("empresaId", "ordemId");
CREATE INDEX "Cobranca_empresaId_orcamentoId_idx"
    ON "Cobranca"("empresaId", "orcamentoId");

ALTER TABLE "ConfiguracaoPagamento"
    ADD CONSTRAINT "ConfiguracaoPagamento_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Cobranca"
    ADD CONSTRAINT "Cobranca_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cobranca"
    ADD CONSTRAINT "Cobranca_ordemId_empresaId_fkey"
    FOREIGN KEY ("ordemId", "empresaId") REFERENCES "OrdemServico"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cobranca"
    ADD CONSTRAINT "Cobranca_orcamentoId_empresaId_fkey"
    FOREIGN KEY ("orcamentoId", "empresaId") REFERENCES "Orcamento"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pagamento" ADD COLUMN "cobrancaId" INTEGER;
CREATE UNIQUE INDEX "Pagamento_cobrancaId_key"
    ON "Pagamento"("cobrancaId");
CREATE UNIQUE INDEX "Pagamento_cobrancaId_empresaId_key"
    ON "Pagamento"("cobrancaId", "empresaId");
CREATE INDEX "Pagamento_empresaId_cobrancaId_idx"
    ON "Pagamento"("empresaId", "cobrancaId");
ALTER TABLE "Pagamento"
    ADD CONSTRAINT "Pagamento_cobrancaId_empresaId_fkey"
    FOREIGN KEY ("cobrancaId", "empresaId") REFERENCES "Cobranca"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
