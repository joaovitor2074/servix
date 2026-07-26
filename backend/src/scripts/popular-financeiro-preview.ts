import "../config/load-env.js"

import { Prisma } from "../generated/prisma/client.js"
import {
  AmbienteFinanceiro,
  FormaPagamento,
  OrigemLancamentoFinanceiro,
  PapelUsuario,
  StatusEmpresa,
  StatusLancamentoFinanceiro,
  StatusMovimentacaoFinanceira,
  TipoCategoriaFinanceira,
  TipoContaFinanceira,
  TipoLancamentoFinanceiro,
  TipoMovimentacaoFinanceira
} from "../generated/prisma/enums.js"
import { financeiroEmpresarialPreviewHabilitado } from "../config/env.js"
import { prisma } from "../lib/prisma.js"

const MARCADOR = "FIN-PREVIEW-2026-07"

function obrigatoria(nome: string): string {
  const valor = process.env[nome]?.trim()
  if (!valor) throw new Error(`${nome} nao configurada`)
  return valor
}

function dataEm(dias: number): Date {
  const data = new Date()
  data.setUTCHours(12, 0, 0, 0)
  data.setUTCDate(data.getUTCDate() + dias)
  return data
}

function paraJson(valor: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue
}

type LancamentoDemo = {
  tipo: TipoLancamentoFinanceiro
  descricao: string
  contraparte: string
  categoria: string
  centro: string
  valor: string
  vencimentoEm: number
  pago?: string
  pagoEm?: number
  conta?: string
}

const lancamentosDemo: LancamentoDemo[] = [
  { tipo: TipoLancamentoFinanceiro.RECEBER, descricao: "Manutencao de equipamentos", contraparte: "Padaria Central", categoria: "Receita de servicos", centro: "Operacoes", valor: "8800.00", vencimentoEm: -75, pago: "8800.00", pagoEm: -74, conta: "Conta principal" },
  { tipo: TipoLancamentoFinanceiro.PAGAR, descricao: "Compra de componentes", contraparte: "Eletro Parts", categoria: "Pecas e materiais", centro: "Operacoes", valor: "3420.00", vencimentoEm: -70, pago: "3420.00", pagoEm: -69, conta: "Conta principal" },
  { tipo: TipoLancamentoFinanceiro.RECEBER, descricao: "Contrato mensal de suporte", contraparte: "Rede Bom Preco", categoria: "Contratos recorrentes", centro: "Comercial", valor: "4800.00", vencimentoEm: -45, pago: "4800.00", pagoEm: -44, conta: "Recebimentos digitais" },
  { tipo: TipoLancamentoFinanceiro.PAGAR, descricao: "Aluguel da oficina", contraparte: "Imoveis Horizonte", categoria: "Estrutura", centro: "Administrativo", valor: "6200.00", vencimentoEm: -40, pago: "6200.00", pagoEm: -39, conta: "Conta principal" },
  { tipo: TipoLancamentoFinanceiro.RECEBER, descricao: "Instalacao e configuracao", contraparte: "Clinica Nova Vida", categoria: "Receita de servicos", centro: "Operacoes", valor: "9800.00", vencimentoEm: -4, pago: "4000.00", pagoEm: -6, conta: "Conta principal" },
  { tipo: TipoLancamentoFinanceiro.RECEBER, descricao: "Manutencao corretiva", contraparte: "Restaurante Avenida", categoria: "Receita de servicos", centro: "Operacoes", valor: "2650.00", vencimentoEm: -9 },
  { tipo: TipoLancamentoFinanceiro.PAGAR, descricao: "Internet e telefonia", contraparte: "Conecta Telecom", categoria: "Estrutura", centro: "Administrativo", valor: "1180.00", vencimentoEm: -3 },
  { tipo: TipoLancamentoFinanceiro.PAGAR, descricao: "Folha de pagamento", contraparte: "Equipe Servix", categoria: "Pessoal", centro: "Administrativo", valor: "10500.00", vencimentoEm: 2, conta: "Conta principal" },
  { tipo: TipoLancamentoFinanceiro.RECEBER, descricao: "Revisao preventiva", contraparte: "Hotel Estacao", categoria: "Receita de servicos", centro: "Operacoes", valor: "12400.00", vencimentoEm: 3 },
  { tipo: TipoLancamentoFinanceiro.PAGAR, descricao: "Pecas para estoque", contraparte: "Eletro Parts", categoria: "Pecas e materiais", centro: "Operacoes", valor: "2350.00", vencimentoEm: 5 },
  { tipo: TipoLancamentoFinanceiro.PAGAR, descricao: "Impostos do periodo", contraparte: "Receita Federal", categoria: "Impostos e taxas", centro: "Administrativo", valor: "2860.00", vencimentoEm: 18 },
  { tipo: TipoLancamentoFinanceiro.RECEBER, descricao: "Projeto de automacao", contraparte: "Armazem do Vale", categoria: "Receita de servicos", centro: "Comercial", valor: "18500.00", vencimentoEm: 37 }
]

