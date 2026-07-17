import type { NextFunction, Request, Response } from "express"

import { AppError } from "../errors/app-error.js"
import { Prisma } from "../generated/prisma/client.js"

function erroDeJsonInvalido(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 400
  )
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      erro: err.message,
      codigo: err.codigo,
      ...(err.detalhes !== undefined && { detalhes: err.detalhes })
    })
    return
  }

  if (erroDeJsonInvalido(err)) {
    res.status(400).json({ erro: "JSON inválido" })
    return
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ erro: "Registro duplicado" })
      return
    }

    if (err.code === "P2025") {
      res.status(404).json({ erro: "Registro não encontrado" })
      return
    }
  }

  console.error("Erro não tratado:", err)
  res.status(500).json({ erro: "Erro interno do servidor" })
}
