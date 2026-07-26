/*
  Warnings:

  - A unique constraint covering the columns `[mercadoPagoAssinaturaId]` on the table `AssinaturaEmpresa` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referenciaExterna]` on the table `AssinaturaEmpresa` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusAssinatura" ADD VALUE 'PAUSADA';
ALTER TYPE "StatusAssinatura" ADD VALUE 'INADIMPLENTE';

-- DropForeignKey
ALTER TABLE "OrdemServico" DROP CONSTRAINT "OrdemServico_empresaId_fkey";

-- AlterTable
ALTER TABLE "AssinaturaEmpresa" ADD COLUMN     "checkoutUrl" TEXT,
ADD COLUMN     "emailPagador" TEXT,
ADD COLUMN     "mercadoPagoAssinaturaId" TEXT,
ADD COLUMN     "mercadoPagoPlanoId" TEXT,
ADD COLUMN     "proximaCobrancaEm" TIMESTAMP(3),
ADD COLUMN     "referenciaExterna" TEXT,
ADD COLUMN     "ultimaSincronizacaoEm" TIMESTAMP(3),
ADD COLUMN     "versao" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "AssinaturaEmpresa_mercadoPagoAssinaturaId_key" ON "AssinaturaEmpresa"("mercadoPagoAssinaturaId");

-- CreateIndex
CREATE UNIQUE INDEX "AssinaturaEmpresa_referenciaExterna_key" ON "AssinaturaEmpresa"("referenciaExterna");

-- CreateIndex
CREATE INDEX "AssinaturaEmpresa_provedor_status_idx" ON "AssinaturaEmpresa"("provedor", "status");

-- CreateIndex
CREATE INDEX "AssinaturaEmpresa_mercadoPagoPlanoId_idx" ON "AssinaturaEmpresa"("mercadoPagoPlanoId");

-- RenameIndex
ALTER INDEX "LancamentoFinanceiro_empresaId_ambiente_categoriaId_dataCompete" RENAME TO "LancamentoFinanceiro_empresaId_ambiente_categoriaId_dataCom_idx";

-- RenameIndex
ALTER INDEX "LancamentoFinanceiro_empresaId_ambiente_centroCustoId_dataCompe" RENAME TO "LancamentoFinanceiro_empresaId_ambiente_centroCustoId_dataC_idx";

-- RenameIndex
ALTER INDEX "LancamentoFinanceiro_empresaId_ambiente_tipo_status_dataVencime" RENAME TO "LancamentoFinanceiro_empresaId_ambiente_tipo_status_dataVen_idx";

-- RenameIndex
ALTER INDEX "MovimentacaoFinanceira_empresaId_ambiente_contaId_status_movime" RENAME TO "MovimentacaoFinanceira_empresaId_ambiente_contaId_status_mo_idx";

-- RenameIndex
ALTER INDEX "MovimentacaoFinanceira_empresaId_ambiente_grupoTransferencia_id" RENAME TO "MovimentacaoFinanceira_empresaId_ambiente_grupoTransferenci_idx";

-- RenameIndex
ALTER INDEX "MovimentacaoFinanceira_empresaId_ambiente_grupoTransferencia_ti" RENAME TO "MovimentacaoFinanceira_empresaId_ambiente_grupoTransferenci_key";

-- RenameIndex
ALTER INDEX "MovimentacaoFinanceira_empresaId_ambiente_lancamentoId_status_i" RENAME TO "MovimentacaoFinanceira_empresaId_ambiente_lancamentoId_stat_idx";
