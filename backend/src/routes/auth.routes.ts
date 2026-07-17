import { Router } from "express"


import {
  loginController,
  usuarioAtualController
} from "../controllers/auth.controllers.js"
import { autenticar } from "../middlewares/auth.middleware.js"

const router = Router()

router.post("/login", loginController)
router.get("/me", autenticar, usuarioAtualController)

export default router
