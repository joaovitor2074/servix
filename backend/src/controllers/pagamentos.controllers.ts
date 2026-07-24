import type { NextFunction, Request, Response } from "express"

import {
  estornarPagamentoService,
  listarPagamentosService,
  registrarPagamentoService
} from "../services/pagamentos.service.js"
import {
  idPagamentoEhInvalido,
  validarEstornoPagamento,
  validarRegistroPagamento
} from "../validators/pagamentos.validators.js"

function responderConflitoAtualizacao(
  res: Response,
  conflito: {
    statusEsperado: string
    statusAtual: string
    versaoEsperada: number
    versaoAtual: number
  }
) {
  return res.status(409).json({
    erro: "A ordem foi alterada por outro usuário. Recarregue os dados antes de continuar.",
    codigo: "ORDEM_ATUALIZACAO_CONFLITANTE",
    detalhes: conflito
  })
}

export async function listarPagamentosController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const ordemId = Number(req.params.id)

    if (idPagamentoEhInvalido(ordemId)) {
      return res.status(400).json({ erro: "ID inválido" })
    }

    const resultado = await listarPagamentosService(
      ordemId,
      req.auth.empresaId
    )

    if (!resultado.sucesso) {
      return res.status(404).json({
        erro: "Ordem de serviço não encontrada"
      })
    }

    return res.status(200).json({
      pagamentos: resultado.pagamentos,
      resumo: resultado.resumo,
      statusOrdem: resultado.statusOrdem,
      versaoOrdem: resultado.versaoOrdem
    })
  } catch (error) {
    return next(error)
  }
}

export async function registrarPagamentoController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const ordemId = Number(req.params.id)

    if (idPagamentoEhInvalido(ordemId)) {
      return res.status(400).json({ erro: "ID inválido" })
    }

    const validacao = validarRegistroPagamento(req.body)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await registrarPagamentoService(
      ordemId,
      req.auth.empresaId,
      req.auth.usuarioId,
      validacao.dados
    )

    if (!resultado.sucesso) {
      if (resultado.motivo === "ordem_nao_encontrada") {
        return res.status(404).json({
          erro: "Ordem de serviço não encontrada"
        })
      }

      if (resultado.motivo === "conflito_atualizacao") {
        return responderConflitoAtualizacao(res, {
          statusEsperado: resultado.statusEsperado,
          statusAtual: resultado.statusAtual,
          versaoEsperada: resultado.versaoEsperada,
          versaoAtual: resultado.versaoAtual
        })
      }

      if (resultado.motivo === "ordem_finalizada") {
        return res.status(409).json({
          erro: "Não é possível registrar pagamento em uma ordem entregue ou cancelada",
          codigo: "PAGAMENTO_ORDEM_FINALIZADA",
          detalhes: {
            statusAtual: resultado.statusAtual
          }
        })
      }

      if (
        (resultado as { motivo: string }).motivo ===
        "cobranca_em_conciliacao"
      ) {
        return res.status(409).json({
          erro: "Existe uma cobranca do gateway aguardando conciliacao.",
          codigo: "PAGAMENTO_COBRANCA_EM_CONCILIACAO"
        })
      }

      return res.status(409).json({
        erro: "O valor do pagamento excede o saldo da ordem",
        codigo: "PAGAMENTO_EXCEDE_SALDO",
        detalhes: {
          valorPagamento: resultado.valorPagamento,
          ...resultado.resumo
        }
      })
    }

    return res.status(201).json({
      pagamento: resultado.pagamento,
      resumo: resultado.resumo,
      versaoOrdem: resultado.versaoOrdem
    })
  } catch (error) {
    return next(error)
  }
}

export async function estornarPagamentoController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const ordemId = Number(req.params.id)
    const pagamentoId = Number(req.params.pagamentoId)

    if (
      idPagamentoEhInvalido(ordemId) ||
      idPagamentoEhInvalido(pagamentoId)
    ) {
      return res.status(400).json({ erro: "ID inválido" })
    }

    const validacao = validarEstornoPagamento(req.body)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await estornarPagamentoService(
      ordemId,
      pagamentoId,
      req.auth.empresaId,
      req.auth.usuarioId,
      validacao.dados
    )

    if (!resultado.sucesso) {
      if (resultado.motivo === "ordem_nao_encontrada") {
        return res.status(404).json({
          erro: "Ordem de serviço não encontrada"
        })
      }

      if (resultado.motivo === "pagamento_nao_encontrado") {
        return res.status(404).json({
          erro: "Pagamento não encontrado"
        })
      }

      if (resultado.motivo === "conflito_atualizacao") {
        return responderConflitoAtualizacao(res, {
          statusEsperado: resultado.statusEsperado,
          statusAtual: resultado.statusAtual,
          versaoEsperada: resultado.versaoEsperada,
          versaoAtual: resultado.versaoAtual
        })
      }

      if (resultado.motivo === "ordem_finalizada") {
        return res.status(409).json({
          erro: "Não é possível estornar pagamento de uma ordem entregue ou cancelada",
          codigo: "PAGAMENTO_ORDEM_FINALIZADA",
          detalhes: {
            statusAtual: resultado.statusAtual
          }
        })
      }

      if (resultado.motivo === "pagamento_gateway_exige_estorno_gateway") {
        return res.status(409).json({
          erro: "Pagamentos confirmados pelo gateway devem ser estornados pelo provedor.",
          codigo: "PAGAMENTO_GATEWAY_EXIGE_ESTORNO_NO_PROVEDOR"
        })
      }

      return res.status(409).json({
        erro: "O pagamento já foi estornado",
        codigo: "PAGAMENTO_JA_ESTORNADO"
      })
    }

    return res.status(200).json({
      pagamento: resultado.pagamento,
      resumo: resultado.resumo,
      versaoOrdem: resultado.versaoOrdem
    })
  } catch (error) {
    return next(error)
  }
}
