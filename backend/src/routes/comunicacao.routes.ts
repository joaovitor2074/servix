import { Router } from "express"
import {
  enviarMensagemWhatsApp,
  listarCentralWhatsApp
} from "../controllers/comunicacao.controllers.js"

const router = Router()
router.get("/whatsapp", listarCentralWhatsApp)
router.post("/whatsapp/enviar", enviarMensagemWhatsApp)
export default router
