import type { Request, Response } from "express"
import {
  alterarStatusOrdemService,
  atualizarOrdemService,
  buscarOrdemService,
  criarOrdemService,
  listarOrdensService,
  removerOrdemService
} from "../services/ordens.services.js"
import {
  idEhInvalido,
  statusEhValido,
  validarDadosOrdem
} from "../validators/ordens.validators.js"

export const listarOrdens = (
  _req: Request,
  res: Response
) => {
  const ordens = listarOrdensService()

  return res.status(200).json(ordens)
}

export const buscarOrdem = (
  req: Request,
  res: Response
) => {
  const idOrdem = Number(req.params.id)

  if (idEhInvalido(idOrdem)) {
    return res.status(400).json({
      erro: "ID inválido"
    })
  }

  const ordemEncontrada = buscarOrdemService(idOrdem)

  if (!ordemEncontrada) {
    return res.status(404).json({
      erro: "Ordem de serviço não encontrada"
    })
  }

  return res.status(200).json(ordemEncontrada)
}

export const criarOrdem = (
  req: Request,
  res: Response
) => {
  const validacao = validarDadosOrdem(req.body)

  if (!validacao.valido) {
    return res.status(400).json({
      erro: validacao.erro
    })
  }

  const resultado = criarOrdemService(validacao.dados)

  if (!resultado.sucesso) {
    return res.status(404).json({
      erro: "Cliente não encontrado"
    })
  }

  return res.status(201).json(resultado.ordem)
}

export const atualizarOrdem = (
  req: Request,
  res: Response
) => {
  const idOrdem = Number(req.params.id)

  if (idEhInvalido(idOrdem)) {
    return res.status(400).json({
      erro: "ID inválido"
    })
  }

  const validacao = validarDadosOrdem(req.body)

  if (!validacao.valido) {
    return res.status(400).json({
      erro: validacao.erro
    })
  }

  const resultado = atualizarOrdemService(idOrdem, validacao.dados)

  if (!resultado.sucesso) {
    if (resultado.motivo === "ordem_nao_encontrada") {
      return res.status(404).json({
        erro: "Ordem de serviço não encontrada"
      })
    }

    return res.status(404).json({
      erro: "Cliente não encontrado"
    })
  }

  return res.status(200).json({
    mensagem: "Ordem de serviço atualizada com sucesso",
    ordem: resultado.ordem
  })
}

export const alterarStatusOrdem = (
  req: Request,
  res: Response
) => {
  const idOrdem = Number(req.params.id)

  if (idEhInvalido(idOrdem)) {
    return res.status(400).json({
      erro: "ID inválido"
    })
  }

  const { status } = req.body

  if (!statusEhValido(status)) {
    return res.status(400).json({
      erro: "Status inválido"
    })
  }

  const resultado = alterarStatusOrdemService(idOrdem, status)

  if (!resultado.sucesso) {
    return res.status(404).json({
      erro: "Ordem de serviço não encontrada"
    })
  }

  return res.status(200).json({
    mensagem: "Status da ordem atualizado com sucesso",
    ordem: resultado.ordem
  })
}

export const removerOrdem = (
  req: Request,
  res: Response
) => {
  const idOrdem = Number(req.params.id)

  if (idEhInvalido(idOrdem)) {
    return res.status(400).json({
      erro: "ID inválido"
    })
  }

  const resultado = removerOrdemService(idOrdem)

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
}
