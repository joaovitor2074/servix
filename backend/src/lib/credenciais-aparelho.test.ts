import { randomBytes } from "node:crypto"

import { afterEach, describe, expect, it } from "vitest"

import { AppError } from "../errors/app-error.js"
import {
  protegerCredencialAparelho,
  revelarCredencialAparelho
} from "./credenciais-aparelho.js"

const chaveAnterior = process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY

afterEach(() => {
  if (chaveAnterior === undefined) {
    delete process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY
  } else {
    process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY = chaveAnterior
  }
})

describe("credenciais de acesso de aparelhos", () => {
  it("cifra a credencial e permite revelar somente na mesma empresa e ordem", () => {
    process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY =
      randomBytes(32).toString("base64")

    const cifrada = protegerCredencialAparelho("2580", 8, 17)

    expect(cifrada).not.toContain("2580")
    expect(revelarCredencialAparelho(cifrada, 8, 17)).toBe("2580")
    expect(() => revelarCredencialAparelho(cifrada, 9, 17)).toThrow(AppError)
    expect(() => revelarCredencialAparelho(cifrada, 8, 18)).toThrow(AppError)
  })

  it("falha fechado quando a chave exclusiva nao foi configurada", () => {
    delete process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY

    expect(() => protegerCredencialAparelho("2580", 8, 17)).toThrow(
      expect.objectContaining({
        codigo: "CREDENCIAIS_APARELHO_NAO_CONFIGURADAS",
        statusCode: 503
      })
    )
  })
})
