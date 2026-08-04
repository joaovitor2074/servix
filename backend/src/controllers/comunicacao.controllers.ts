import type { NextFunction, Request, Response } from "express"
import {
  enviarMensagemWhatsAppService,
  listarCentralWhatsAppService
} from "../services/comunicacao.service.js"
import { validarPreparacaoMensagemWhatsApp } from "../validators/whatsapp.validators.js"

export async function listarCentralWhatsApp(req: Request, res: Response, next: NextFunction) {
  try {
    return res.json(await listarCentralWhatsAppService(req.auth.empresaId))
  } catch (error) { return next(error) }
}

export async function enviarMensagemWhatsApp(req: Request, res: Response, next: NextFunction) {
  try {
    const validacao = validarPreparacaoMensagemWhatsApp(req.body)
    if (!validacao.valido) {
      return res.status(400).json({ erro: validacao.erro, detalhes: validacao.detalhes })
    }
    return res.json(await enviarMensagemWhatsAppService(
      req.auth.empresaId,
      req.auth.usuarioId,
      validacao.dados
    ))
  } catch (error) { return next(error) }
}
