import { Router } from "express"

import {
  atualizarCategoriaFinanceiraController,
  atualizarCentroCustoFinanceiroController,
  atualizarContaFinanceiraController,
  criarCategoriaFinanceiraController,
  criarCentroCustoFinanceiroController,
  criarContaFinanceiraController,
  listarCategoriasFinanceirasController,
  listarCentrosCustoFinanceirosController,
  listarContasFinanceirasController
} from "../controllers/financeiro-cadastros.controllers.js"
import {
  atualizarLancamentoFinanceiroController,
  buscarLancamentoFinanceiroController,
  cancelarLancamentoFinanceiroController,
  criarLancamentoFinanceiroController,
  estornarBaixaFinanceiraController,
  listarLancamentosFinanceirosController,
  registrarBaixaFinanceiraController
} from "../controllers/financeiro-lancamentos.controllers.js"
import {
  criarAjusteFinanceiroController,
  criarTransferenciaFinanceiraController,
  estornarMovimentacaoFinanceiraController,
  listarMovimentacoesFinanceirasController
} from "../controllers/financeiro-movimentacoes.controllers.js"
import {
  buscarDashboardFinanceiroController,
  buscarFluxoCaixaFinanceiroController,
  buscarResumoServicosFinanceiroController,
  listarAuditoriaFinanceiraController
} from "../controllers/financeiro-relatorios.controllers.js"
import { PapelUsuario } from "../generated/prisma/enums.js"
import { autorizar } from "../middlewares/auth.middleware.js"
import { garantirIdempotenciaFinanceiroPreview } from "../middlewares/financeiro-idempotencia.middleware.js"
import { protegerMutacaoFinanceiroPreview } from "../middlewares/financeiro-preview.middleware.js"

const router = Router()

// A primeira preview e intencionalmente conservadora: inclusive consultas sao
// limitadas a ADMIN. Nao existem DELETEs nem endpoints de gateway neste router.
router.use(autorizar(PapelUsuario.ADMIN))
router.use(protegerMutacaoFinanceiroPreview)
router.use(garantirIdempotenciaFinanceiroPreview)

router.get("/dashboard", buscarDashboardFinanceiroController)
router.get("/servicos/resumo", buscarResumoServicosFinanceiroController)
router.get("/fluxo-caixa", buscarFluxoCaixaFinanceiroController)
router.get("/auditoria", listarAuditoriaFinanceiraController)

router.get("/categorias", listarCategoriasFinanceirasController)
router.post("/categorias", criarCategoriaFinanceiraController)
router.patch("/categorias/:id", atualizarCategoriaFinanceiraController)

router.get("/centros-custo", listarCentrosCustoFinanceirosController)
router.post("/centros-custo", criarCentroCustoFinanceiroController)
router.patch("/centros-custo/:id", atualizarCentroCustoFinanceiroController)

router.get("/contas", listarContasFinanceirasController)
router.post("/contas", criarContaFinanceiraController)
router.patch("/contas/:id", atualizarContaFinanceiraController)

router.get("/movimentacoes", listarMovimentacoesFinanceirasController)
router.post("/movimentacoes/ajustes", criarAjusteFinanceiroController)
router.post("/movimentacoes/:id/estornar", estornarMovimentacaoFinanceiraController)
router.post("/transferencias", criarTransferenciaFinanceiraController)

router.get("/lancamentos", listarLancamentosFinanceirosController)
router.post("/lancamentos", criarLancamentoFinanceiroController)
router.get("/lancamentos/:id", buscarLancamentoFinanceiroController)
router.patch("/lancamentos/:id", atualizarLancamentoFinanceiroController)
router.post("/lancamentos/:id/cancelar", cancelarLancamentoFinanceiroController)
router.post("/lancamentos/:id/baixas", registrarBaixaFinanceiraController)
router.post("/lancamentos/:id/baixas/:movimentacaoId/estornar", estornarBaixaFinanceiraController)

export default router
