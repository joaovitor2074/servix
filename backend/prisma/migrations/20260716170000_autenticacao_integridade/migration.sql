-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('ADMIN', 'ATENDENTE', 'TECNICO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL DEFAULT 'ATENDENTE',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoStatusOrdem" (
    "id" SERIAL NOT NULL,
    "ordemId" INTEGER NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "status" "StatusOrdem" NOT NULL,
    "alteradoPorId" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoStatusOrdem_pkey" PRIMARY KEY ("id")
);

-- Replace tenant-sensitive indexes
DROP INDEX IF EXISTS "Cliente_nome_idx";
DROP INDEX IF EXISTS "Cliente_cpfCnpj_idx";
DROP INDEX IF EXISTS "OrdemServico_clienteId_idx";
DROP INDEX IF EXISTS "OrdemServico_status_idx";
DROP INDEX IF EXISTS "OrdemServico_criadoEm_idx";

CREATE UNIQUE INDEX "Cliente_id_empresaId_key" ON "Cliente"("id", "empresaId");
CREATE INDEX "Cliente_empresaId_nome_idx" ON "Cliente"("empresaId", "nome");
CREATE INDEX "Cliente_empresaId_cpfCnpj_idx" ON "Cliente"("empresaId", "cpfCnpj");

CREATE UNIQUE INDEX "OrdemServico_id_empresaId_key" ON "OrdemServico"("id", "empresaId");
CREATE INDEX "OrdemServico_empresaId_clienteId_idx" ON "OrdemServico"("empresaId", "clienteId");
CREATE INDEX "OrdemServico_empresaId_status_criadoEm_idx" ON "OrdemServico"("empresaId", "status", "criadoEm");
CREATE INDEX "OrdemServico_empresaId_criadoEm_idx" ON "OrdemServico"("empresaId", "criadoEm");

CREATE UNIQUE INDEX "Usuario_empresaId_email_key" ON "Usuario"("empresaId", "email");
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");
CREATE INDEX "HistoricoStatusOrdem_empresaId_ordemId_criadoEm_idx" ON "HistoricoStatusOrdem"("empresaId", "ordemId", "criadoEm");
CREATE INDEX "HistoricoStatusOrdem_alteradoPorId_idx" ON "HistoricoStatusOrdem"("alteradoPorId");

-- Enforce that an order and its customer always belong to the same company
ALTER TABLE "OrdemServico" DROP CONSTRAINT "OrdemServico_clienteId_fkey";
ALTER TABLE "OrdemServico" ADD CONSTRAINT "OrdemServico_clienteId_empresaId_fkey"
    FOREIGN KEY ("clienteId", "empresaId") REFERENCES "Cliente"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HistoricoStatusOrdem" ADD CONSTRAINT "HistoricoStatusOrdem_ordemId_empresaId_fkey"
    FOREIGN KEY ("ordemId", "empresaId") REFERENCES "OrdemServico"("id", "empresaId")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HistoricoStatusOrdem" ADD CONSTRAINT "HistoricoStatusOrdem_alteradoPorId_fkey"
    FOREIGN KEY ("alteradoPorId") REFERENCES "Usuario"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
