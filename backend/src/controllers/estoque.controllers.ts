import type { NextFunction, Request, Response } from "express"

import {
  atualizarProdutoEstoqueService,
  criarProdutoEstoqueService,
  listarMovimentacoesEstoqueService,
  listarProdutosEstoqueService,
  movimentarEstoqueService
} from "../services/estoque.service.js"
import {
  validarAtualizacaoProdutoEstoque,
  validarCriacaoProdutoEstoque,
  validarMovimentacaoEstoque,
  validarQueryEstoque,
  validarQueryMovimentacoesEstoque
} from "../validators/estoque.validators.js"

function responderValidacao(res: Response, validacao: { erro: string; detalhes?: unknown }) {
  return res.status(400).json({ erro: validacao.erro, detalhes: validacao.detalhes })
}

export async function listarProdutosEstoque(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarQueryEstoque(req.query)
    if (!validacao.valido) return responderValidacao(res, validacao)
    return res.json(await listarProdutosEstoqueService(req.auth.empresaId, validacao.dados))
  } catch (error) { return next(error) }
}

export async function criarProdutoEstoque(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarCriacaoProdutoEstoque(req.body)
    if (!validacao.valido) return responderValidacao(res, validacao)
    const produto = await criarProdutoEstoqueService(req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    return res.status(201).json(produto)
  } catch (error) { return next(error) }
}

export async function atualizarProdutoEstoque(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: "ID inválido" })
    const validacao = validarAtualizacaoProdutoEstoque(req.body)
    if (!validacao.valido) return responderValidacao(res, validacao)
    return res.json(await atualizarProdutoEstoqueService(id, req.auth.empresaId, validacao.dados))
  } catch (error) { return next(error) }
}

export async function registrarMovimentacaoEstoque(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarMovimentacaoEstoque(req.body)
    if (!validacao.valido) return responderValidacao(res, validacao)
    const resultado = await movimentarEstoqueService(req.auth.empresaId, req.auth.usuarioId, validacao.dados)
    return res.status(201).json(resultado)
  } catch (error) { return next(error) }
}

export async function listarMovimentacoesEstoque(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarQueryMovimentacoesEstoque(req.query)
    if (!validacao.valido) return responderValidacao(res, validacao)
    return res.json(await listarMovimentacoesEstoqueService(req.auth.empresaId, validacao.dados))
  } catch (error) { return next(error) }
}
