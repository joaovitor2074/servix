-- Atualiza apenas assinaturas que ainda nao possuem um contrato externo vigente.
-- Assinaturas ja criadas no Mercado Pago conservam o valor contratado para que
-- o banco local continue consistente com a cobranca do provedor.
UPDATE "AssinaturaEmpresa"
SET "valorMensal" = 34.90
WHERE "mercadoPagoAssinaturaId" IS NULL
   OR "status" = 'CANCELADA';
