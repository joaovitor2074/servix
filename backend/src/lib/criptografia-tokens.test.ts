import { randomBytes } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  criptografarToken,
  descriptografarToken,
  ErroCriptografiaTokens,
  validarChaveCriptografiaTokens
} from "./criptografia-tokens.js"

const chave = randomBytes(32).toString("base64")

describe("criptografia de tokens", () => {
  it("protege e recupera o token somente no mesmo contexto", () => {
    const token = "APP_USR-segredo-da-empresa-a"
    const cifrado = criptografarToken(token, chave, "empresa:8:access")

    expect(cifrado).not.toContain(token)
    expect(descriptografarToken(
      cifrado,
      chave,
      "empresa:8:access"
    )).toBe(token)
    expect(() => descriptografarToken(
      cifrado,
      chave,
      "empresa:9:access"
    )).toThrow(ErroCriptografiaTokens)
  })

  it("usa IV novo e rejeita chave ou conteudo adulterado", () => {
    const primeiro = criptografarToken("TG-refresh", chave, "refresh")
    const segundo = criptografarToken("TG-refresh", chave, "refresh")
    const outraChave = randomBytes(32).toString("base64")

    expect(primeiro).not.toBe(segundo)
    expect(() => descriptografarToken(
      primeiro,
      outraChave,
      "refresh"
    )).toThrow(ErroCriptografiaTokens)
    expect(() => descriptografarToken(
      `${primeiro.slice(0, -1)}${primeiro.endsWith("A") ? "B" : "A"}`,
      chave,
      "refresh"
    )).toThrow(ErroCriptografiaTokens)
  })

  it("aceita apenas chave Base64 canonica com 32 bytes", () => {
    expect(validarChaveCriptografiaTokens(chave)).toBe(true)
    expect(validarChaveCriptografiaTokens("texto-com-32-caracteres-nao-basta")).toBe(false)
    expect(validarChaveCriptografiaTokens(randomBytes(16).toString("base64"))).toBe(false)
  })
})
