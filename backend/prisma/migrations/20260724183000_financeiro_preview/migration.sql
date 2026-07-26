BEGIN;

-- O financeiro empresarial e criado em tabelas proprias e nao altera o ledger
-- Pagamento/Cobranca das ordens. A aplicacao desta migration deve ocorrer
-- somente no banco de preview/homologacao.
CREATE TYPE "AmbienteFinanceiro" AS ENUM ('PREVIEW', 'PRODUCAO');
CREATE TYPE "TipoCategoriaFinanceira" AS ENUM ('RECEITA', 'DESPESA');
CREATE TYPE "TipoContaFinanceira" AS ENUM (
    'CAIXA',
    'CONTA_BANCARIA',
    'CARTEIRA_DIGITAL',
    'OUTRA'
);
CREATE TYPE "TipoLancamentoFinanceiro" AS ENUM ('RECEBER', 'PAGAR');
CREATE TYPE "StatusLancamentoFinanceiro" AS ENUM (
    'RASCUNHO',
    'PENDENTE',
    'PARCIAL',
    'QUITADO',
    'VENCIDO',
    'CANCELADO'
);
CREATE TYPE "OrigemLancamentoFinanceiro" AS ENUM (
    'MANUAL',
    'ORDEM_SERVICO',
    'ORCAMENTO',
    'IMPORTACAO'
);
CREATE TYPE "TipoMovimentacaoFinanceira" AS ENUM (
    'ENTRADA',
    'SAIDA',
    'TRANSFERENCIA_ENTRADA',
    'TRANSFERENCIA_SAIDA',
    'AJUSTE_ENTRADA',
    'AJUSTE_SAIDA'
);
CREATE TYPE "StatusMovimentacaoFinanceira" AS ENUM (
    'CONFIRMADA',
    'ESTORNADA'
);
CREATE TYPE "StatusIdempotenciaFinanceira" AS ENUM (
    'EM_PROCESSAMENTO',
    'CONCLUIDA'
);

CREATE TABLE "CategoriaFinanceira" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "ambiente" "AmbienteFinanceiro" NOT NULL DEFAULT 'PREVIEW',
    "nome" TEXT NOT NULL,
    "tipo" "TipoCategoriaFinanceira" NOT NULL,
    "cor" TEXT,
    "descricao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT TRUE,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoriaFinanceira_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CategoriaFinanceira_nome_check" CHECK (
        NULLIF(BTRIM("nome"), '') IS NOT NULL
    ),
    CONSTRAINT "CategoriaFinanceira_cor_check" CHECK (
        "cor" IS NULL OR "cor" ~ '^#[0-9A-Fa-f]{6}$'
    )
);

CREATE TABLE "CentroCustoFinanceiro" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "ambiente" "AmbienteFinanceiro" NOT NULL DEFAULT 'PREVIEW',
    "nome" TEXT NOT NULL,
    "codigo" TEXT,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT TRUE,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CentroCustoFinanceiro_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CentroCustoFinanceiro_textos_check" CHECK (
        NULLIF(BTRIM("nome"), '') IS NOT NULL AND
        ("codigo" IS NULL OR NULLIF(BTRIM("codigo"), '') IS NOT NULL)
    )
);

CREATE TABLE "ContaFinanceira" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "ambiente" "AmbienteFinanceiro" NOT NULL DEFAULT 'PREVIEW',
    "nome" TEXT NOT NULL,
    "tipo" "TipoContaFinanceira" NOT NULL,
    "instituicao" TEXT,
    "cor" TEXT,
    "saldoInicial" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dataSaldoInicial" TIMESTAMP(3) NOT NULL,
    "descricao" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT TRUE,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaFinanceira_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContaFinanceira_nome_check" CHECK (
        NULLIF(BTRIM("nome"), '') IS NOT NULL
    ),
    CONSTRAINT "ContaFinanceira_cor_check" CHECK (
        "cor" IS NULL OR "cor" ~ '^#[0-9A-Fa-f]{6}$'
    )
);

