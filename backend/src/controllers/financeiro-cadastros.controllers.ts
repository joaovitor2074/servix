import type { NextFunction, Request, Response } from "express"

import { AMBIENTE_FINANCEIRO_PREVIEW } from "../financeiro/financeiro-preview.js"
import {
  atualizarCategoriaFinanceiraService,
  atualizarCentroCustoFinanceiroService,
  atualizarContaFinanceiraService,
  criarCategoriaFinanceiraService,
  criarCentroCustoFinanceiroService,
  criarContaFinanceiraService,
  listarCategoriasFinanceirasService,
  listarCentrosCustoFinanceirosService,
  listarContasFinanceirasService
} from "../services/financeiro-cadastros.service.js"
import {
  idFinanceiroEhInvalido,
  validarAtualizacaoCategoriaFinanceira,
  validarAtualizacaoCentroCustoFinanceiro,
  validarAtualizacaoContaFinanceira,
  validarCriacaoCategoriaFinanceira,
  validarCriacaoCentroCustoFinanceiro,
  validarCriacaoContaFinanceira,
  validarQueryCategoriasFinanceiras,
  validarQueryCentrosCustoFinanceiros,
  validarQueryContasFinanceiras
} from "../validators/financeiro.validators.js"

function responderValidacao(res: Response, validacao: {
  erro: string
  detalhes: Array<{ campo: string; mensagem: string }>
}) {
  return res.status(400).json({
    erro: validacao.erro,
    detalhes: validacao.detalhes
  })
}
export async function listarCategoriasFinanceirasController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarQueryCategoriasFinanceiras(req.query)
    if (!validacao.valido) return responderValidacao(res, validacao)
    const dados = await listarCategoriasFinanceirasService(req.auth.empresaId, validacao.dados)
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, dados })
  } catch (error) { return next(error) }
}

export async function criarCategoriaFinanceiraController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarCriacaoCategoriaFinanceira(req.body)
    if (!validacao.valido) return responderValidacao(res, validacao)
    const resultado = await criarCategoriaFinanceiraService(req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) return res.status(409).json({ erro: "Já existe uma categoria com este nome e tipo", codigo: "FINANCEIRO_CATEGORIA_DUPLICADA" })
    return res.status(201).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, categoria: resultado.categoria })
  } catch (error) { return next(error) }
}

export async function atualizarCategoriaFinanceiraController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (idFinanceiroEhInvalido(id)) return res.status(400).json({ erro: "ID inválido" })
    const validacao = validarAtualizacaoCategoriaFinanceira(req.body)
    if (!validacao.valido) return responderValidacao(res, validacao)
    const resultado = await atualizarCategoriaFinanceiraService(id, req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) {
      if (resultado.motivo === "categoria_nao_encontrada") return res.status(404).json({ erro: "Categoria financeira não encontrada" })
      return res.status(409).json({ erro: "Já existe uma categoria com este nome e tipo", codigo: "FINANCEIRO_CATEGORIA_DUPLICADA" })
    }
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, categoria: resultado.categoria })
  } catch (error) { return next(error) }
}

export async function listarCentrosCustoFinanceirosController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarQueryCentrosCustoFinanceiros(req.query)
    if (!validacao.valido) return responderValidacao(res, validacao)
    const dados = await listarCentrosCustoFinanceirosService(req.auth.empresaId, validacao.dados)
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, dados })
  } catch (error) { return next(error) }
}

export async function criarCentroCustoFinanceiroController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarCriacaoCentroCustoFinanceiro(req.body)
    if (!validacao.valido) return responderValidacao(res, validacao)
    const resultado = await criarCentroCustoFinanceiroService(req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) return res.status(409).json({ erro: "Centro de custo já cadastrado", codigo: "FINANCEIRO_CENTRO_CUSTO_DUPLICADO" })
    return res.status(201).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, centroCusto: resultado.centroCusto })
  } catch (error) { return next(error) }
}

export async function atualizarCentroCustoFinanceiroController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (idFinanceiroEhInvalido(id)) return res.status(400).json({ erro: "ID inválido" })
    const validacao = validarAtualizacaoCentroCustoFinanceiro(req.body)
    if (!validacao.valido) return responderValidacao(res, validacao)
    const resultado = await atualizarCentroCustoFinanceiroService(id, req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) {
      if (resultado.motivo === "centro_custo_nao_encontrado") return res.status(404).json({ erro: "Centro de custo não encontrado" })
      return res.status(409).json({ erro: "Centro de custo já cadastrado", codigo: "FINANCEIRO_CENTRO_CUSTO_DUPLICADO" })
    }
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, centroCusto: resultado.centroCusto })
  } catch (error) { return next(error) }
}

export async function listarContasFinanceirasController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarQueryContasFinanceiras(req.query)
    if (!validacao.valido) return responderValidacao(res, validacao)
    const dados = await listarContasFinanceirasService(req.auth.empresaId, validacao.dados)
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, dados })
  } catch (error) { return next(error) }
}

export async function criarContaFinanceiraController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarCriacaoContaFinanceira(req.body)
    if (!validacao.valido) return responderValidacao(res, validacao)
    const resultado = await criarContaFinanceiraService(req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) return res.status(409).json({ erro: "Conta financeira já cadastrada", codigo: "FINANCEIRO_CONTA_DUPLICADA" })
    return res.status(201).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, conta: resultado.conta })
  } catch (error) { return next(error) }
}

export async function atualizarContaFinanceiraController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (idFinanceiroEhInvalido(id)) return res.status(400).json({ erro: "ID inválido" })
    const validacao = validarAtualizacaoContaFinanceira(req.body)
    if (!validacao.valido) return responderValidacao(res, validacao)
    const resultado = await atualizarContaFinanceiraService(id, req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    if (!resultado.sucesso) {
      if (resultado.motivo === "conta_nao_encontrada") return res.status(404).json({ erro: "Conta financeira não encontrada" })
      return res.status(409).json({ erro: "Conta financeira já cadastrada", codigo: "FINANCEIRO_CONTA_DUPLICADA" })
    }
    return res.status(200).json({ ambiente: AMBIENTE_FINANCEIRO_PREVIEW, conta: resultado.conta })
  } catch (error) { return next(error) }
}
