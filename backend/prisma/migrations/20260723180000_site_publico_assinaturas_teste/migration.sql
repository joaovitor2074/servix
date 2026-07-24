-- A assinatura SaaS do Servix possui tipos e tabela proprios. Ela nao reutiliza
-- cobrancas, pagamentos ou credenciais OAuth pertencentes as empresas.
CREATE TYPE "AmbienteAssinatura" AS ENUM ('TESTE', 'PRODUCAO');
CREATE TYPE "ProvedorAssinatura" AS ENUM ('SIMULADO', 'MERCADO_PAGO_SERVIX');
CREATE TYPE "StatusAssinatura" AS ENUM ('PENDENTE', 'ATIVA', 'CANCELADA');
CREATE TYPE "StatusEmpresa" AS ENUM ('PENDENTE_ASSINATURA', 'ATIVA', 'SUSPENSA');

ALTER TABLE "Empresa"
    ADD COLUMN "status" "StatusEmpresa" NOT NULL DEFAULT 'ATIVA',
    ADD COLUMN "tipoNegocio" TEXT,
    ADD COLUMN "cpfCnpj" TEXT,
    ADD COLUMN "cidade" TEXT,
    ADD COLUMN "estado" TEXT,
    ADD COLUMN "endereco" TEXT;

ALTER TABLE "Usuario"
    ADD COLUMN "telefone" TEXT;

CREATE UNIQUE INDEX "Empresa_cpfCnpj_key" ON "Empresa"("cpfCnpj");

CREATE TABLE "AssinaturaEmpresa" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "planoCodigo" TEXT NOT NULL,
    "planoNome" TEXT NOT NULL,
    "valorMensal" DECIMAL(12,2) NOT NULL,
    "ambiente" "AmbienteAssinatura" NOT NULL DEFAULT 'TESTE',
    "provedor" "ProvedorAssinatura" NOT NULL DEFAULT 'SIMULADO',
    "status" "StatusAssinatura" NOT NULL DEFAULT 'PENDENTE',
    "checkoutToken" TEXT NOT NULL,
    "versaoTermos" TEXT NOT NULL,
    "termosAceitosEm" TIMESTAMP(3) NOT NULL,
    "ativadaEm" TIMESTAMP(3),
    "canceladaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssinaturaEmpresa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssinaturaEmpresa_empresaId_key"
    ON "AssinaturaEmpresa"("empresaId");
CREATE UNIQUE INDEX "AssinaturaEmpresa_checkoutToken_key"
    ON "AssinaturaEmpresa"("checkoutToken");
CREATE INDEX "AssinaturaEmpresa_status_ambiente_criadoEm_idx"
    ON "AssinaturaEmpresa"("status", "ambiente", "criadoEm");

ALTER TABLE "AssinaturaEmpresa"
    ADD CONSTRAINT "AssinaturaEmpresa_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