CREATE TABLE "LancamentoFinanceiro" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "ambiente" "AmbienteFinanceiro" NOT NULL DEFAULT 'PREVIEW',
    "tipo" "TipoLancamentoFinanceiro" NOT NULL,
    "status" "StatusLancamentoFinanceiro" NOT NULL DEFAULT 'PENDENTE',
    "origem" "OrigemLancamentoFinanceiro" NOT NULL DEFAULT 'MANUAL',
    "descricao" TEXT NOT NULL,
    "documento" TEXT,
    "contraparte" TEXT,
    "clienteId" INTEGER,
    "categoriaId" INTEGER NOT NULL,
    "centroCustoId" INTEGER,
    "contaPreferidaId" INTEGER,
    "valorOriginal" DECIMAL(12,2) NOT NULL,
    "desconto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "juros" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "multa" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "valorTotal" DECIMAL(12,2) NOT NULL,
    "dataCompetencia" TIMESTAMP(3) NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoPorId" INTEGER,
    "canceladoEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LancamentoFinanceiro_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LancamentoFinanceiro_descricao_check" CHECK (
        NULLIF(BTRIM("descricao"), '') IS NOT NULL
    ),
    CONSTRAINT "LancamentoFinanceiro_valores_check" CHECK (
        "valorOriginal" > 0 AND
        "desconto" >= 0 AND
        "desconto" <= "valorOriginal" AND
        "juros" >= 0 AND
        "multa" >= 0 AND
        "valorTotal" > 0 AND
        "valorTotal" = "valorOriginal" - "desconto" + "juros" + "multa"
    ),
    CONSTRAINT "LancamentoFinanceiro_versao_check" CHECK ("versao" > 0),
    CONSTRAINT "LancamentoFinanceiro_cancelamento_check" CHECK (
        (
            "status" = 'CANCELADO' AND
            "canceladoEm" IS NOT NULL AND
            NULLIF(BTRIM("motivoCancelamento"), '') IS NOT NULL
        ) OR (
            "status" <> 'CANCELADO' AND
            "canceladoEm" IS NULL AND
            "motivoCancelamento" IS NULL
        )
    )
);

CREATE TABLE "MovimentacaoFinanceira" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "ambiente" "AmbienteFinanceiro" NOT NULL DEFAULT 'PREVIEW',
    "contaId" INTEGER NOT NULL,
    "lancamentoId" INTEGER,
    "tipo" "TipoMovimentacaoFinanceira" NOT NULL,
    "status" "StatusMovimentacaoFinanceira" NOT NULL DEFAULT 'CONFIRMADA',
    "valor" DECIMAL(12,2) NOT NULL,
    "formaPagamento" "FormaPagamento" NOT NULL DEFAULT 'NAO_INFORMADA',
    "descricao" TEXT NOT NULL,
    "documento" TEXT,
    "observacao" TEXT,
    "grupoTransferencia" TEXT,
    "movimentadoEm" TIMESTAMP(3) NOT NULL,
    "registradoPorId" INTEGER,
    "estornadoEm" TIMESTAMP(3),
    "estornadoPorId" INTEGER,
    "motivoEstorno" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoFinanceira_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MovimentacaoFinanceira_valor_check" CHECK ("valor" > 0),
    CONSTRAINT "MovimentacaoFinanceira_descricao_check" CHECK (
        NULLIF(BTRIM("descricao"), '') IS NOT NULL
    ),
    CONSTRAINT "MovimentacaoFinanceira_transferencia_check" CHECK (
        (
            "tipo" IN ('TRANSFERENCIA_ENTRADA', 'TRANSFERENCIA_SAIDA') AND
            NULLIF(BTRIM("grupoTransferencia"), '') IS NOT NULL AND
            "lancamentoId" IS NULL
        ) OR (
            "tipo" NOT IN ('TRANSFERENCIA_ENTRADA', 'TRANSFERENCIA_SAIDA') AND
            "grupoTransferencia" IS NULL
        )
    ),
    CONSTRAINT "MovimentacaoFinanceira_lancamento_tipo_check" CHECK (
        "lancamentoId" IS NULL OR "tipo" IN ('ENTRADA', 'SAIDA')
    ),
    CONSTRAINT "MovimentacaoFinanceira_estorno_check" CHECK (
        (
            "status" = 'CONFIRMADA' AND
            "estornadoEm" IS NULL AND
            "estornadoPorId" IS NULL AND
            "motivoEstorno" IS NULL
        ) OR (
            "status" = 'ESTORNADA' AND
            "estornadoEm" IS NOT NULL AND
            "estornadoEm" >= "criadoEm" AND
            "estornadoPorId" IS NOT NULL AND
            NULLIF(BTRIM("motivoEstorno"), '') IS NOT NULL
        )
    )
);

CREATE TABLE "AuditoriaFinanceira" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "ambiente" "AmbienteFinanceiro" NOT NULL DEFAULT 'PREVIEW',
    "usuarioId" INTEGER,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" INTEGER,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaFinanceira_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditoriaFinanceira_textos_check" CHECK (
        NULLIF(BTRIM("acao"), '') IS NOT NULL AND
        NULLIF(BTRIM("entidade"), '') IS NOT NULL
    ),
    CONSTRAINT "AuditoriaFinanceira_conteudo_check" CHECK (
        "dadosAntes" IS NOT NULL OR "dadosDepois" IS NOT NULL
    )
);

