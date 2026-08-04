CREATE TYPE "ModoEnvioWhatsApp" AS ENUM ('LINK_MANUAL', 'CLOUD_API');
CREATE TYPE "TipoMensagemWhatsApp" AS ENUM ('ORCAMENTO', 'STATUS_ORDEM', 'PRONTO_RETIRADA', 'GARANTIA');
CREATE TYPE "StatusMensagemWhatsApp" AS ENUM ('PREPARADA', 'ENVIADA', 'FALHA');

CREATE TABLE "ConfiguracaoWhatsApp" (
  "id" SERIAL NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "modoEnvio" "ModoEnvioWhatsApp" NOT NULL DEFAULT 'LINK_MANUAL',
  "telefoneEmpresa" TEXT,
  "incluirLink" BOOLEAN NOT NULL DEFAULT true,
  "templateOrcamento" TEXT NOT NULL,
  "templateRecebido" TEXT NOT NULL,
  "templateEmAnalise" TEXT NOT NULL,
  "templateEmExecucao" TEXT NOT NULL,
  "templateAguardandoPeca" TEXT NOT NULL,
  "templatePronto" TEXT NOT NULL,
  "templateEntregue" TEXT NOT NULL,
  "templateGarantia" TEXT NOT NULL,
  "apiPhoneNumberId" TEXT,
  "apiBusinessAccountId" TEXT,
  "apiAccessTokenCifrado" TEXT,
  "apiAccessTokenAtualizadoEm" TIMESTAMP(3),
  "versao" INTEGER NOT NULL DEFAULT 1,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConfiguracaoWhatsApp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegistroMensagemWhatsApp" (
  "id" SERIAL NOT NULL,
  "empresaId" INTEGER NOT NULL,
  "ordemId" INTEGER,
  "orcamentoId" INTEGER,
  "tipo" "TipoMensagemWhatsApp" NOT NULL,
  "modoEnvio" "ModoEnvioWhatsApp" NOT NULL,
  "status" "StatusMensagemWhatsApp" NOT NULL DEFAULT 'PREPARADA',
  "telefone" TEXT NOT NULL,
  "conteudo" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "erro" TEXT,
  "registradoPorId" INTEGER,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistroMensagemWhatsApp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConfiguracaoWhatsApp_empresaId_key" ON "ConfiguracaoWhatsApp"("empresaId");
CREATE UNIQUE INDEX "RegistroMensagemWhatsApp_id_empresaId_key" ON "RegistroMensagemWhatsApp"("id", "empresaId");
CREATE INDEX "RegistroMensagemWhatsApp_empresaId_criadoEm_idx" ON "RegistroMensagemWhatsApp"("empresaId", "criadoEm");
CREATE INDEX "RegistroMensagemWhatsApp_empresaId_ordemId_idx" ON "RegistroMensagemWhatsApp"("empresaId", "ordemId");
CREATE INDEX "RegistroMensagemWhatsApp_empresaId_orcamentoId_idx" ON "RegistroMensagemWhatsApp"("empresaId", "orcamentoId");

ALTER TABLE "ConfiguracaoWhatsApp" ADD CONSTRAINT "ConfiguracaoWhatsApp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistroMensagemWhatsApp" ADD CONSTRAINT "RegistroMensagemWhatsApp_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistroMensagemWhatsApp" ADD CONSTRAINT "RegistroMensagemWhatsApp_ordemId_empresaId_fkey" FOREIGN KEY ("ordemId", "empresaId") REFERENCES "OrdemServico"("id", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistroMensagemWhatsApp" ADD CONSTRAINT "RegistroMensagemWhatsApp_orcamentoId_empresaId_fkey" FOREIGN KEY ("orcamentoId", "empresaId") REFERENCES "Orcamento"("id", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistroMensagemWhatsApp" ADD CONSTRAINT "RegistroMensagemWhatsApp_registradoPorId_empresaId_fkey" FOREIGN KEY ("registradoPorId", "empresaId") REFERENCES "Usuario"("id", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE;
