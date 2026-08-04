-- Dados estruturados conferidos no recebimento do aparelho.
ALTER TABLE "OrdemServico"
  ADD COLUMN "marcaAparelho" TEXT,
  ADD COLUMN "modeloAparelho" TEXT,
  ADD COLUMN "imei" TEXT,
  ADD COLUMN "numeroSerie" TEXT,
  ADD COLUMN "corAparelho" TEXT,
  ADD COLUMN "capacidadeAparelho" TEXT,
  ADD COLUMN "acessoriosEntrada" TEXT,
  ADD COLUMN "checklistEntrada" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "defeitosVisiveis" TEXT,
  ADD COLUMN "aparelhoJaAberto" BOOLEAN,
  ADD COLUMN "aceiteClienteEm" TIMESTAMP(3),
  ADD COLUMN "tecnicoResponsavelId" INTEGER;

CREATE INDEX "OrdemServico_tecnicoResponsavelId_empresaId_idx"
  ON "OrdemServico"("tecnicoResponsavelId", "empresaId");

ALTER TABLE "OrdemServico"
  ADD CONSTRAINT "OrdemServico_tecnicoResponsavelId_empresaId_fkey"
  FOREIGN KEY ("tecnicoResponsavelId", "empresaId")
  REFERENCES "Usuario"("id", "empresaId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
