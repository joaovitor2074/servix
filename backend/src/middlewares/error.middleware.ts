import type { NextFunction, Request, Response } from "express"

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error("Erro não tratado:", err)

  if (res.headersSent) {
    next(err)
    return
  }

  res.status(500).json({
    erro: "Erro interno do servidor"
  })
}