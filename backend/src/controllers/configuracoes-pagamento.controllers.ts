import type { NextFunction, Request, Response } from "express"

import {
  atualizarConfiguracaoPagamentoService,
  buscarConfiguracaoPagamentoService
} from "../services/configuracoes-pagamento.service.js"
import { validarAtualizacaoConfiguracaoPagamento } from "../validators/configuracoes-pagamento.validators.js"

export async function buscarConfiguracaoPagamentoController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const resultado = await buscarConfiguracaoPagamentoService(
      req.auth.empresaId
    )
    return res.status(200).json(resultado)
  } catch (error) {
    return next(error)
  }
}

export async function atualizarConfiguracaoPagamentoController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarAtualizacaoConfiguracaoPagamento(req.body)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await atualizarConfiguracaoPagamentoService(
      req.auth.empresaId,
      validacao.dados
    )

    if (!resultado.sucesso) {
      if (resultado.motivo === "conflito_atualizacao") {
        return res.status(409).json({
          erro: "A configuracao foi alterada por outro administrador. Recarregue os dados.",
          codigo: "CONFIGURACAO_PAGAMENTO_CONFLITANTE",
          detalhes: {
            versaoEsperada: resultado.versaoEsperada,
            versaoAtual: resultado.versaoAtual,
            configuracaoAtual: resultado.configuracaoAtual
          }
        })
      }

      if (resultado.motivo === "provedor_nao_conectado") {
        return res.status(409).json({
          erro: "Este provedor ainda nao foi conectado a empresa.",
          codigo: "PROVEDOR_PAGAMENTO_NAO_CONECTADO",
          detalhes: { provedor: resultado.provedor }
        })
      }

      if (resultado.motivo === "simulador_somente_teste") {
        return res.status(409).json({
          erro: "O gateway simulado funciona somente no ambiente de teste.",
          codigo: "GATEWAY_SIMULADO_SOMENTE_TESTE"
        })
      }

      if (resultado.motivo === "mercado_pago_ambiente_indisponivel") {
        return res.status(409).json({
          erro: "O ambiente selecionado nao coincide com o Mercado Pago configurado no servidor.",
          codigo: "MERCADO_PAGO_AMBIENTE_INDISPONIVEL"
        })
      }

      return res.status(409).json({
        erro: "O gateway simulado nao esta disponivel em producao.",
        codigo: "GATEWAY_SIMULADO_INDISPONIVEL"
      })
    }

    return res.status(200).json(resultado)
  } catch (error) {
    return next(error)
  }
}
