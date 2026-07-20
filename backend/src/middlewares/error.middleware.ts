import type { NextFunction, Request, Response } from "express"

import { AppError } from "../errors/app-error.js"
import { Prisma } from "../generated/prisma/client.js"

// O parser JSON do Express gera um SyntaxError especial quando o corpo enviado
// não é JSON válido. Esta função o identifica sem assumir o tipo de `error`.
function erroDeJsonInvalido(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 400
  )
}

// Todos os erros encaminhados com `next(error)` terminam aqui. Erros conhecidos
// recebem respostas específicas; os demais são ocultados do cliente e viram 500.
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    // Se outra camada já iniciou a resposta, o Express precisa concluir o erro.
    next(err)
    return
  }

  if (err instanceof AppError) {
    // AppError carrega uma mensagem segura, status HTTP e código de domínio.
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

  // O erro completo fica somente no servidor para não expor detalhes internos.
  console.error("Erro não tratado:", err)
  res.status(500).json({ erro: "Erro interno do servidor" })
}