CREATE TABLE "IdempotenciaFinanceira" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "ambiente" "AmbienteFinanceiro" NOT NULL DEFAULT 'PREVIEW',
    "usuarioId" INTEGER NOT NULL,
    "chave" TEXT NOT NULL,
    "operacao" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "StatusIdempotenciaFinanceira" NOT NULL DEFAULT 'EM_PROCESSAMENTO',
    "codigoHttp" INTEGER,
    "resposta" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "IdempotenciaFinanceira_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IdempotenciaFinanceira_chave_check" CHECK (
        "chave" ~ '^[A-Za-z0-9._:-]{8,120}$'
    ),
    CONSTRAINT "IdempotenciaFinanceira_operacao_check" CHECK (
        NULLIF(BTRIM("operacao"), '') IS NOT NULL
    ),
    CONSTRAINT "IdempotenciaFinanceira_fingerprint_check" CHECK (
        "fingerprint" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "IdempotenciaFinanceira_estado_check" CHECK (
        (
            "status" = 'EM_PROCESSAMENTO' AND
            "codigoHttp" IS NULL AND
            "resposta" IS NULL AND
            "concluidoEm" IS NULL
        ) OR (
            "status" = 'CONCLUIDA' AND
            "codigoHttp" BETWEEN 100 AND 599 AND
            "resposta" IS NOT NULL AND
            "concluidoEm" IS NOT NULL AND
            "concluidoEm" >= "criadoEm"
        )
    )
);

CREATE UNIQUE INDEX "CategoriaFinanceira_id_empresaId_ambiente_key"
    ON "CategoriaFinanceira"("id", "empresaId", "ambiente");
CREATE UNIQUE INDEX "CategoriaFinanceira_empresaId_ambiente_tipo_nome_key"
    ON "CategoriaFinanceira"("empresaId", "ambiente", "tipo", "nome");
CREATE INDEX "CategoriaFinanceira_empresaId_ambiente_ativa_tipo_idx"
    ON "CategoriaFinanceira"("empresaId", "ambiente", "ativa", "tipo");

CREATE UNIQUE INDEX "CentroCustoFinanceiro_id_empresaId_ambiente_key"
    ON "CentroCustoFinanceiro"("id", "empresaId", "ambiente");
CREATE UNIQUE INDEX "CentroCustoFinanceiro_empresaId_ambiente_nome_key"
    ON "CentroCustoFinanceiro"("empresaId", "ambiente", "nome");
CREATE UNIQUE INDEX "CentroCustoFinanceiro_empresaId_ambiente_codigo_key"
    ON "CentroCustoFinanceiro"("empresaId", "ambiente", "codigo");
CREATE INDEX "CentroCustoFinanceiro_empresaId_ambiente_ativo_idx"
    ON "CentroCustoFinanceiro"("empresaId", "ambiente", "ativo");

CREATE UNIQUE INDEX "ContaFinanceira_id_empresaId_ambiente_key"
    ON "ContaFinanceira"("id", "empresaId", "ambiente");
CREATE UNIQUE INDEX "ContaFinanceira_empresaId_ambiente_nome_key"
    ON "ContaFinanceira"("empresaId", "ambiente", "nome");
CREATE INDEX "ContaFinanceira_empresaId_ambiente_ativa_idx"
    ON "ContaFinanceira"("empresaId", "ambiente", "ativa");

CREATE UNIQUE INDEX "LancamentoFinanceiro_id_empresaId_ambiente_key"
    ON "LancamentoFinanceiro"("id", "empresaId", "ambiente");
CREATE INDEX "LancamentoFinanceiro_empresaId_ambiente_tipo_status_dataVencimento_idx"
    ON "LancamentoFinanceiro"("empresaId", "ambiente", "tipo", "status", "dataVencimento");
CREATE INDEX "LancamentoFinanceiro_empresaId_ambiente_categoriaId_dataCompetencia_idx"
    ON "LancamentoFinanceiro"("empresaId", "ambiente", "categoriaId", "dataCompetencia");
CREATE INDEX "LancamentoFinanceiro_empresaId_ambiente_centroCustoId_dataCompetencia_idx"
    ON "LancamentoFinanceiro"("empresaId", "ambiente", "centroCustoId", "dataCompetencia");
CREATE INDEX "LancamentoFinanceiro_empresaId_ambiente_clienteId_idx"
    ON "LancamentoFinanceiro"("empresaId", "ambiente", "clienteId");

CREATE UNIQUE INDEX "MovimentacaoFinanceira_id_empresaId_ambiente_key"
    ON "MovimentacaoFinanceira"("id", "empresaId", "ambiente");
CREATE INDEX "MovimentacaoFinanceira_empresaId_ambiente_contaId_status_movimentadoEm_idx"
    ON "MovimentacaoFinanceira"("empresaId", "ambiente", "contaId", "status", "movimentadoEm");
CREATE INDEX "MovimentacaoFinanceira_empresaId_ambiente_lancamentoId_status_idx"
    ON "MovimentacaoFinanceira"("empresaId", "ambiente", "lancamentoId", "status");
