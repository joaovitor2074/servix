import { Router } from "express"
import { PapelUsuario } from "../generated/prisma/enums.js"
import {
  atualizarProdutoEstoque,
  criarProdutoEstoque,
  listarMovimentacoesEstoque,
  listarProdutosEstoque,
  registrarMovimentacaoEstoque
} from "../controllers/estoque.controllers.js"
import { autorizar } from "../middlewares/auth.middleware.js"

const router = Router()
router.get("/produtos", listarProdutosEstoque)
router.post("/produtos", autorizar(PapelUsuario.ADMIN, PapelUsuario.TECNICO), criarProdutoEstoque)
router.patch("/produtos/:id", autorizar(PapelUsuario.ADMIN, PapelUsuario.TECNICO), atualizarProdutoEstoque)
router.get("/movimentacoes", listarMovimentacoesEstoque)
router.post("/movimentacoes", autorizar(PapelUsuario.ADMIN, PapelUsuario.TECNICO), registrarMovimentacaoEstoque)
export default router
