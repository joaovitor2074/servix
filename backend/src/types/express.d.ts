import type { PapelUsuario } from '../generated/prisma/enums.js'

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
