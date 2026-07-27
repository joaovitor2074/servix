import { Router } from "express"


import {
  loginController,
  usuarioAtualController
} from "../controllers/auth.controllers.js"
import { autenticarSessao } from "../middlewares/auth.middleware.js"

// O prefixo `/auth` é aplicado em app.ts. Portanto, as rotas finais são
// POST /auth/login e GET /auth/me.
const router = Router()

// Login é público; `/me` exige um token válido.
router.post("/login", loginController)
router.get("/me", autenticarSessao, usuarioAtualController)


export default router
