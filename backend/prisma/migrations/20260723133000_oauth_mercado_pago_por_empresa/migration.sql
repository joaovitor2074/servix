BEGIN;

-- A chave composta permite que o estado OAuth referencie simultaneamente o
-- administrador e a empresa, reforcando o isolamento tambem no banco.
CREATE UNIQUE INDEX "Usuario_id_empresaId_key"
    ON "Usuario"("id", "empresaId");

CREATE TABLE "IntegracaoPagamento" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "provedor" "ProvedorPagamento" NOT NULL,
    "mercadoPagoUserId" TEXT NOT NULL,
    "accessTokenCriptografado" TEXT NOT NULL,
    "refreshTokenCriptografado" TEXT NOT NULL,
    "tokenExpiraEm" TIMESTAMP(3) NOT NULL,
    "liveMode" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusConfiguracaoPagamento" NOT NULL DEFAULT 'ATIVA',
    "renovacaoBloqueadaAte" TIMESTAMP(3),
    "conectadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegracaoPagamento_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IntegracaoPagamento_ambiente_teste_check"
        CHECK ("liveMode" = false)
);

CREATE TABLE "EstadoOAuthMercadoPago" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "stateHash" TEXT NOT NULL,
    "codeVerifierCriptografado" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "consumidoEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "finalizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstadoOAuthMercadoPago_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegracaoPagamento_empresaId_provedor_key"
    ON "IntegracaoPagamento"("empresaId", "provedor");
CREATE UNIQUE INDEX "IntegracaoPagamento_provedor_mercadoPagoUserId_key"
    ON "IntegracaoPagamento"("provedor", "mercadoPagoUserId");
CREATE INDEX "IntegracaoPagamento_provedor_status_tokenExpiraEm_idx"
    ON "IntegracaoPagamento"("provedor", "status", "tokenExpiraEm");

CREATE UNIQUE INDEX "EstadoOAuthMercadoPago_stateHash_key"
    ON "EstadoOAuthMercadoPago"("stateHash");
CREATE INDEX "EstadoOAuthMercadoPago_empresaId_expiraEm_idx"
    ON "EstadoOAuthMercadoPago"("empresaId", "expiraEm");
CREATE INDEX "EstadoOAuthMercadoPago_consumidoEm_expiraEm_idx"
    ON "EstadoOAuthMercadoPago"("consumidoEm", "expiraEm");
CREATE INDEX "EstadoOAuthMercadoPago_empresaId_canceladoEm_finalizadoEm_idx"
    ON "EstadoOAuthMercadoPago"("empresaId", "canceladoEm", "finalizadoEm");

ALTER TABLE "IntegracaoPagamento"
    ADD CONSTRAINT "IntegracaoPagamento_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EstadoOAuthMercadoPago"
    ADD CONSTRAINT "EstadoOAuthMercadoPago_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EstadoOAuthMercadoPago"
    ADD CONSTRAINT "EstadoOAuthMercadoPago_usuarioId_empresaId_fkey"
    FOREIGN KEY ("usuarioId", "empresaId") REFERENCES "Usuario"("id", "empresaId")
    ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