CREATE UNIQUE INDEX "MovimentacaoFinanceira_empresaId_ambiente_grupoTransferencia_tipo_key"
    ON "MovimentacaoFinanceira"("empresaId", "ambiente", "grupoTransferencia", "tipo");
CREATE INDEX "MovimentacaoFinanceira_empresaId_ambiente_grupoTransferencia_idx"
    ON "MovimentacaoFinanceira"("empresaId", "ambiente", "grupoTransferencia");

CREATE INDEX "AuditoriaFinanceira_empresaId_ambiente_criadoEm_idx"
    ON "AuditoriaFinanceira"("empresaId", "ambiente", "criadoEm");
CREATE INDEX "AuditoriaFinanceira_empresaId_ambiente_entidade_entidadeId_idx"
    ON "AuditoriaFinanceira"("empresaId", "ambiente", "entidade", "entidadeId");
CREATE INDEX "AuditoriaFinanceira_usuarioId_idx"
    ON "AuditoriaFinanceira"("usuarioId");

CREATE UNIQUE INDEX "IdempotenciaFinanceira_empresaId_ambiente_chave_key"
    ON "IdempotenciaFinanceira"("empresaId", "ambiente", "chave");
CREATE INDEX "IdempotenciaFinanceira_empresaId_ambiente_status_criadoEm_idx"
    ON "IdempotenciaFinanceira"("empresaId", "ambiente", "status", "criadoEm");
CREATE INDEX "IdempotenciaFinanceira_usuarioId_idx"
    ON "IdempotenciaFinanceira"("usuarioId");

ALTER TABLE "CategoriaFinanceira" ADD CONSTRAINT "CategoriaFinanceira_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "CentroCustoFinanceiro" ADD CONSTRAINT "CentroCustoFinanceiro_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "ContaFinanceira" ADD CONSTRAINT "ContaFinanceira_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_clienteId_empresaId_fkey"
    FOREIGN KEY ("clienteId", "empresaId") REFERENCES "Cliente"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_categoriaId_empresaId_ambiente_fkey"
    FOREIGN KEY ("categoriaId", "empresaId", "ambiente")
    REFERENCES "CategoriaFinanceira"("id", "empresaId", "ambiente")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_centroCustoId_empresaId_ambiente_fkey"
    FOREIGN KEY ("centroCustoId", "empresaId", "ambiente")
    REFERENCES "CentroCustoFinanceiro"("id", "empresaId", "ambiente")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_contaPreferidaId_empresaId_ambiente_fkey"
    FOREIGN KEY ("contaPreferidaId", "empresaId", "ambiente")
    REFERENCES "ContaFinanceira"("id", "empresaId", "ambiente")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "LancamentoFinanceiro" ADD CONSTRAINT "LancamentoFinanceiro_criadoPorId_empresaId_fkey"
    FOREIGN KEY ("criadoPorId", "empresaId") REFERENCES "Usuario"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "MovimentacaoFinanceira" ADD CONSTRAINT "MovimentacaoFinanceira_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "MovimentacaoFinanceira" ADD CONSTRAINT "MovimentacaoFinanceira_contaId_empresaId_ambiente_fkey"
    FOREIGN KEY ("contaId", "empresaId", "ambiente")
    REFERENCES "ContaFinanceira"("id", "empresaId", "ambiente")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "MovimentacaoFinanceira" ADD CONSTRAINT "MovimentacaoFinanceira_lancamentoId_empresaId_ambiente_fkey"
    FOREIGN KEY ("lancamentoId", "empresaId", "ambiente")
    REFERENCES "LancamentoFinanceiro"("id", "empresaId", "ambiente")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "MovimentacaoFinanceira" ADD CONSTRAINT "MovimentacaoFinanceira_registradoPorId_empresaId_fkey"
    FOREIGN KEY ("registradoPorId", "empresaId") REFERENCES "Usuario"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "MovimentacaoFinanceira" ADD CONSTRAINT "MovimentacaoFinanceira_estornadoPorId_empresaId_fkey"
    FOREIGN KEY ("estornadoPorId", "empresaId") REFERENCES "Usuario"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "AuditoriaFinanceira" ADD CONSTRAINT "AuditoriaFinanceira_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "AuditoriaFinanceira" ADD CONSTRAINT "AuditoriaFinanceira_usuarioId_empresaId_fkey"
    FOREIGN KEY ("usuarioId", "empresaId") REFERENCES "Usuario"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "IdempotenciaFinanceira" ADD CONSTRAINT "IdempotenciaFinanceira_empresaId_fkey"
    FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "IdempotenciaFinanceira" ADD CONSTRAINT "IdempotenciaFinanceira_usuarioId_empresaId_fkey"
    FOREIGN KEY ("usuarioId", "empresaId") REFERENCES "Usuario"("id", "empresaId")
    ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION "validarDataMovimentacaoFinanceira"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    "inicioConta" TIMESTAMP(3);
