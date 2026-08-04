CREATE TYPE "TipoMovimentacaoEstoque" AS ENUM (
  'ENTRADA',
  'SAIDA_ORDEM',
  'AJUSTE_ENTRADA',
  'AJUSTE_SAIDA',
  'ESTORNO'
);

CREATE TYPE "StatusGarantia" AS ENUM ('ATIVA', 'UTILIZADA', 'CANCELADA');

CREATE TABLE "ProdutoEstoque" (
  "id" SERIAL NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "nome" TEXT NOT NULL,
  "sku" TEXT,
  "unidade" TEXT NOT NULL DEFAULT 'un',
  "quantidade" INTEGER NOT NULL DEFAULT 0,
  "estoqueMinimo" INTEGER NOT NULL DEFAULT 0,
  "custoUnitario" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "precoVenda" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProdutoEstoque_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MovimentacaoEstoque" (
  "id" SERIAL NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "produtoId" INTEGER NOT NULL,
  "ordemId" INTEGER,
  "tipo" "TipoMovimentacaoEstoque" NOT NULL,
  "quantidade" INTEGER NOT NULL,
  "saldoAnterior" INTEGER NOT NULL,
  "saldoPosterior" INTEGER NOT NULL,
  "custoUnitario" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "observacao" TEXT,
  "criadoPorId" INTEGER,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MovimentacaoEstoque_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GarantiaServico" (
  "id" SERIAL NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "ordemId" INTEGER NOT NULL,
  "codigo" TEXT NOT NULL,
  "status" "StatusGarantia" NOT NULL DEFAULT 'ATIVA',
  "dias" INTEGER NOT NULL DEFAULT 90,
  "inicioEm" TIMESTAMP(3) NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "termos" TEXT NOT NULL,
  "acionadaEm" TIMESTAMP(3),
  "observacaoAcionamento" TEXT,
  "registradoPorId" INTEGER,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GarantiaServico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProdutoEstoque_id_empresaId_key" ON "ProdutoEstoque"("id", "empresaId");
CREATE UNIQUE INDEX "ProdutoEstoque_empresaId_sku_key" ON "ProdutoEstoque"("empresaId", "sku");
CREATE INDEX "ProdutoEstoque_empresaId_ativo_nome_idx" ON "ProdutoEstoque"("empresaId", "ativo", "nome");
CREATE INDEX "ProdutoEstoque_empresaId_quantidade_idx" ON "ProdutoEstoque"("empresaId", "quantidade");

CREATE UNIQUE INDEX "MovimentacaoEstoque_id_empresaId_key" ON "MovimentacaoEstoque"("id", "empresaId");
CREATE INDEX "MovimentacaoEstoque_empresaId_produtoId_criadoEm_idx" ON "MovimentacaoEstoque"("empresaId", "produtoId", "criadoEm");
CREATE INDEX "MovimentacaoEstoque_empresaId_ordemId_idx" ON "MovimentacaoEstoque"("empresaId", "ordemId");

CREATE UNIQUE INDEX "GarantiaServico_codigo_key" ON "GarantiaServico"("codigo");
CREATE UNIQUE INDEX "GarantiaServico_id_empresaId_key" ON "GarantiaServico"("id", "empresaId");
CREATE UNIQUE INDEX "GarantiaServico_ordemId_empresaId_key" ON "GarantiaServico"("ordemId", "empresaId");
CREATE INDEX "GarantiaServico_empresaId_status_expiraEm_idx" ON "GarantiaServico"("empresaId", "status", "expiraEm");

ALTER TABLE "ProdutoEstoque"
  ADD CONSTRAINT "ProdutoEstoque_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MovimentacaoEstoque"
  ADD CONSTRAINT "MovimentacaoEstoque_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MovimentacaoEstoque_produtoId_empresaId_fkey"
  FOREIGN KEY ("produtoId", "empresaId") REFERENCES "ProdutoEstoque"("id", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MovimentacaoEstoque_ordemId_empresaId_fkey"
  FOREIGN KEY ("ordemId", "empresaId") REFERENCES "OrdemServico"("id", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MovimentacaoEstoque_criadoPorId_empresaId_fkey"
  FOREIGN KEY ("criadoPorId", "empresaId") REFERENCES "Usuario"("id", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GarantiaServico"
  ADD CONSTRAINT "GarantiaServico_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GarantiaServico_ordemId_empresaId_fkey"
  FOREIGN KEY ("ordemId", "empresaId") REFERENCES "OrdemServico"("id", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GarantiaServico_registradoPorId_empresaId_fkey"
  FOREIGN KEY ("registradoPorId", "empresaId") REFERENCES "Usuario"("id", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "GarantiaServico" (
  "empresaId", "ordemId", "codigo", "status", "dias", "inicioEm",
  "expiraEm", "termos", "criadoEm", "atualizadoEm"
)
SELECT
  os."empresaId",
  os."id",
  md5(random()::text || clock_timestamp()::text || os."id"::text),
  'ATIVA'::"StatusGarantia",
  90,
  os."atualizadoEm",
  os."atualizadoEm" + INTERVAL '90 days',
  'A garantia cobre exclusivamente o serviço e as peças descritas na ordem. Não cobre danos por queda, líquido, mau uso, violação por terceiros ou defeitos diferentes do reparo realizado.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "OrdemServico" os
WHERE os."status" = 'ENTREGUE';
