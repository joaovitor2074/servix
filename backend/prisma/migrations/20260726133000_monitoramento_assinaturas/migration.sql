-- CreateEnum
CREATE TYPE "TipoHistoricoAssinatura" AS ENUM (
  'ATIVADA',
  'SINCRONIZADA',
  'CANCELADA',
  'REATIVACAO_SOLICITADA',
  'REATIVADA',
  'INADIMPLENCIA_DETECTADA'
);

-- CreateEnum
CREATE TYPE "OrigemHistoricoAssinatura" AS ENUM (
  'CHECKOUT',
  'WEBHOOK',
  'SINCRONIZACAO_MANUAL',
  'CANCELAMENTO_ADMIN',
  'REATIVACAO_ADMIN'
);

-- CreateEnum
CREATE TYPE "StatusProcessamentoWebhook" AS ENUM (
  'PENDENTE',
  'PROCESSANDO',
  'PROCESSADO',
  'FALHA'
);

-- CreateTable
CREATE TABLE "HistoricoAssinaturaEmpresa" (
  "id" SERIAL NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "assinaturaEmpresaId" INTEGER NOT NULL,
  "tipo" "TipoHistoricoAssinatura" NOT NULL,
  "origem" "OrigemHistoricoAssinatura" NOT NULL,
  "statusAnterior" "StatusAssinatura",
  "statusNovo" "StatusAssinatura" NOT NULL,
  "mercadoPagoAssinaturaId" TEXT,
  "requestIdProvedor" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HistoricoAssinaturaEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoWebhookAssinatura" (
  "id" SERIAL NOT NULL,
  "empresaId" INTEGER,
  "assinaturaEmpresaId" INTEGER,
  "requestId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "recursoId" TEXT NOT NULL,
  "status" "StatusProcessamentoWebhook" NOT NULL DEFAULT 'PENDENTE',
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "ultimaTentativaEm" TIMESTAMP(3),
  "proximaTentativaEm" TIMESTAMP(3),
  "processadoEm" TIMESTAMP(3),
  "ultimoErro" TEXT,
  "alertaEmitidoEm" TIMESTAMP(3),
  "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EventoWebhookAssinatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoAssinaturaEmpresa_empresaId_criadoEm_idx" ON "HistoricoAssinaturaEmpresa"("empresaId", "criadoEm");
CREATE INDEX "HistoricoAssinaturaEmpresa_assinaturaEmpresaId_criadoEm_idx" ON "HistoricoAssinaturaEmpresa"("assinaturaEmpresaId", "criadoEm");
CREATE INDEX "HistoricoAssinaturaEmpresa_mercadoPagoAssinaturaId_idx" ON "HistoricoAssinaturaEmpresa"("mercadoPagoAssinaturaId");
CREATE UNIQUE INDEX "EventoWebhookAssinatura_requestId_key" ON "EventoWebhookAssinatura"("requestId");
CREATE INDEX "EventoWebhookAssinatura_status_proximaTentativaEm_idx" ON "EventoWebhookAssinatura"("status", "proximaTentativaEm");
CREATE INDEX "EventoWebhookAssinatura_empresaId_recebidoEm_idx" ON "EventoWebhookAssinatura"("empresaId", "recebidoEm");
CREATE INDEX "EventoWebhookAssinatura_assinaturaEmpresaId_recebidoEm_idx" ON "EventoWebhookAssinatura"("assinaturaEmpresaId", "recebidoEm");
CREATE INDEX "EventoWebhookAssinatura_tipo_recursoId_idx" ON "EventoWebhookAssinatura"("tipo", "recursoId");

-- AddForeignKey
ALTER TABLE "HistoricoAssinaturaEmpresa" ADD CONSTRAINT "HistoricoAssinaturaEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HistoricoAssinaturaEmpresa" ADD CONSTRAINT "HistoricoAssinaturaEmpresa_assinaturaEmpresaId_fkey" FOREIGN KEY ("assinaturaEmpresaId") REFERENCES "AssinaturaEmpresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventoWebhookAssinatura" ADD CONSTRAINT "EventoWebhookAssinatura_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventoWebhookAssinatura" ADD CONSTRAINT "EventoWebhookAssinatura_assinaturaEmpresaId_fkey" FOREIGN KEY ("assinaturaEmpresaId") REFERENCES "AssinaturaEmpresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