BEGIN
    IF NEW."status" <> 'CONFIRMADA' THEN
        RAISE EXCEPTION 'MovimentacaoFinanceira deve nascer CONFIRMADA';
    END IF;

    SELECT "dataSaldoInicial"
      INTO "inicioConta"
    FROM "ContaFinanceira"
    WHERE "id" = NEW."contaId"
      AND "empresaId" = NEW."empresaId"
      AND "ambiente" = NEW."ambiente"
    FOR SHARE;

    IF NEW."movimentadoEm" < "inicioConta" THEN
        RAISE EXCEPTION 'Movimentacao anterior ao saldo inicial da conta';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "MovimentacaoFinanceira_validar_data_insert"
BEFORE INSERT ON "MovimentacaoFinanceira"
FOR EACH ROW EXECUTE FUNCTION "validarDataMovimentacaoFinanceira"();

CREATE OR REPLACE FUNCTION "protegerSaldoInicialContaFinanceira"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."saldoInicial" IS DISTINCT FROM OLD."saldoInicial" OR
       NEW."dataSaldoInicial" IS DISTINCT FROM OLD."dataSaldoInicial" THEN
        RAISE EXCEPTION 'Saldo inicial deve ser corrigido por ajuste auditavel';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "ContaFinanceira_saldo_inicial_imutavel"
BEFORE UPDATE ON "ContaFinanceira"
FOR EACH ROW EXECUTE FUNCTION "protegerSaldoInicialContaFinanceira"();

-- IDs e fronteiras de tenant/ambiente nunca podem ser movidos depois do INSERT.
-- As FKs financeiras usam ON UPDATE NO ACTION como segunda linha de defesa.
CREATE OR REPLACE FUNCTION "protegerIdentidadeTenantFinanceiro"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."id" IS DISTINCT FROM OLD."id" OR
       NEW."empresaId" IS DISTINCT FROM OLD."empresaId" OR
       NEW."ambiente" IS DISTINCT FROM OLD."ambiente" THEN
        RAISE EXCEPTION 'Identidade, empresa e ambiente financeiros sao imutaveis';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "CategoriaFinanceira_identidade_tenant_imutavel"
BEFORE UPDATE ON "CategoriaFinanceira"
FOR EACH ROW EXECUTE FUNCTION "protegerIdentidadeTenantFinanceiro"();
CREATE TRIGGER "CentroCustoFinanceiro_identidade_tenant_imutavel"
BEFORE UPDATE ON "CentroCustoFinanceiro"
FOR EACH ROW EXECUTE FUNCTION "protegerIdentidadeTenantFinanceiro"();
CREATE TRIGGER "ContaFinanceira_identidade_tenant_imutavel"
BEFORE UPDATE ON "ContaFinanceira"
FOR EACH ROW EXECUTE FUNCTION "protegerIdentidadeTenantFinanceiro"();
CREATE TRIGGER "LancamentoFinanceiro_identidade_tenant_imutavel"
BEFORE UPDATE ON "LancamentoFinanceiro"
FOR EACH ROW EXECUTE FUNCTION "protegerIdentidadeTenantFinanceiro"();
CREATE TRIGGER "MovimentacaoFinanceira_identidade_tenant_imutavel"
BEFORE UPDATE ON "MovimentacaoFinanceira"
FOR EACH ROW EXECUTE FUNCTION "protegerIdentidadeTenantFinanceiro"();
CREATE TRIGGER "AuditoriaFinanceira_identidade_tenant_imutavel"
BEFORE UPDATE ON "AuditoriaFinanceira"
FOR EACH ROW EXECUTE FUNCTION "protegerIdentidadeTenantFinanceiro"();
CREATE TRIGGER "IdempotenciaFinanceira_identidade_tenant_imutavel"
BEFORE UPDATE ON "IdempotenciaFinanceira"
FOR EACH ROW EXECUTE FUNCTION "protegerIdentidadeTenantFinanceiro"();

