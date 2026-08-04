import type { NextFunction, Request, Response } from "express"
import {
  atualizarConfiguracaoWhatsAppService,
  buscarConfiguracaoWhatsAppService,
  testarConexaoWhatsAppService
} from "../services/configuracoes-whatsapp.service.js"
import { validarAtualizacaoConfiguracaoWhatsApp } from "../validators/whatsapp.validators.js"

export async function buscarConfiguracaoWhatsApp(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    return res.json(await buscarConfiguracaoWhatsAppService(req.auth.empresaId))
  } catch (error) { return next(error) }
}

export async function atualizarConfiguracaoWhatsApp(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarAtualizacaoConfiguracaoWhatsApp(req.body)
    if (!validacao.valido) {
      return res.status(400).json({ erro: validacao.erro, detalhes: validacao.detalhes })
    }
    return res.json(await atualizarConfiguracaoWhatsAppService(
      req.auth.empresaId,
      validacao.dados
    ))
  } catch (error) { return next(error) }
}

export async function testarConexaoWhatsApp(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    return res.json(await testarConexaoWhatsAppService(req.auth.empresaId))
  } catch (error) { return next(error) }
}
