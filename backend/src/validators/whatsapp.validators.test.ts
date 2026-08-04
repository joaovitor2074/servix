import { describe, expect, it } from "vitest"
import {
  TEMPLATES_WHATSAPP_PADRAO,
  renderizarTemplateWhatsApp
} from "../services/configuracoes-whatsapp.service.js"
import {
  validarAtualizacaoConfiguracaoWhatsApp,
  validarPreparacaoMensagemWhatsApp
} from "./whatsapp.validators.js"

describe("validadores de WhatsApp", () => {
  const dadosValidos = {
    versaoEsperada: 1,
    ativo: true,
    modoEnvio: "LINK_MANUAL",
    telefoneEmpresa: "(11) 99999-9999",
    incluirLink: true,
    ...TEMPLATES_WHATSAPP_PADRAO,
    apiPhoneNumberId: "",
    apiBusinessAccountId: ""
  }

  it("normaliza telefone e campos opcionais", () => {
    const resultado = validarAtualizacaoConfiguracaoWhatsApp(dadosValidos)
    expect(resultado.valido).toBe(true)
    if (!resultado.valido) return
    expect(resultado.dados.telefoneEmpresa).toBe("11999999999")
    expect(resultado.dados.apiPhoneNumberId).toBeNull()
  })

  it("rejeita identificador da Meta com letras", () => {
    const resultado = validarAtualizacaoConfiguracaoWhatsApp({
      ...dadosValidos,
      apiPhoneNumberId: "abc123"
    })
    expect(resultado.valido).toBe(false)
  })

  it("aceita apenas uma origem conhecida e id positivo", () => {
    expect(validarPreparacaoMensagemWhatsApp({ origem: "GARANTIA", referenciaId: 9 }).valido).toBe(true)
    expect(validarPreparacaoMensagemWhatsApp({ origem: "CLIENTE", referenciaId: 9 }).valido).toBe(false)
    expect(validarPreparacaoMensagemWhatsApp({ origem: "ORDEM", referenciaId: 0 }).valido).toBe(false)
  })

  it("renderiza variáveis sem executar ou apagar marcadores desconhecidos", () => {
    expect(renderizarTemplateWhatsApp(
      "Olá, {{cliente}}! {{desconhecida}}",
      { cliente: "Ana" }
    )).toBe("Olá, Ana! {{desconhecida}}")
  })
})