CREATE OR REPLACE FUNCTION "protegerAtualizacaoLancamentoFinanceiro"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    "quantidadeBaixasConfirmadas" INTEGER;
BEGIN
    IF OLD."status" = 'CANCELADO' THEN
        RAISE EXCEPTION 'LancamentoFinanceiro cancelado e terminal';
    END IF;

    SELECT COUNT(*)::INTEGER
      INTO "quantidadeBaixasConfirmadas"
    FROM "MovimentacaoFinanceira"
    WHERE "lancamentoId" = OLD."id"
      AND "empresaId" = OLD."empresaId"
      AND "ambiente" = OLD."ambiente"
      AND "status" = 'CONFIRMADA';

    IF "quantidadeBaixasConfirmadas" > 0 AND NEW."status" = 'CANCELADO' THEN
        RAISE EXCEPTION 'Lancamento com baixa confirmada nao pode ser cancelado';
    END IF;

    IF "quantidadeBaixasConfirmadas" > 0 AND (
        NEW."tipo" IS DISTINCT FROM OLD."tipo" OR
        NEW."valorOriginal" IS DISTINCT FROM OLD."valorOriginal" OR
        NEW."desconto" IS DISTINCT FROM OLD."desconto" OR
        NEW."juros" IS DISTINCT FROM OLD."juros" OR
        NEW."multa" IS DISTINCT FROM OLD."multa" OR
        NEW."valorTotal" IS DISTINCT FROM OLD."valorTotal"
    ) THEN
        RAISE EXCEPTION 'Tipo e valores nao podem mudar com baixa confirmada';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "LancamentoFinanceiro_proteger_atualizacao"
BEFORE UPDATE ON "LancamentoFinanceiro"
FOR EACH ROW EXECUTE FUNCTION "protegerAtualizacaoLancamentoFinanceiro"();

-- Mesmo uma escrita direta no banco nao pode criar uma baixa acima do titulo.
-- O FOR UPDATE complementa o advisory lock e serializa pelo proprio lancamento.
CREATE OR REPLACE FUNCTION "validarBaixaMovimentacaoFinanceira"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    "titulo" RECORD;
    "totalConfirmado" DECIMAL(12,2);
BEGIN
    IF NEW."lancamentoId" IS NULL OR NEW."status" <> 'CONFIRMADA' THEN
        RETURN NEW;
    END IF;

    SELECT "tipo", "status", "valorTotal"
      INTO "titulo"
    FROM "LancamentoFinanceiro"
    WHERE "id" = NEW."lancamentoId"
      AND "empresaId" = NEW."empresaId"
      AND "ambiente" = NEW."ambiente"
    FOR UPDATE;

    IF "titulo"."status" IN ('RASCUNHO', 'CANCELADO') THEN
        RAISE EXCEPTION 'Lancamento nao aceita nova baixa';
    END IF;

    IF (
        "titulo"."tipo" = 'RECEBER' AND NEW."tipo" <> 'ENTRADA'
    ) OR (
        "titulo"."tipo" = 'PAGAR' AND NEW."tipo" <> 'SAIDA'
    ) THEN
        RAISE EXCEPTION 'Tipo de movimento incompativel com o lancamento';
    END IF;

    SELECT COALESCE(SUM("valor"), 0)
      INTO "totalConfirmado"
    FROM "MovimentacaoFinanceira"
    WHERE "lancamentoId" = NEW."lancamentoId"
      AND "empresaId" = NEW."empresaId"
      AND "ambiente" = NEW."ambiente"
      AND "status" = 'CONFIRMADA';

    IF "totalConfirmado" + NEW."valor" > "titulo"."valorTotal" THEN
        RAISE EXCEPTION 'Baixa excede o saldo do lancamento';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "MovimentacaoFinanceira_validar_baixa_insert"
BEFORE INSERT ON "MovimentacaoFinanceira"
FOR EACH ROW EXECUTE FUNCTION "validarBaixaMovimentacaoFinanceira"();

-- Auditoria e ledger nunca aceitam DELETE. Auditoria e totalmente append-only;
-- uma movimentacao confirmada so pode transicionar uma vez para ESTORNADA.
CREATE OR REPLACE FUNCTION "bloquearMutacaoAuditoriaFinanceira"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'AuditoriaFinanceira e append-only';
END;
$$;

CREATE TRIGGER "AuditoriaFinanceira_append_only"
BEFORE UPDATE OR DELETE ON "AuditoriaFinanceira"
FOR EACH ROW EXECUTE FUNCTION "bloquearMutacaoAuditoriaFinanceira"();

