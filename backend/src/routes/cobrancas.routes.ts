import { Router } from "express"

import {
  buscarCobrancaController,
  confirmarCobrancaSimuladaController,
  criarCobrancaController,
  listarCobrancasController,
  permitirSimulacaoForaDeProducao
} from "../controllers/cobrancas.controllers.js"
import { PapelUsuario } from "../generated/prisma/enums.js"
import { autorizar } from "../middlewares/auth.middleware.js"

const router = Router()

// A leitura acompanha as permissoes do ledger da OS: qualquer usuario
// autenticado da empresa pode consultar, sempre sob o empresaId do token.
router.get("/", listarCobrancasController)
router.get("/:id", buscarCobrancaController)

// Criar ou confirmar uma cobranca continua sendo uma operacao administrativa.
router.post(
  "/",
  autorizar(PapelUsuario.ADMIN),
  criarCobrancaController
)
router.post(
  "/:id/simular-confirmacao",
  autorizar(PapelUsuario.ADMIN),
  permitirSimulacaoForaDeProducao,
  confirmarCobrancaSimuladaController
)

export default router
