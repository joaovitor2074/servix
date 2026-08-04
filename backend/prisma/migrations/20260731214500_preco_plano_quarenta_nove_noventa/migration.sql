-- Atualiza cadastros que ainda nao possuem uma assinatura externa vigente.
-- Assinaturas ativas nao sao alteradas apenas no banco, pois o valor precisa
-- continuar igual ao contrato efetivamente cobrado pelo provedor.
UPDATE "AssinaturaEmpresa"
SET "valorMensal" = 49.90
WHERE "mercadoPagoAssinaturaId" IS NULL
   OR "status" = 'CANCELADA';