CREATE OR REPLACE FUNCTION "protegerMovimentacaoFinanceira"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'MovimentacaoFinanceira nao pode ser apagada';
    END IF;

    IF OLD."status" = 'ESTORNADA' THEN
        RAISE EXCEPTION 'MovimentacaoFinanceira estornada e imutavel';
    END IF;

    IF NEW."status" <> 'ESTORNADA' OR
       NEW."estornadoEm" IS NULL OR
       NEW."estornadoEm" < OLD."criadoEm" OR
       NEW."estornadoPorId" IS NULL OR
       NULLIF(BTRIM(NEW."motivoEstorno"), '') IS NULL OR
       NEW."id" IS DISTINCT FROM OLD."id" OR
       NEW."empresaId" IS DISTINCT FROM OLD."empresaId" OR
       NEW."ambiente" IS DISTINCT FROM OLD."ambiente" OR
       NEW."contaId" IS DISTINCT FROM OLD."contaId" OR
       NEW."lancamentoId" IS DISTINCT FROM OLD."lancamentoId" OR
       NEW."tipo" IS DISTINCT FROM OLD."tipo" OR
       NEW."valor" IS DISTINCT FROM OLD."valor" OR
       NEW."formaPagamento" IS DISTINCT FROM OLD."formaPagamento" OR
       NEW."descricao" IS DISTINCT FROM OLD."descricao" OR
       NEW."documento" IS DISTINCT FROM OLD."documento" OR
       NEW."observacao" IS DISTINCT FROM OLD."observacao" OR
       NEW."grupoTransferencia" IS DISTINCT FROM OLD."grupoTransferencia" OR
       NEW."movimentadoEm" IS DISTINCT FROM OLD."movimentadoEm" OR
       NEW."registradoPorId" IS DISTINCT FROM OLD."registradoPorId" OR
       NEW."criadoEm" IS DISTINCT FROM OLD."criadoEm" THEN
        RAISE EXCEPTION 'MovimentacaoFinanceira confirmada permite somente estorno';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "MovimentacaoFinanceira_sem_delete"
BEFORE DELETE ON "MovimentacaoFinanceira"
FOR EACH ROW EXECUTE FUNCTION "protegerMovimentacaoFinanceira"();
CREATE TRIGGER "MovimentacaoFinanceira_somente_estorno"
BEFORE UPDATE ON "MovimentacaoFinanceira"
FOR EACH ROW EXECUTE FUNCTION "protegerMovimentacaoFinanceira"();

-- Valida o estado materializado do titulo somente no COMMIT. Isso permite que
-- o service atualize o status e insira/estorne a movimentacao na mesma transacao
-- sem observar um estado intermediario inconsistente.
CREATE OR REPLACE FUNCTION "verificarEstadoLancamentoFinanceiro"(
    "lancamentoAlvoId" INTEGER,
    "empresaAlvoId" INTEGER,
    "ambienteAlvo" "AmbienteFinanceiro"
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    "titulo" RECORD;
    "totalConfirmado" DECIMAL(12,2);
BEGIN
    SELECT "status", "valorTotal"
      INTO "titulo"
    FROM "LancamentoFinanceiro"
    WHERE "id" = "lancamentoAlvoId"
      AND "empresaId" = "empresaAlvoId"
      AND "ambiente" = "ambienteAlvo";

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM("valor"), 0)
      INTO "totalConfirmado"
    FROM "MovimentacaoFinanceira"
    WHERE "lancamentoId" = "lancamentoAlvoId"
      AND "empresaId" = "empresaAlvoId"
      AND "ambiente" = "ambienteAlvo"
      AND "status" = 'CONFIRMADA';

    IF "totalConfirmado" > "titulo"."valorTotal" THEN
        RAISE EXCEPTION 'Baixas confirmadas excedem o valor do lancamento';
    END IF;

    IF "titulo"."status" = 'CANCELADO' THEN
        IF "totalConfirmado" <> 0 THEN
            RAISE EXCEPTION 'Lancamento cancelado nao pode possuir baixa confirmada';
        END IF;
        RETURN;
    END IF;

    IF "titulo"."status" = 'RASCUNHO' THEN
        IF "totalConfirmado" <> 0 THEN
            RAISE EXCEPTION 'Lancamento rascunho nao pode possuir baixa confirmada';
        END IF;
        RETURN;
    END IF;

    IF "totalConfirmado" = 0 AND
       "titulo"."status" NOT IN ('PENDENTE', 'VENCIDO') THEN
        RAISE EXCEPTION 'Lancamento sem baixa deve estar pendente ou vencido';
    ELSIF "totalConfirmado" > 0 AND
          "totalConfirmado" < "titulo"."valorTotal" AND
          "titulo"."status" <> 'PARCIAL' THEN
        RAISE EXCEPTION 'Lancamento parcialmente baixado deve estar PARCIAL';
    ELSIF "totalConfirmado" = "titulo"."valorTotal" AND
          "titulo"."status" <> 'QUITADO' THEN
        RAISE EXCEPTION 'Lancamento integralmente baixado deve estar QUITADO';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "validarEstadoLancamentoFinanceiroPorTitulo"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM "verificarEstadoLancamentoFinanceiro"(
        NEW."id",
        NEW."empresaId",
        NEW."ambiente"
    );
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "validarEstadoLancamentoFinanceiroPorMovimento"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."lancamentoId" IS NOT NULL THEN
        PERFORM "verificarEstadoLancamentoFinanceiro"(
            NEW."lancamentoId",
            NEW."empresaId",
            NEW."ambiente"
        );
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "LancamentoFinanceiro_estado_final"
AFTER INSERT OR UPDATE ON "LancamentoFinanceiro"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validarEstadoLancamentoFinanceiroPorTitulo"();

