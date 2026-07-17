import type { NextFunction, Request, Response } from "express"
import jsonwebtoken, { type JwtPayload } from "jsonwebtoken"

import { obterJwtSecret } from "../config/env.js"
import {
  PapelUsuario,
  type PapelUsuario as PapelUsuarioType
} from "../generated/prisma/enums.js"

function papelEhValido(valor: unknown): valor is PapelUsuarioType {
  return (
    typeof valor === "string" &&
    Object.values(PapelUsuario).includes(valor as PapelUsuarioType)
  )
}

export function autenticar(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token de acesso não informado" })
  }

  const token = authorization.slice("Bearer ".length).trim()

  try {
    const payload = jsonwebtoken.verify(token, obterJwtSecret(), {
      issuer: "servix",
      audience: "servix-api"
    }) as JwtPayload

    const usuarioId = Number(payload.sub)
    const empresaId = payload.empresaId

    if (
      !Number.isInteger(usuarioId) ||
      usuarioId <= 0 ||
      typeof empresaId !== "number" ||
      !Number.isInteger(empresaId) ||
      empresaId <= 0 ||
      !papelEhValido(payload.papel)
    ) {
      return res.status(401).json({ erro: "Token de acesso inválido" })
    }

    req.auth = {
      usuarioId,
      empresaId,
      papel: payload.papel
    }

    return next()
  } catch {
    return res.status(401).json({ erro: "Token de acesso inválido ou expirado" })
  }
}
