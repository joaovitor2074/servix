import type { NextFunction, Request, Response } from "express"

import {
  alterarStatusOrdemService,
  atualizarOrdemService,
  buscarOrdemService,
  criarOrdemService,
  listarHistoricoOrdemService,
  listarOrdensService,
  removerOrdemService
} from "../services/ordens.service.js"
import {
  idEhInvalido,
  validarAlteracaoStatus,
  validarAtualizacaoOrdem,
  validarCriacaoOrdem,
  validarQueryOrdens
} from "../validators/ordens.validators.js"

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

    return res.status(200).json(ordem)
  } catch (error) {
    return next(error)
  }
}

export async function criarOrdem(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarCriacaoOrdem(req.body)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await criarOrdemService(
      req.auth.empresaId,
      req.auth.usuarioId,
      validacao.dados
    )

    if (!resultado.sucesso) {
      return res.status(404).json({ erro: "Cliente não encontrado" })
    }

    return res.status(201).json(resultado.ordem)
  } catch (error) {
    return next(error)
  }
}

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

      return res.status(404).json({ erro: "Cliente não encontrado" })
    }

    return res.status(200).json(resultado.ordem)
  } catch (error) {
    return next(error)
  }
}

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
      validacao.dados.status
    )

    if (!resultado.sucesso) {
      return res.status(404).json({
        erro: "Ordem de serviço não encontrada"
      })
    }

    return res.status(200).json(resultado.ordem)
  } catch (error) {
    return next(error)
  }
}

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

    const resultado = await removerOrdemService(id, req.auth.empresaId)

    if (!resultado.sucesso) {
      if (resultado.motivo === "ordem_entregue") {
        return res.status(409).json({
          erro: "Uma ordem entregue não pode ser removida"
        })
      }

      return res.status(404).json({
        erro: "Ordem de serviço não encontrada"
      })
    }

    return res.status(200).json({
      mensagem: "Ordem de serviço removida com sucesso",
      ordem: resultado.ordem
    })
  } catch (error) {
    return next(error)
  }
}