CREATE CONSTRAINT TRIGGER "MovimentacaoFinanceira_estado_lancamento_final"
AFTER INSERT OR UPDATE ON "MovimentacaoFinanceira"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validarEstadoLancamentoFinanceiroPorMovimento"();

-- Cada grupo de transferencia deve terminar a transacao com exatamente uma
-- saida e uma entrada equivalentes. O trigger diferido e compativel tanto com
-- a criacao das duas pernas quanto com o estorno atomico via updateMany.
CREATE OR REPLACE FUNCTION "validarParTransferenciaFinanceira"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    "quantidade" INTEGER;
    "saidas" INTEGER;
    "entradas" INTEGER;
    "contasDistintas" INTEGER;
    "valoresDistintos" INTEGER;
    "datasDistintas" INTEGER;
    "statusDistintos" INTEGER;
BEGIN
    IF NEW."grupoTransferencia" IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (
            WHERE "tipo" = 'TRANSFERENCIA_SAIDA'
        )::INTEGER,
        COUNT(*) FILTER (
            WHERE "tipo" = 'TRANSFERENCIA_ENTRADA'
        )::INTEGER,
        COUNT(DISTINCT "contaId")::INTEGER,
        COUNT(DISTINCT "valor")::INTEGER,
        COUNT(DISTINCT "movimentadoEm")::INTEGER,
        COUNT(DISTINCT "status")::INTEGER
      INTO
        "quantidade",
        "saidas",
        "entradas",
        "contasDistintas",
        "valoresDistintos",
        "datasDistintas",
        "statusDistintos"
    FROM "MovimentacaoFinanceira"
    WHERE "empresaId" = NEW."empresaId"
      AND "ambiente" = NEW."ambiente"
      AND "grupoTransferencia" = NEW."grupoTransferencia";

    IF "quantidade" <> 2 OR
       "saidas" <> 1 OR
       "entradas" <> 1 OR
       "contasDistintas" <> 2 OR
       "valoresDistintos" <> 1 OR
       "datasDistintas" <> 1 OR
       "statusDistintos" <> 1 THEN
        RAISE EXCEPTION 'Transferencia exige par equivalente em contas distintas';
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "MovimentacaoFinanceira_transferencia_par_final"
AFTER INSERT OR UPDATE ON "MovimentacaoFinanceira"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validarParTransferenciaFinanceira"();

CREATE OR REPLACE FUNCTION "protegerCicloIdempotenciaFinanceira"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'IdempotenciaFinanceira nao pode ser apagada';
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW."status" <> 'EM_PROCESSAMENTO' THEN
            RAISE EXCEPTION 'IdempotenciaFinanceira deve nascer EM_PROCESSAMENTO';
        END IF;
        RETURN NEW;
    END IF;

    IF OLD."id" IS DISTINCT FROM NEW."id" OR
       OLD."empresaId" IS DISTINCT FROM NEW."empresaId" OR
       OLD."ambiente" IS DISTINCT FROM NEW."ambiente" OR
       OLD."usuarioId" IS DISTINCT FROM NEW."usuarioId" OR
       OLD."chave" IS DISTINCT FROM NEW."chave" OR
       OLD."operacao" IS DISTINCT FROM NEW."operacao" OR
       OLD."fingerprint" IS DISTINCT FROM NEW."fingerprint" OR
       OLD."criadoEm" IS DISTINCT FROM NEW."criadoEm" THEN
        RAISE EXCEPTION 'Identidade da idempotencia financeira e imutavel';
    END IF;

    IF OLD."status" = 'CONCLUIDA' THEN
        RAISE EXCEPTION 'IdempotenciaFinanceira concluida e terminal';
    END IF;

    IF OLD."status" <> 'EM_PROCESSAMENTO' OR
       NEW."status" <> 'CONCLUIDA' THEN
        RAISE EXCEPTION 'Transicao de idempotencia invalida';
    END IF;

    IF NEW."concluidoEm" IS NULL OR NEW."concluidoEm" < OLD."criadoEm" THEN
        RAISE EXCEPTION 'Conclusao da idempotencia anterior a criacao';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "IdempotenciaFinanceira_ciclo_terminal"
BEFORE INSERT OR UPDATE OR DELETE ON "IdempotenciaFinanceira"
FOR EACH ROW EXECUTE FUNCTION "protegerCicloIdempotenciaFinanceira"();

CREATE OR REPLACE FUNCTION "bloquearExclusaoLancamentoFinanceiro"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'LancamentoFinanceiro deve ser cancelado, nunca apagado';
END;
$$;

CREATE TRIGGER "LancamentoFinanceiro_sem_delete"
BEFORE DELETE ON "LancamentoFinanceiro"
FOR EACH ROW EXECUTE FUNCTION "bloquearExclusaoLancamentoFinanceiro"();

COMMIT;
