import type {
  NextFunction,
  Request,
  Response
} from "express"

import {
  atualizarClienteService,
  buscarClienteService,
  criarClienteService,
  listarClientesService,
  removerClienteService
} from "../services/clientes.services.js"

const EMPRESA_ID_TESTE = 1

export async function listarClientesController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const clientes = await listarClientesService(EMPRESA_ID_TESTE)

    return res.status(200).json(clientes)
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

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        erro: "ID inválido"
      })
    }

    // Faltava o await aqui
    const cliente = await buscarClienteService(
      id,
      EMPRESA_ID_TESTE
    )

    if (!cliente) {
      return res.status(404).json({
        erro: "Cliente não encontrado"
      })
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
    const {
      nome,
      telefone,
      email,
      cpfCnpj,
      endereco,
      observacoes
    } = req.body

    if (
      typeof nome !== "string" ||
      typeof telefone !== "string" ||
      !nome.trim() ||
      !telefone.trim()
    ) {
      return res.status(400).json({
        erro: "Nome e telefone são obrigatórios"
      })
    }

    const resultado = await criarClienteService(
      {
        nome: nome.trim(),
        telefone: telefone.trim(),
        email,
        cpfCnpj,
        endereco,
        observacoes
      },
      EMPRESA_ID_TESTE,
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

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        erro: "ID inválido"
      })
    }

    const resultado = await atualizarClienteService(
      id,
      req.body,
      EMPRESA_ID_TESTE,
    )

    if (!resultado.sucesso) {
      if (resultado.motivo === "telefone_duplicado") {
        return res.status(409).json({
          erro: "Este telefone já está cadastrado"
        })
      }

      return res.status(404).json({
        erro: "Cliente não encontrado"
      })
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

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        erro: "ID inválido"
      })
    }

    const resultado = await removerClienteService(
      id,
      EMPRESA_ID_TESTE
    )

    if (!resultado.sucesso) {
      if (resultado.motivo === "cliente_possui_ordens") {
        return res.status(409).json({
          erro: "O cliente possui ordens de serviço e não pode ser removido"
        })
      }

      return res.status(404).json({
        erro: "Cliente não encontrado"
      })
    }

    return res.status(200).json({
      mensagem: "Cliente removido com sucesso",
      cliente: resultado.cliente
    })
  } catch (error) {
    return next(error)
  }
}