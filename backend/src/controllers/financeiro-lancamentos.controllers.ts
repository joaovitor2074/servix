import type { NextFunction, Request, Response } from "express"

import { AMBIENTE_FINANCEIRO_PREVIEW } from "../financeiro/financeiro-preview.js"
import {
  atualizarLancamentoFinanceiroService,
  buscarLancamentoFinanceiroService,
  cancelarLancamentoFinanceiroService,
  criarLancamentoFinanceiroService,
  estornarBaixaFinanceiraService,
  listarLancamentosFinanceirosService,
  registrarBaixaFinanceiraService
} from "../services/financeiro-lancamentos.service.js"
import {
  idFinanceiroEhInvalido,
  validarAtualizacaoLancamentoFinanceiro,
  validarCancelamentoLancamentoFinanceiro,
  validarCriacaoLancamentoFinanceiro,
  validarEstornoBaixaFinanceira,
  validarQueryLancamentosFinanceiros,
  validarRegistroBaixaFinanceira
} from "../validators/financeiro.validators.js"

function erroValidacao(res: Response, validacao: {
  erro: string
  detalhes: Array<{ campo: string; mensagem: string }>
}) {
  return res.status(400).json({ erro: validacao.erro, detalhes: validacao.detalhes })
}

function erroConflito(res: Response, versaoEsperada: number, versaoAtual: number) {
  return res.status(409).json({
    erro: "O lançamento foi alterado por outro usuário. Recarregue os dados.",
    codigo: "FINANCEIRO_LANCAMENTO_CONFLITANTE",
    detalhes: { versaoEsperada, versaoAtual }
  })
}

export async function listarLancamentosFinanceirosController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarQueryLancamentosFinanceiros(req.query)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await listarLancamentosFinanceirosService(req.auth.empresaId, validacao.dados)
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, ...resultado })
  } catch (error) { return next(error) }
}

export async function buscarLancamentoFinanceiroController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (idFinanceiroEhInvalido(id)) return res.status(400).json({ erro: "ID inválido" })
    const lancamento = await buscarLancamentoFinanceiroService(id, req.auth.empresaId)
    if (!lancamento) return res.status(404).json({ erro: "Lançamento financeiro não encontrado" })
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, lancamento })
  } catch (error) { return next(error) }
}

export async function criarLancamentoFinanceiroController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarCriacaoLancamentoFinanceiro(req.body)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await criarLancamentoFinanceiroService(req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) {
      return res.status(422).json({
        erro: "Referência financeira inexistente, inativa ou incompatível com o tipo do lançamento",
        codigo: "FINANCEIRO_REFERENCIA_INVALIDA",
        detalhes: { campo: resultado.campo }
      })
    }
    return res.status(201).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, lancamento: resultado.lancamento })
  } catch (error) { return next(error) }
}

export async function atualizarLancamentoFinanceiroController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (idFinanceiroEhInvalido(id)) return res.status(400).json({ erro: "ID inválido" })
    const validacao = validarAtualizacaoLancamentoFinanceiro(req.body)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await atualizarLancamentoFinanceiroService(id, req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) {
      if (resultado.motivo === "lancamento_nao_encontrado") return res.status(404).json({ erro: "Lançamento financeiro não encontrado" })
      if (resultado.motivo === "conflito_atualizacao") return erroConflito(res, validacao.dados.versaoEsperada, resultado.versaoAtual)
      if (resultado.motivo === "referencia_invalida") return res.status(422).json({ erro: "Referência financeira inválida", codigo: "FINANCEIRO_REFERENCIA_INVALIDA", detalhes: { campo: resultado.campo } })
      if (resultado.motivo === "lancamento_possui_baixas") return res.status(409).json({ erro: "Valores e estado não podem ser alterados após uma baixa", codigo: "FINANCEIRO_LANCAMENTO_POSSUI_BAIXAS" })
      if (resultado.motivo === "valores_invalidos") return res.status(400).json({ erro: "A composição do valor total é inválida" })
      return res.status(409).json({ erro: "Lançamento quitado ou cancelado não pode ser alterado", codigo: "FINANCEIRO_LANCAMENTO_BLOQUEADO", detalhes: { statusAtual: resultado.statusAtual } })
    }
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, lancamento: resultado.lancamento })
  } catch (error) { return next(error) }
}

