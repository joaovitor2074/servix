import { Router } from "express"
import rateLimit from "express-rate-limit"

import { buscarOrdemPublicaController } from "../controllers/ordens-publicas.controllers.js"

const router = Router()

// Mantém as respostas privadas mesmo quando este router é montado isolado
// (por exemplo, em testes) ou quando o limiter dedicado encerra a requisição.
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Robots-Tag", "noindex, nofollow")
  next()
})

// O cliente pode atualizar a linha do tempo periodicamente, mas rajadas acima
// deste limite não são necessárias para a experiência normal de acompanhamento.
const acompanhamentoPublicoLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    erro: "Muitas consultas de acompanhamento. Tente novamente em instantes.",
    codigo: "LIMITE_ACOMPANHAMENTO_PUBLICO_EXCEDIDO"
  }
})

router.get(
  "/:token",
  acompanhamentoPublicoLimiter,
  buscarOrdemPublicaController
)

export default router
