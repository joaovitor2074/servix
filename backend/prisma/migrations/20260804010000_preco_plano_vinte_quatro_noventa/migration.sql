-- Atualiza o novo preco somente quando ainda nao existe contrato externo
-- vigente. Assinaturas ja contratadas preservam o valor aceito no provedor.
UPDATE "AssinaturaEmpresa"
SET "valorMensal" = 24.90
WHERE "mercadoPagoAssinaturaId" IS NULL
   OR "status" = 'CANCELADA';
