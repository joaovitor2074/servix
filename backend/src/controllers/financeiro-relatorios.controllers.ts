import type { NextFunction, Request, Response } from "express"

import {
  buscarDashboardFinanceiroService,
  buscarFluxoCaixaFinanceiroService,
  buscarResumoServicosFinanceiroService,
  listarAuditoriaFinanceiraService
} from "../services/financeiro-relatorios.service.js"
import {
  validarPeriodoFinanceiro,
  validarQueryAuditoriaFinanceira
} from "../validators/financeiro.validators.js"

function erroValidacao(res: Response, validacao: {
  erro: string
  detalhes: Array<{ campo: string; mensagem: string }>
}) {
  return res.status(400).json({ erro: validacao.erro, detalhes: validacao.detalhes })
}
export async function buscarDashboardFinanceiroController(req: Request, res: Response, next: NextFunction) {
  try {
    const dashboard = await buscarDashboardFinanceiroService(req.auth.empresaId)
    return res.status(200).json(dashboard)
  } catch (error) { return next(error) }
}

export async function buscarResumoServicosFinanceiroController(req: Request, res: Response, next: NextFunction) {
  try {
    const resumo = await buscarResumoServicosFinanceiroService(req.auth.empresaId)
    return res.status(200).json(resumo)
  } catch (error) { return next(error) }
}

export async function buscarFluxoCaixaFinanceiroController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarPeriodoFinanceiro(req.query)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await buscarFluxoCaixaFinanceiroService(req.auth.empresaId, validacao.dados)
    if (!resultado.sucesso) return res.status(400).json({ erro: "O período do fluxo de caixa não pode superar 366 dias", codigo: "FINANCEIRO_PERIODO_MUITO_LONGO" })
    return res.status(200).json(resultado.fluxo)
  } catch (error) { return next(error) }
}

export async function listarAuditoriaFinanceiraController(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarQueryAuditoriaFinanceira(req.query)
    if (!validacao.valido) return erroValidacao(res, validacao)
    const resultado = await listarAuditoriaFinanceiraService(req.auth.empresaId, validacao.dados)
    return res.status(200).json({ ambiente: "PREVIEW", ...resultado })
  } catch (error) { return next(error) }
}
