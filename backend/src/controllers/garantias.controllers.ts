import type { NextFunction, Request, Response } from "express"

import {
  acionarGarantiaService,
  buscarGarantiaService,
  cancelarGarantiaService,
  listarGarantiasService
} from "../services/garantias.service.js"
import {
  validarAcionamentoGarantia,
  validarCancelamentoGarantia,
  validarQueryGarantias
} from "../validators/garantias.validators.js"

export async function listarGarantias(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarQueryGarantias(req.query)
    if (!validacao.valido) return res.status(400).json({ erro: validacao.erro, detalhes: validacao.detalhes })
    return res.json(await listarGarantiasService(req.auth.empresaId, validacao.dados))
  } catch (error) { return next(error) }
}

export async function buscarGarantia(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: "ID inválido" })
    const garantia = await buscarGarantiaService(id, req.auth.empresaId)
    return garantia ? res.json(garantia) : res.status(404).json({ erro: "Garantia não encontrada" })
  } catch (error) { return next(error) }
}

export async function acionarGarantia(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: "ID inválido" })
    const validacao = validarAcionamentoGarantia(req.body)
    if (!validacao.valido) return res.status(400).json({ erro: validacao.erro, detalhes: validacao.detalhes })
    return res.json(await acionarGarantiaService(id, req.auth.empresaId, validacao.dados.observacao))
  } catch (error) { return next(error) }
}

export async function cancelarGarantia(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ erro: "ID inválido" })
    const validacao = validarCancelamentoGarantia(req.body)
    if (!validacao.valido) return res.status(400).json({ erro: validacao.erro, detalhes: validacao.detalhes })
    return res.json(await cancelarGarantiaService(id, req.auth.empresaId, validacao.dados.observacao))
  } catch (error) { return next(error) }
}
