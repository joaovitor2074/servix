import type { NextFunction, Request, Response } from "express"

import {
  atualizarClienteService,
  buscarClienteService,
  criarClienteService,
  listarClientesService,
  removerClienteService
} from "../services/clientes.service.js"
import {
  idEhInvalido,
  validarAtualizacaoCliente,
  validarCriacaoCliente,
  validarQueryClientes
} from "../validators/clientes.validators.js"

export async function listarClientesController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarQueryClientes(req.query)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await listarClientesService(
      req.auth.empresaId,
      validacao.dados
    )

    return res.status(200).json(resultado)
  } catch (error) {
    return next(error)
  }
}

export async function buscarClienteController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)

    if (idEhInvalido(id)) {
      return res.status(400).json({ erro: "ID inválido" })
    }

    const cliente = await buscarClienteService(id, req.auth.empresaId)

    if (!cliente) {
      return res.status(404).json({ erro: "Cliente não encontrado" })
    }

    return res.status(200).json(cliente)
  } catch (error) {
    return next(error)
  }
}

export async function criarClienteController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarCriacaoCliente(req.body)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await criarClienteService(
      validacao.dados,
      req.auth.empresaId
    )

    if (!resultado.sucesso) {
      return res.status(409).json({
        erro: "Este telefone já está cadastrado"
      })
    }

    return res.status(201).json(resultado.cliente)
  } catch (error) {
    return next(error)
  }
}

export async function atualizarClienteController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)

    if (idEhInvalido(id)) {
      return res.status(400).json({ erro: "ID inválido" })
    }

    const validacao = validarAtualizacaoCliente(req.body)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await atualizarClienteService(
      id,
      validacao.dados,
      req.auth.empresaId
    )

    if (!resultado.sucesso) {
      if (resultado.motivo === "telefone_duplicado") {
        return res.status(409).json({
          erro: "Este telefone já está cadastrado"
        })
      }

      return res.status(404).json({ erro: "Cliente não encontrado" })
    }

    return res.status(200).json(resultado.cliente)
  } catch (error) {
    return next(error)
  }
}

export async function removerClienteController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)

    if (idEhInvalido(id)) {
      return res.status(400).json({ erro: "ID inválido" })
    }

    const resultado = await removerClienteService(
      id,
      req.auth.empresaId
    )

    if (!resultado.sucesso) {
      if (resultado.motivo === "cliente_possui_ordens") {
        return res.status(409).json({
          erro: "O cliente possui ordens de serviço e não pode ser removido"
        })
      }

      return res.status(404).json({ erro: "Cliente não encontrado" })
    }

    return res.status(200).json({
      mensagem: "Cliente removido com sucesso",
      cliente: resultado.cliente
    })
  } catch (error) {
    return next(error)
  }
}