export async function cancelarLancamentoFinanceiroController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (idFinanceiroEhInvalido(id)) return res.status(400).json({ erro: "ID inválido" })
    const validacao = validarCancelamentoLancamentoFinanceiro(req.body)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await cancelarLancamentoFinanceiroService(id, req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) {
      if (resultado.motivo === "lancamento_nao_encontrado") return res.status(404).json({ erro: "Lançamento financeiro não encontrado" })
      if (resultado.motivo === "conflito_atualizacao") return erroConflito(res, validacao.dados.versaoEsperada, resultado.versaoAtual)
      if (resultado.motivo === "lancamento_possui_baixas") return res.status(409).json({ erro: "Estorne as baixas antes de cancelar o lançamento", codigo: "FINANCEIRO_LANCAMENTO_POSSUI_BAIXAS" })
      return res.status(409).json({ erro: "Lançamento já cancelado", codigo: "FINANCEIRO_LANCAMENTO_JA_CANCELADO" })
    }
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, lancamento: resultado.lancamento })
  } catch (error) { return next(error) }
}

export async function registrarBaixaFinanceiraController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (idFinanceiroEhInvalido(id)) return res.status(400).json({ erro: "ID inválido" })
    const validacao = validarRegistroBaixaFinanceira(req.body)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await registrarBaixaFinanceiraService(id, req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) {
      if (resultado.motivo === "lancamento_nao_encontrado") return res.status(404).json({ erro: "Lançamento financeiro não encontrado" })
      if (resultado.motivo === "conflito_atualizacao") return erroConflito(res, validacao.dados.versaoEsperada, resultado.versaoAtual)
      if (resultado.motivo === "conta_invalida") return res.status(422).json({ erro: "Conta financeira inexistente ou inativa", codigo: "FINANCEIRO_CONTA_INVALIDA" })
      if (resultado.motivo === "data_anterior_saldo_inicial") return res.status(422).json({ erro: "A baixa não pode ser anterior ao saldo inicial da conta", codigo: "FINANCEIRO_DATA_ANTERIOR_SALDO_INICIAL", detalhes: { dataSaldoInicial: resultado.dataSaldoInicial } })
      if (resultado.motivo === "valor_excede_saldo") return res.status(409).json({ erro: "A baixa excede o saldo aberto do lançamento", codigo: "FINANCEIRO_BAIXA_EXCEDE_SALDO", detalhes: { saldoAberto: resultado.saldoAberto, valorInformado: resultado.valorInformado } })
      return res.status(409).json({ erro: "O lançamento não aceita novas baixas", codigo: "FINANCEIRO_LANCAMENTO_BLOQUEADO", detalhes: { statusAtual: resultado.statusAtual } })
    }
    return res.status(201).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, movimentacao: resultado.movimentacao, lancamento: resultado.lancamento })
  } catch (error) { return next(error) }
}

export async function estornarBaixaFinanceiraController(req: Request, res: Response, next: NextFunction) {
  try {
    const lancamentoId = Number(req.params.id)
    const movimentacaoId = Number(req.params.movimentacaoId)
    if (idFinanceiroEhInvalido(lancamentoId) || idFinanceiroEhInvalido(movimentacaoId)) return res.status(400).json({ erro: "ID inválido" })
    const validacao = validarEstornoBaixaFinanceira(req.body)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await estornarBaixaFinanceiraService(lancamentoId, movimentacaoId, req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) {
      if (resultado.motivo === "lancamento_nao_encontrado") return res.status(404).json({ erro: "Lançamento financeiro não encontrado" })
      if (resultado.motivo === "movimentacao_nao_encontrada") return res.status(404).json({ erro: "Baixa financeira não encontrada" })
      if (resultado.motivo === "conflito_atualizacao") return erroConflito(res, validacao.dados.versaoEsperada, resultado.versaoAtual)
      return res.status(409).json({ erro: "Baixa já estornada", codigo: "FINANCEIRO_BAIXA_JA_ESTORNADA" })
    }
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, movimentacao: resultado.movimentacao, lancamento: resultado.lancamento })
  } catch (error) { return next(error) }
}
