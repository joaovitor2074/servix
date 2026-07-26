export {}

declare global {
  namespace Express {
    interface Request {
      usuario?: {
        id: number
        empresaId: number
        papel: 'ADMIN' | 'ATENDENTE' | 'TECNICO'
      }
    }
  }
}