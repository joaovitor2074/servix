import { z } from "zod"

import {
  FormaPagamento,
  StatusLancamentoFinanceiro,
  TipoCategoriaFinanceira,
  TipoContaFinanceira,
  TipoLancamentoFinanceiro
} from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

const dinheiroSchema = z
  .number()
  .finite()
  .min(0)
  .max(99_999_999.99)
  .multipleOf(0.01)

const dinheiroPositivoSchema = dinheiroSchema.positive()

const idSchema = z.number().int().positive()

const corHexSchema = z.preprocess(
  valor => valor === "" ? null : valor,
  z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve usar o formato #RRGGBB").nullable().optional()
)

const textoOpcional = (limite: number) =>
  z.preprocess(
    valor => valor === "" ? null : valor,
    z.string().trim().min(1).max(limite).nullable().optional()
  )

const dataCivilSchema = z.string().trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve usar AAAA-MM-DD")
  .refine(valor => {
    const [anoTexto, mesTexto, diaTexto] = valor.split("-")
    const ano = Number(anoTexto)
    const mes = Number(mesTexto)
    const dia = Number(diaTexto)
    const data = new Date(Date.UTC(ano, mes - 1, dia))
    return data.getUTCFullYear() === ano &&
      data.getUTCMonth() === mes - 1 &&
      data.getUTCDate() === dia
  }, { message: "Data civil inválida" })

const instanteComFusoSchema = z.string().trim().datetime({
  offset: true,
  message: "Instante deve ser ISO 8601 com Z ou offset"
})

