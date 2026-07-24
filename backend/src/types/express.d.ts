import type { PapelUsuario } from "../generated/prisma/enums.js"

// Amplia o tipo Request do Express. O middleware `autenticar` preenche `auth`
// antes das rotas protegidas, permitindo acesso tipado nos controllers.
declare global {
  namespace Express {
    interface Request {
      auth: {
        usuarioId: number
        empresaId: number
        papel: PapelUsuario
      }
    }
  }
}

export {}
