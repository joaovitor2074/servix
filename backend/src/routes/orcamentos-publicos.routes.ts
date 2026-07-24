import { Router } from "express"
import rateLimit from "express-rate-limit"

import {
  buscarCobrancaPublicaController,
  criarCobrancaPublicaController
} from "../controllers/cobrancas-publicas.controllers.js"
import {
  aprovarOrcamentoPublico,
  buscarOrcamentoPublico,
  rejeitarOrcamentoPublico
} from "../controllers/orcamentos.controllers.js"

// Router publico: o token imprevisivel identifica o orcamento e nenhuma rota
// abaixo depende de req.auth.
const router = Router()

// A geracao aciona um gateway e recebe uma protecao menor que o limite global.
// A consulta fica fora deste limiter para permitir polling do estado do Pix.
const geracaoCobrancaPublicaLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    erro: "Muitas tentativas de gerar cobranca. Tente novamente em instantes.",
    codigo: "LIMITE_COBRANCA_PUBLICA_EXCEDIDO"
  }
})

router.get("/:token", buscarOrcamentoPublico)
router.post("/:token/aprovar", aprovarOrcamentoPublico)
router.post("/:token/rejeitar", rejeitarOrcamentoPublico)
router.get("/:token/cobranca", buscarCobrancaPublicaController)
router.post(
  "/:token/cobrancas",
  geracaoCobrancaPublicaLimiter,
  criarCobrancaPublicaController
)

export default router
