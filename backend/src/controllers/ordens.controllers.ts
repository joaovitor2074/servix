import type { NextFunction, Request, Response } from "express"
import { PapelUsuario } from "../generated/prisma/enums.js"

import {
  alterarStatusOrdemService,
  atualizarOrdemService,
  buscarCredencialAcessoOrdemService,
  buscarOrdemService,
  listarHistoricoOrdemService,
  listarOrdensService,
  removerOrdemService
} from "../services/ordens.service.js"
import {
  idEhInvalido,
  validarAlteracaoStatus,
  validarAtualizacaoOrdem,
  validarCancelamentoOrdem,
  validarQueryOrdens
} from "../validators/ordens.validators.js"

// Cada controller desta camada sempre repassa `empresaId`; isso evita que um ID
// válido de outra empresa seja usado para acessar uma ordem indevidamente.

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

function responderRestricaoFinanceira(
  res: Response,
  motivo: "pagamento_insuficiente" | "pagamento_confirmado",
  resumo: {
    valorTotal: string
    totalPago: string
    totalEstornado: string
    saldo: string
  }
) {
  if (motivo === "pagamento_insuficiente") {
    return res.status(409).json({
      erro: "O pagamento precisa estar quitado antes da entrega.",
      codigo: "ORDEM_PAGAMENTO_INSUFICIENTE",
      detalhes: resumo
    })
  }

  return res.status(409).json({
    erro: "Estorne os pagamentos confirmados antes de cancelar a ordem.",
    codigo: "ORDEM_COM_PAGAMENTO_CONFIRMADO",
    detalhes: resumo
  })
}

function responderCobrancaEmConciliacao(res: Response) {
  return res.status(409).json({
    erro: "Existe uma cobranca do gateway aguardando conciliacao.",
    codigo: "ORDEM_COBRANCA_EM_CONCILIACAO"
  })
}

// Lista ordens com paginação e filtros vindos da query string.
export async function listarOrdens(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarQueryOrdens(req.query)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await listarOrdensService(
      req.auth.empresaId,
      validacao.dados
    )

    return res.status(200).json(resultado)
  } catch (error) {
    return next(error)
  }
}

// Busca uma única ordem pelo ID composto por ordem e empresa.
export async function buscarOrdem(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)

    if (idEhInvalido(id)) {
      return res.status(400).json({ erro: "ID inválido" })
    }

    const ordem = await buscarOrdemService(id, req.auth.empresaId)

    if (!ordem) {
      return res.status(404).json({
        erro: "Ordem de serviço não encontrada"
      })
    }

    return res.status(200).json({
      ...ordem,
      podeRevelarCredencial:
        req.auth.papel === PapelUsuario.ADMIN ||
        req.auth.papel === PapelUsuario.TECNICO
    })
  } catch (error) {
    return next(error)
  }
}

export async function buscarCredencialAcessoOrdem(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)

    if (idEhInvalido(id)) {
      return res.status(400).json({ erro: "ID invalido" })
    }

    const resultado = await buscarCredencialAcessoOrdemService(
      id,
      req.auth.empresaId
    )

    if (!resultado) {
      return res.status(404).json({ erro: "Ordem de servico nao encontrada" })
    }

    return res.status(200).json(resultado)
  } catch (error) {
    return next(error)
  }
}

