-- A credencial de desbloqueio nunca e persistida em texto puro. A aplicacao
-- grava somente o envelope AES-GCM e informa quando ele foi atualizado.
ALTER TABLE "OrdemServico"
ADD COLUMN "credencialAcessoCifrada" TEXT,
ADD COLUMN "credencialAcessoAtualizadaEm" TIMESTAMP(3);
