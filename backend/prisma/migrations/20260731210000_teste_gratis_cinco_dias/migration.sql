-- O teste gratuito fica separado do ciclo financeiro da assinatura. As
-- colunas nulas preservam empresas antigas e permitem liberar pilotos por um
-- prazo definido sem criar cobranca no gateway.
ALTER TABLE "AssinaturaEmpresa"
  ADD COLUMN "testeGratisIniciadoEm" TIMESTAMP(3),
  ADD COLUMN "testeGratisExpiraEm" TIMESTAMP(3),
  ADD COLUMN "acessoPilotoAte" TIMESTAMP(3);

CREATE INDEX "AssinaturaEmpresa_testeGratisExpiraEm_idx"
  ON "AssinaturaEmpresa"("testeGratisExpiraEm");

CREATE INDEX "AssinaturaEmpresa_acessoPilotoAte_idx"
  ON "AssinaturaEmpresa"("acessoPilotoAte");