async function executar() {
  if (!financeiroEmpresarialPreviewHabilitado()) {
    throw new Error("SERVIX_FINANCEIRO_MODE precisa ser PREVIEW")
  }
  if (obrigatoria("POPULAR_FINANCEIRO_PREVIEW_CONFIRMAR").toUpperCase() !== "SIM") {
    throw new Error("Defina POPULAR_FINANCEIRO_PREVIEW_CONFIRMAR=SIM")
  }

  const slug = obrigatoria("FINANCEIRO_PREVIEW_EMPRESA_SLUG").toLowerCase()
  const empresa = await prisma.empresa.findUnique({
    where: { slug },
    include: {
      usuarios: {
        where: { ativo: true, papel: PapelUsuario.ADMIN },
        orderBy: { id: "asc" },
        take: 1
      }
    }
  })
  if (!empresa || empresa.status !== StatusEmpresa.ATIVA) {
    throw new Error(`Empresa ativa ${slug} nao encontrada`)
  }
  const usuario = empresa.usuarios[0]
  if (!usuario) throw new Error(`Empresa ${slug} nao possui administrador ativo`)

  const existente = await prisma.lancamentoFinanceiro.findFirst({
    where: {
      empresaId: empresa.id,
      ambiente: AmbienteFinanceiro.PREVIEW,
      documento: { startsWith: MARCADOR }
    },
    select: { id: true }
  })
  if (existente) {
    console.log("Demonstracao financeira preview ja existente:", { empresa: slug })
    return
  }

  const resumo = await prisma.$transaction(async tx => {
    const categoriasDefinidas = [
      ["Receita de servicos", TipoCategoriaFinanceira.RECEITA, "#08A45C"],
      ["Contratos recorrentes", TipoCategoriaFinanceira.RECEITA, "#7257D5"],
      ["Venda de pecas", TipoCategoriaFinanceira.RECEITA, "#1C74E9"],
      ["Pecas e materiais", TipoCategoriaFinanceira.DESPESA, "#D35454"],
      ["Estrutura", TipoCategoriaFinanceira.DESPESA, "#8A5A44"],
      ["Impostos e taxas", TipoCategoriaFinanceira.DESPESA, "#A54C87"],
      ["Pessoal", TipoCategoriaFinanceira.DESPESA, "#D67D1F"]
    ] as const
    const categorias = new Map<string, number>()
    for (const [nome, tipo, cor] of categoriasDefinidas) {
      const categoria = await tx.categoriaFinanceira.upsert({
        where: {
          empresaId_ambiente_tipo_nome: {
            empresaId: empresa.id,
            ambiente: AmbienteFinanceiro.PREVIEW,
            tipo,
            nome
          }
        },
        create: { empresaId: empresa.id, ambiente: AmbienteFinanceiro.PREVIEW, nome, tipo, cor },
        update: { ativa: true, cor }
      })
      categorias.set(nome, categoria.id)
    }

    const centros = new Map<string, number>()
    for (const [nome, codigo] of [["Operacoes", "OPE"], ["Comercial", "COM"], ["Administrativo", "ADM"]] as const) {
      const centro = await tx.centroCustoFinanceiro.upsert({
        where: { empresaId_ambiente_nome: { empresaId: empresa.id, ambiente: AmbienteFinanceiro.PREVIEW, nome } },
        create: { empresaId: empresa.id, ambiente: AmbienteFinanceiro.PREVIEW, nome, codigo },
        update: { ativo: true, codigo }
      })
      centros.set(nome, centro.id)
    }

    const contasDefinidas = [
      ["Conta principal", TipoContaFinanceira.CONTA_BANCARIA, "Banco demonstracao", "30000.00", "#E66B18"],
      ["Recebimentos digitais", TipoContaFinanceira.CARTEIRA_DIGITAL, "Carteira demonstracao", "12000.00", "#168AD8"],
      ["Caixa da oficina", TipoContaFinanceira.CAIXA, "Caixa fisico", "2500.00", "#08A45C"]
    ] as const
    const contas = new Map<string, number>()
    for (const [nome, tipo, instituicao, saldoInicial, cor] of contasDefinidas) {
      const conta = await tx.contaFinanceira.upsert({
        where: { empresaId_ambiente_nome: { empresaId: empresa.id, ambiente: AmbienteFinanceiro.PREVIEW, nome } },
        create: {
          empresaId: empresa.id,
          ambiente: AmbienteFinanceiro.PREVIEW,
          nome,
          tipo,
          instituicao,
          saldoInicial: new Prisma.Decimal(saldoInicial),
          dataSaldoInicial: dataEm(-120),
          cor
        },
        update: { ativa: true, instituicao, cor }
      })
      contas.set(nome, conta.id)
    }

    let movimentacoes = 0
    for (let indice = 0; indice < lancamentosDemo.length; indice += 1) {
      const item = lancamentosDemo[indice]!
      const valor = new Prisma.Decimal(item.valor)
      const pago = new Prisma.Decimal(item.pago ?? 0)
      const vencimento = dataEm(item.vencimentoEm)
      const status = pago.equals(valor)
        ? StatusLancamentoFinanceiro.QUITADO
        : pago.greaterThan(0)
          ? StatusLancamentoFinanceiro.PARCIAL
          : item.vencimentoEm < 0
            ? StatusLancamentoFinanceiro.VENCIDO
            : StatusLancamentoFinanceiro.PENDENTE
      const lancamento = await tx.lancamentoFinanceiro.create({
        data: {
          empresaId: empresa.id,
          ambiente: AmbienteFinanceiro.PREVIEW,
          tipo: item.tipo,
          status,
          origem: OrigemLancamentoFinanceiro.MANUAL,
          descricao: item.descricao,
          contraparte: item.contraparte,
          documento: `${MARCADOR}-${String(indice + 1).padStart(2, "0")}`,
          categoriaId: categorias.get(item.categoria)!,
          centroCustoId: centros.get(item.centro)!,
          ...(item.conta && { contaPreferidaId: contas.get(item.conta)! }),
          valorOriginal: valor,
          valorTotal: valor,
          dataCompetencia: vencimento,
          dataVencimento: vencimento,
          observacao: "Registro ficticio para testes do financeiro preview.",
          criadoPorId: usuario.id,
          criadoEm: dataEm(item.vencimentoEm - 10)
        }
      })
      await tx.auditoriaFinanceira.create({
        data: {
          empresaId: empresa.id,
          ambiente: AmbienteFinanceiro.PREVIEW,
          usuarioId: usuario.id,
          acao: "LANCAMENTO_DEMO_CRIADO",
          entidade: "LancamentoFinanceiro",
          entidadeId: lancamento.id,
          dadosDepois: paraJson(lancamento)
        }
      })

      if (pago.greaterThan(0) && item.conta && item.pagoEm !== undefined) {
        const movimento = await tx.movimentacaoFinanceira.create({
          data: {
            empresaId: empresa.id,
            ambiente: AmbienteFinanceiro.PREVIEW,
            contaId: contas.get(item.conta)!,
            lancamentoId: lancamento.id,
            tipo: item.tipo === TipoLancamentoFinanceiro.RECEBER
              ? TipoMovimentacaoFinanceira.ENTRADA
              : TipoMovimentacaoFinanceira.SAIDA,
            status: StatusMovimentacaoFinanceira.CONFIRMADA,
            valor: pago,
            formaPagamento: item.tipo === TipoLancamentoFinanceiro.RECEBER
              ? FormaPagamento.PIX
              : FormaPagamento.BOLETO,
            descricao: `Baixa demonstrativa: ${item.descricao}`,
            movimentadoEm: dataEm(item.pagoEm),
            registradoPorId: usuario.id
          }
        })
        await tx.auditoriaFinanceira.create({
          data: {
            empresaId: empresa.id,
            ambiente: AmbienteFinanceiro.PREVIEW,
            usuarioId: usuario.id,
            acao: "BAIXA_DEMO_REGISTRADA",
            entidade: "MovimentacaoFinanceira",
            entidadeId: movimento.id,
            dadosDepois: paraJson(movimento)
          }
        })
        movimentacoes += 1
      }
    }

    return {
      empresa: slug,
      categorias: categorias.size,
      centrosCusto: centros.size,
      contas: contas.size,
      lancamentos: lancamentosDemo.length,
      movimentacoes
    }
  }, { maxWait: 10_000, timeout: 60_000 })

  console.log("Demonstracao financeira preview criada:", resumo)
}

executar()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
