import type { NextFunction, Request, Response } from "express"

import { AMBIENTE_FINANCEIRO_PREVIEW } from "../financeiro/financeiro-preview.js"
import {
  criarAjusteFinanceiroService,
  criarTransferenciaFinanceiraService,
  estornarMovimentacaoAvulsaFinanceiraService,
  listarMovimentacoesFinanceirasService
} from "../services/financeiro-movimentacoes.service.js"
import {
  idFinanceiroEhInvalido,
  validarCriacaoAjusteFinanceiro,
  validarCriacaoTransferenciaFinanceira,
  validarEstornoMovimentacaoFinanceira,
  validarQueryMovimentacoesFinanceiras
} from "../validators/financeiro.validators.js"

function erroValidacao(res: Response, validacao: {
  erro: string
  detalhes: Array<{ campo: string; mensagem: string }>
}) {
  return res.status(400).json({ erro: validacao.erro, detalhes: validacao.detalhes })
}

export async function listarMovimentacoesFinanceirasController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarQueryMovimentacoesFinanceiras(req.query)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await listarMovimentacoesFinanceirasService(req.auth.empresaId, validacao.dados)
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, ...resultado })
  } catch (error) { return next(error) }
}

export async function criarAjusteFinanceiroController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarCriacaoAjusteFinanceiro(req.body)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await criarAjusteFinanceiroService(req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) {
      if (resultado.motivo === "data_anterior_saldo_inicial") return res.status(422).json({ erro: "O ajuste não pode ser anterior ao saldo inicial da conta", codigo: "FINANCEIRO_DATA_ANTERIOR_SALDO_INICIAL", detalhes: { dataSaldoInicial: resultado.dataSaldoInicial } })
      return res.status(422).json({ erro: "Conta financeira inexistente ou inativa", codigo: "FINANCEIRO_CONTA_INVALIDA" })
    }
    return res.status(201).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, movimentacao: resultado.movimentacao })
  } catch (error) { return next(error) }
}

export async function criarTransferenciaFinanceiraController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarCriacaoTransferenciaFinanceira(req.body)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await criarTransferenciaFinanceiraService(req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) {
      if (resultado.motivo === "data_anterior_saldo_inicial") return res.status(422).json({ erro: "A transferência não pode ser anterior ao saldo inicial das contas", codigo: "FINANCEIRO_DATA_ANTERIOR_SALDO_INICIAL", detalhes: { contaId: resultado.contaId, dataSaldoInicial: resultado.dataSaldoInicial } })
      return res.status(422).json({ erro: "Conta de origem ou destino inexistente ou inativa", codigo: "FINANCEIRO_CONTA_INVALIDA" })
    }
    return res.status(201).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, transferencia: resultado.transferencia })
  } catch (error) { return next(error) }
}

export async function estornarMovimentacaoFinanceiraController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (idFinanceiroEhInvalido(id)) return res.status(400).json({ erro: "ID inválido" })
    const validacao = validarEstornoMovimentacaoFinanceira(req.body)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await estornarMovimentacaoAvulsaFinanceiraService(id, req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) {
      if (resultado.motivo === "movimentacao_nao_encontrada") return res.status(404).json({ erro: "Movimentação financeira não encontrada" })
      if (resultado.motivo === "movimentacao_vinculada") return res.status(409).json({ erro: "Use o estorno da baixa no lançamento relacionado", codigo: "FINANCEIRO_MOVIMENTACAO_VINCULADA" })
      return res.status(409).json({ erro: "Movimentação já estornada", codigo: "FINANCEIRO_MOVIMENTACAO_JA_ESTORNADA" })
    }
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, movimentacoes: resultado.movimentacoes })
  } catch (error) { return next(error) }
}