// Atualiza os campos enviados e trata separadamente ordem ausente, cliente
// ausente e tentativa de transição de status não permitida.
export async function atualizarOrdem(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)

    if (idEhInvalido(id)) {
      return res.status(400).json({ erro: "ID inválido" })
    }

    const validacao = validarAtualizacaoOrdem(req.body)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await atualizarOrdemService(
      id,
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

      if (resultado.motivo === "transicao_status_invalida") {
        return res.status(409).json({
          erro: "Transição de status não permitida",
          codigo: "ORDEM_TRANSICAO_INVALIDA",
          detalhes: {
            statusAtual: resultado.statusAtual,
            statusSolicitado: resultado.statusSolicitado,
            statusPermitidos: resultado.statusPermitidos
          }
        })
      }

      if (resultado.motivo === "tecnico_nao_encontrado") {
        return res.status(400).json({
          erro: "Selecione um usuário ativo da empresa como técnico responsável.",
          codigo: "TECNICO_RESPONSAVEL_INVALIDO"
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

      if (
        resultado.motivo === "pagamento_insuficiente" ||
        resultado.motivo === "pagamento_confirmado"
      ) {
        return responderRestricaoFinanceira(
          res,
          resultado.motivo,
          resultado.resumo
        )
      }

      if (
        (resultado as { motivo: string }).motivo ===
        "cobranca_em_conciliacao"
      ) {
        return responderCobrancaEmConciliacao(res)
      }

      return res.status(404).json({ erro: "Cliente não encontrado" })
    }

    return res.status(200).json(resultado.ordem)
  } catch (error) {
    return next(error)
  }
}

// Endpoint específico para mudar somente o status da ordem.
export async function alterarStatusOrdem(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)

    if (idEhInvalido(id)) {
      return res.status(400).json({ erro: "ID inválido" })
    }

    const validacao = validarAlteracaoStatus(req.body)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await alterarStatusOrdemService(
      id,
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

      if (
        resultado.motivo === "pagamento_insuficiente" ||
        resultado.motivo === "pagamento_confirmado"
      ) {
        return responderRestricaoFinanceira(
          res,
          resultado.motivo,
          resultado.resumo
        )
      }

      if (
        (resultado as { motivo: string }).motivo ===
        "cobranca_em_conciliacao"
      ) {
        return responderCobrancaEmConciliacao(res)
      }

      return res.status(409).json({
        erro: "Transição de status não permitida",
        codigo: "ORDEM_TRANSICAO_INVALIDA",
        detalhes: {
          statusAtual: resultado.statusAtual,
          statusSolicitado: resultado.statusSolicitado,
          statusPermitidos: resultado.statusPermitidos
        }
      })
    }

    return res.status(200).json(resultado.ordem)
  } catch (error) {
    return next(error)
  }
}

// Recupera a linha do tempo de status e quem realizou cada alteração.
export async function listarHistoricoOrdem(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)

    if (idEhInvalido(id)) {
      return res.status(400).json({ erro: "ID inválido" })
    }

    const historico = await listarHistoricoOrdemService(
      id,
      req.auth.empresaId
    )

    if (!historico) {
      return res.status(404).json({
        erro: "Ordem de serviço não encontrada"
      })
    }

    return res.status(200).json(historico)
  } catch (error) {
    return next(error)
  }
}

// O DELETE representa cancelamento lógico: a ordem continua disponível para
// histórico e auditoria em vez de ser apagada do banco.
export async function removerOrdem(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)

    if (idEhInvalido(id)) {
      return res.status(400).json({ erro: "ID inválido" })
    }

    const validacao = validarCancelamentoOrdem({
      statusEsperado: req.body?.statusEsperado ?? req.query.statusEsperado,
      versaoEsperada: req.body?.versaoEsperada ?? req.query.versaoEsperada,
      mensagemPublica:
        req.body?.mensagemPublica ?? req.query.mensagemPublica
    })

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await removerOrdemService(
      id,
      req.auth.empresaId,
      req.auth.usuarioId,
      validacao.dados
    )

    if (!resultado.sucesso) {
      if (resultado.motivo === "ordem_entregue") {
        return res.status(409).json({
          erro: "Uma ordem entregue não pode ser cancelada",
          codigo: "ORDEM_TRANSICAO_INVALIDA"
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

      if (
        resultado.motivo === "pagamento_insuficiente" ||
        resultado.motivo === "pagamento_confirmado"
      ) {
        return responderRestricaoFinanceira(
          res,
          resultado.motivo,
          resultado.resumo
        )
      }

      if (
        (resultado as { motivo: string }).motivo ===
        "cobranca_em_conciliacao"
      ) {
        return responderCobrancaEmConciliacao(res)
      }

      if (resultado.motivo === "transicao_status_invalida") {
        return res.status(409).json({
          erro: "Transição de status não permitida",
          codigo: "ORDEM_TRANSICAO_INVALIDA",
          detalhes: {
            statusAtual: resultado.statusAtual,
            statusSolicitado: resultado.statusSolicitado,
            statusPermitidos: resultado.statusPermitidos
          }
        })
      }

      return res.status(404).json({
        erro: "Ordem de serviço não encontrada"
      })
    }

    return res.status(200).json({
      mensagem: "Ordem de serviço cancelada com sucesso",
      ordem: resultado.ordem
    })
  } catch (error) {
    return next(error)
  }
}