// Datas financeiras aceitam um dia civil real ou um instante inequívoco com
// fuso. Dias inexistentes e timestamps locais ambíguos são sempre rejeitados.
const dataFinanceiraSchema = z
  .union([dataCivilSchema, instanteComFusoSchema])
  .transform(valor => /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T12:00:00.000Z`)
    : new Date(valor))

const booleanoQuerySchema = z.preprocess(valor => {
  if (valor === "true") return true
  if (valor === "false") return false
  return valor
}, z.boolean())

const paginacaoSchema = {
  pagina: z.coerce.number().int().positive().default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20)
}

const tipoCategoriaSchema = z.enum([
  TipoCategoriaFinanceira.RECEITA,
  TipoCategoriaFinanceira.DESPESA
])

const tipoLancamentoSchema = z.enum([
  TipoLancamentoFinanceiro.RECEBER,
  TipoLancamentoFinanceiro.PAGAR
])

const statusLancamentoSchema = z.enum([
  StatusLancamentoFinanceiro.RASCUNHO,
  StatusLancamentoFinanceiro.PENDENTE,
  StatusLancamentoFinanceiro.PARCIAL,
  StatusLancamentoFinanceiro.QUITADO,
  StatusLancamentoFinanceiro.VENCIDO,
  StatusLancamentoFinanceiro.CANCELADO
])

const statusEditavelSchema = z.enum([
  StatusLancamentoFinanceiro.RASCUNHO,
  StatusLancamentoFinanceiro.PENDENTE
])

const tipoContaSchema = z.enum([
  TipoContaFinanceira.CAIXA,
  TipoContaFinanceira.CONTA_BANCARIA,
  TipoContaFinanceira.CARTEIRA_DIGITAL,
  TipoContaFinanceira.OUTRA
])

const formaPagamentoRegistradaSchema = z.enum([
  FormaPagamento.PIX,
  FormaPagamento.DINHEIRO,
  FormaPagamento.CARTAO_CREDITO,
  FormaPagamento.CARTAO_DEBITO,
  FormaPagamento.BOLETO,
  FormaPagamento.OUTRO
])

export const criarCategoriaFinanceiraSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  tipo: tipoCategoriaSchema,
  cor: corHexSchema,
  descricao: textoOpcional(300)
}).strict()

export const atualizarCategoriaFinanceiraSchema = z.object({
  nome: z.string().trim().min(2).max(80).optional(),
  cor: corHexSchema,
  descricao: textoOpcional(300),
  ativa: z.boolean().optional()
}).strict().refine(dados => Object.keys(dados).length > 0, {
  message: "Informe ao menos um campo para atualização"
})

export const listarCategoriasFinanceirasQuerySchema = z.object({
  tipo: tipoCategoriaSchema.optional(),
  ativa: booleanoQuerySchema.optional()
}).strict()

export const criarCentroCustoFinanceiroSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  codigo: textoOpcional(30),
  descricao: textoOpcional(300)
}).strict()

export const atualizarCentroCustoFinanceiroSchema = z.object({
  nome: z.string().trim().min(2).max(100).optional(),
  codigo: textoOpcional(30),
  descricao: textoOpcional(300),
  ativo: z.boolean().optional()
}).strict().refine(dados => Object.keys(dados).length > 0, {
  message: "Informe ao menos um campo para atualização"
})

export const listarCentrosCustoFinanceirosQuerySchema = z.object({
  ativo: booleanoQuerySchema.optional()
}).strict()

export const criarContaFinanceiraSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  tipo: tipoContaSchema,
  instituicao: textoOpcional(100),
  cor: corHexSchema,
  saldoInicial: dinheiroSchema.default(0),
  dataSaldoInicial: dataFinanceiraSchema,
  descricao: textoOpcional(300)
}).strict()

export const atualizarContaFinanceiraSchema = z.object({
  nome: z.string().trim().min(2).max(100).optional(),
  tipo: tipoContaSchema.optional(),
  instituicao: textoOpcional(100),
  cor: corHexSchema,
  descricao: textoOpcional(300),
  ativa: z.boolean().optional()
}).strict().refine(dados => Object.keys(dados).length > 0, {
  message: "Informe ao menos um campo para atualização"
})

export const listarContasFinanceirasQuerySchema = z.object({
  ativa: booleanoQuerySchema.optional()
}).strict()

const camposLancamento = {
  tipo: tipoLancamentoSchema,
  status: statusEditavelSchema.default(StatusLancamentoFinanceiro.PENDENTE),
  descricao: z.string().trim().min(2).max(200),
  documento: textoOpcional(80),
  contraparte: textoOpcional(160),
  clienteId: idSchema.nullable().optional(),
  categoriaId: idSchema,
  centroCustoId: idSchema.nullable().optional(),
  contaPreferidaId: idSchema.nullable().optional(),
  valorOriginal: dinheiroPositivoSchema,
  desconto: dinheiroSchema.default(0),
  juros: dinheiroSchema.default(0),
  multa: dinheiroSchema.default(0),
  dataCompetencia: dataFinanceiraSchema,
  dataVencimento: dataFinanceiraSchema,
  observacao: textoOpcional(1000)
}

export const criarLancamentoFinanceiroSchema = z.object(camposLancamento)
  .strict()
  .refine(dados => dados.desconto <= dados.valorOriginal, {
    path: ["desconto"],
    message: "Desconto não pode superar o valor original"
  })
  .refine(
    dados => dados.valorOriginal - dados.desconto + dados.juros + dados.multa > 0,
    { path: ["valorOriginal"], message: "Valor total deve ser positivo" }
  )

export const atualizarLancamentoFinanceiroSchema = z.object({
  versaoEsperada: z.number().int().positive(),
  status: statusEditavelSchema.optional(),
  descricao: camposLancamento.descricao.optional(),
  documento: camposLancamento.documento,
  contraparte: camposLancamento.contraparte,
  clienteId: camposLancamento.clienteId,
  categoriaId: camposLancamento.categoriaId.optional(),
  centroCustoId: camposLancamento.centroCustoId,
  contaPreferidaId: camposLancamento.contaPreferidaId,
  valorOriginal: camposLancamento.valorOriginal.optional(),
  desconto: dinheiroSchema.optional(),
  juros: dinheiroSchema.optional(),
  multa: dinheiroSchema.optional(),
  dataCompetencia: camposLancamento.dataCompetencia.optional(),
  dataVencimento: camposLancamento.dataVencimento.optional(),
  observacao: camposLancamento.observacao
}).strict().refine(dados => Object.keys(dados).length > 1, {
  message: "Informe ao menos um campo para atualização"
})

export const listarLancamentosFinanceirosQuerySchema = z.object({
  ...paginacaoSchema,
  tipo: tipoLancamentoSchema.optional(),
  status: statusLancamentoSchema.optional(),
  categoriaId: z.coerce.number().int().positive().optional(),
  centroCustoId: z.coerce.number().int().positive().optional(),
  contaPreferidaId: z.coerce.number().int().positive().optional(),
  clienteId: z.coerce.number().int().positive().optional(),
  vencimentoInicio: dataFinanceiraSchema.optional(),
  vencimentoFim: dataFinanceiraSchema.optional(),
  busca: z.string().trim().max(120).optional()
}).strict()

export const registrarBaixaFinanceiraSchema = z.object({
  contaId: idSchema,
  valor: dinheiroPositivoSchema,
  formaPagamento: formaPagamentoRegistradaSchema,
  movimentadoEm: dataFinanceiraSchema,
  observacao: textoOpcional(500),
  versaoEsperada: z.number().int().positive()
}).strict()

export const estornarMovimentacaoFinanceiraSchema = z.object({
  motivo: z.string().trim().min(3).max(500),
  versaoEsperada: z.number().int().positive().optional()
}).strict()

export const estornarBaixaFinanceiraSchema = z.object({
  motivo: z.string().trim().min(3).max(500),
  versaoEsperada: z.number().int().positive()
}).strict()

export const cancelarLancamentoFinanceiroSchema = z.object({
  motivo: z.string().trim().min(3).max(500),
  versaoEsperada: z.number().int().positive()
}).strict()

export const criarAjusteFinanceiroSchema = z.object({
  contaId: idSchema,
  direcao: z.enum(["ENTRADA", "SAIDA"]),
  valor: dinheiroPositivoSchema,
  descricao: z.string().trim().min(3).max(200),
  documento: textoOpcional(80),
  movimentadoEm: dataFinanceiraSchema
}).strict()

export const criarTransferenciaFinanceiraSchema = z.object({
  contaOrigemId: idSchema,
  contaDestinoId: idSchema,
  valor: dinheiroPositivoSchema,
  descricao: z.string().trim().min(3).max(200),
  movimentadoEm: dataFinanceiraSchema
}).strict().refine(dados => dados.contaOrigemId !== dados.contaDestinoId, {
  path: ["contaDestinoId"],
  message: "Contas de origem e destino devem ser diferentes"
})

export const listarMovimentacoesFinanceirasQuerySchema = z.object({
  ...paginacaoSchema,
  contaId: z.coerce.number().int().positive().optional(),
  inicio: dataFinanceiraSchema.optional(),
  fim: dataFinanceiraSchema.optional(),
  incluirEstornadas: booleanoQuerySchema.default(false)
}).strict()

export const periodoFinanceiroQuerySchema = z.object({
  inicio: dataFinanceiraSchema,
  fim: dataFinanceiraSchema
}).strict().refine(dados => dados.inicio <= dados.fim, {
  path: ["fim"],
  message: "Data final deve ser igual ou posterior à inicial"
})

export const listarAuditoriaFinanceiraQuerySchema = z.object({
  ...paginacaoSchema,
  entidade: z.string().trim().max(80).optional(),
  entidadeId: z.coerce.number().int().positive().optional()
}).strict()

export type CriarCategoriaFinanceiraInput = z.infer<typeof criarCategoriaFinanceiraSchema>
export type AtualizarCategoriaFinanceiraInput = z.infer<typeof atualizarCategoriaFinanceiraSchema>
export type ListarCategoriasFinanceirasQuery = z.infer<typeof listarCategoriasFinanceirasQuerySchema>
export type CriarCentroCustoFinanceiroInput = z.infer<typeof criarCentroCustoFinanceiroSchema>
export type AtualizarCentroCustoFinanceiroInput = z.infer<typeof atualizarCentroCustoFinanceiroSchema>
export type ListarCentrosCustoFinanceirosQuery = z.infer<typeof listarCentrosCustoFinanceirosQuerySchema>
export type CriarContaFinanceiraInput = z.infer<typeof criarContaFinanceiraSchema>
export type AtualizarContaFinanceiraInput = z.infer<typeof atualizarContaFinanceiraSchema>
export type ListarContasFinanceirasQuery = z.infer<typeof listarContasFinanceirasQuerySchema>
export type CriarLancamentoFinanceiroInput = z.infer<typeof criarLancamentoFinanceiroSchema>
export type AtualizarLancamentoFinanceiroInput = z.infer<typeof atualizarLancamentoFinanceiroSchema>
export type ListarLancamentosFinanceirosQuery = z.infer<typeof listarLancamentosFinanceirosQuerySchema>
export type RegistrarBaixaFinanceiraInput = z.infer<typeof registrarBaixaFinanceiraSchema>
export type EstornarMovimentacaoFinanceiraInput = z.infer<typeof estornarMovimentacaoFinanceiraSchema>
export type EstornarBaixaFinanceiraInput = z.infer<typeof estornarBaixaFinanceiraSchema>
export type CancelarLancamentoFinanceiroInput = z.infer<typeof cancelarLancamentoFinanceiroSchema>
export type CriarAjusteFinanceiroInput = z.infer<typeof criarAjusteFinanceiroSchema>
export type CriarTransferenciaFinanceiraInput = z.infer<typeof criarTransferenciaFinanceiraSchema>
export type ListarMovimentacoesFinanceirasQuery = z.infer<typeof listarMovimentacoesFinanceirasQuerySchema>
export type PeriodoFinanceiroQuery = z.infer<typeof periodoFinanceiroQuerySchema>
export type ListarAuditoriaFinanceiraQuery = z.infer<typeof listarAuditoriaFinanceiraQuerySchema>

export const validarCriacaoCategoriaFinanceira = (dados: unknown) => validarComSchema(criarCategoriaFinanceiraSchema, dados)
export const validarAtualizacaoCategoriaFinanceira = (dados: unknown) => validarComSchema(atualizarCategoriaFinanceiraSchema, dados)
export const validarQueryCategoriasFinanceiras = (dados: unknown) => validarComSchema(listarCategoriasFinanceirasQuerySchema, dados)
export const validarCriacaoCentroCustoFinanceiro = (dados: unknown) => validarComSchema(criarCentroCustoFinanceiroSchema, dados)
export const validarAtualizacaoCentroCustoFinanceiro = (dados: unknown) => validarComSchema(atualizarCentroCustoFinanceiroSchema, dados)
export const validarQueryCentrosCustoFinanceiros = (dados: unknown) => validarComSchema(listarCentrosCustoFinanceirosQuerySchema, dados)
export const validarCriacaoContaFinanceira = (dados: unknown) => validarComSchema(criarContaFinanceiraSchema, dados)
export const validarAtualizacaoContaFinanceira = (dados: unknown) => validarComSchema(atualizarContaFinanceiraSchema, dados)
export const validarQueryContasFinanceiras = (dados: unknown) => validarComSchema(listarContasFinanceirasQuerySchema, dados)
export const validarCriacaoLancamentoFinanceiro = (dados: unknown) => validarComSchema(criarLancamentoFinanceiroSchema, dados)
export const validarAtualizacaoLancamentoFinanceiro = (dados: unknown) => validarComSchema(atualizarLancamentoFinanceiroSchema, dados)
export const validarQueryLancamentosFinanceiros = (dados: unknown) => validarComSchema(listarLancamentosFinanceirosQuerySchema, dados)
export const validarRegistroBaixaFinanceira = (dados: unknown) => validarComSchema(registrarBaixaFinanceiraSchema, dados)
export const validarEstornoMovimentacaoFinanceira = (dados: unknown) => validarComSchema(estornarMovimentacaoFinanceiraSchema, dados)
export const validarEstornoBaixaFinanceira = (dados: unknown) => validarComSchema(estornarBaixaFinanceiraSchema, dados)
export const validarCancelamentoLancamentoFinanceiro = (dados: unknown) => validarComSchema(cancelarLancamentoFinanceiroSchema, dados)
export const validarCriacaoAjusteFinanceiro = (dados: unknown) => validarComSchema(criarAjusteFinanceiroSchema, dados)
export const validarCriacaoTransferenciaFinanceira = (dados: unknown) => validarComSchema(criarTransferenciaFinanceiraSchema, dados)
export const validarQueryMovimentacoesFinanceiras = (dados: unknown) => validarComSchema(listarMovimentacoesFinanceirasQuerySchema, dados)
export const validarPeriodoFinanceiro = (dados: unknown) => validarComSchema(periodoFinanceiroQuerySchema, dados)
export const validarQueryAuditoriaFinanceira = (dados: unknown) => validarComSchema(listarAuditoriaFinanceiraQuerySchema, dados)

export function idFinanceiroEhInvalido(id: number): boolean {
  return !Number.isInteger(id) || id <= 0
}
