BEGIN;

-- O ambiente da credencial ja e validado pelo modo explicito do servidor e
-- pelo campo live_mode devolvido pelo Mercado Pago. A restricao anterior
-- existia para manter a primeira entrega somente em sandbox.
ALTER TABLE "IntegracaoPagamento"
  DROP CONSTRAINT IF EXISTS "IntegracaoPagamento_ambiente_teste_check";

COMMIT;
