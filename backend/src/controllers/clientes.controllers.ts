import type { Request, Response } from "express"
import {
  atualizarClienteService,
  buscarClienteService,
  criarClienteService,
  listarClientesService,
  removerClienteService
} from "../services/clientes.services.js"
import type { DadosCliente } from "../services/clientes.services.js"

function idEhInvalido(id: number): boolean {
  return !Number.isInteger(id) || id <= 0
}

export const listarClientes = (
  _req: Request,
  res: Response
) => {
  const clientes = listarClientesService()

  return res.status(200).json(clientes)
}

export const buscarCliente = (
  req: Request,
  res: Response
) => {
  const idCliente = Number(req.params.id)

  if (idEhInvalido(idCliente)) {
    return res.status(400).json({
      erro: "ID inválido"
    })
  }

  const clienteEncontrado = buscarClienteService(idCliente)

  if (!clienteEncontrado) {
    return res.status(404).json({
      erro: "Cliente não encontrado"
    })
  }

  return res.status(200).json(clienteEncontrado)
}

export const criarCliente = (
  req: Request,
  res: Response
) => {
  const {
    nome,
    telefone,
    email,
    cpfCnpj,
    endereco,
    observacoes,
    historicoDePecas
  } = req.body

  if (!nome || !telefone) {
    return res.status(400).json({
      erro: "Nome e telefone são obrigatórios"
    })
  }

  const dadosCliente: DadosCliente = {
    nome,
    telefone,
    email,
    cpfCnpj,
    endereco,
    observacoes,
    historicoDePecas
  }

  const resultado = criarClienteService(dadosCliente)

  if (!resultado.sucesso) {
    return res.status(409).json({
      erro: "Já existe um cliente com esse telefone"
    })
  }

  return res.status(201).json(resultado.cliente)
}

export const atualizarCliente = (
  req: Request,
  res: Response
) => {
  const idCliente = Number(req.params.id)

  if (idEhInvalido(idCliente)) {
    return res.status(400).json({
      erro: "ID inválido"
    })
  }

  const {
    nome,
    telefone,
    email,
    cpfCnpj,
    endereco,
    observacoes,
    historicoDePecas
  } = req.body

  if (!nome || !telefone) {
    return res.status(400).json({
      erro: "Nome e telefone são obrigatórios"
    })
  }

  const dadosCliente: DadosCliente = {
    nome,
    telefone,
    email,
    cpfCnpj,
    endereco,
    observacoes,
    historicoDePecas
  }

  const resultado = atualizarClienteService(idCliente, dadosCliente)

  if (!resultado.sucesso) {
    if (resultado.motivo === "cliente_nao_encontrado") {
      return res.status(404).json({
        erro: "Cliente não encontrado"
      })
    }

    return res.status(409).json({
      erro: "Já existe outro cliente com esse telefone"
    })
  }

  return res.status(200).json({
    mensagem: "Cliente atualizado com sucesso",
    cliente: resultado.cliente
  })
}

export const removerCliente = (
  req: Request,
  res: Response
) => {
  const idCliente = Number(req.params.id)

  if (idEhInvalido(idCliente)) {
    return res.status(400).json({
      erro: "ID inválido"
    })
  }

  const clienteRemovido = removerClienteService(idCliente)

  if (!clienteRemovido) {
    return res.status(404).json({
      erro: "Cliente não encontrado"
    })
  }

  return res.status(200).json({
    mensagem: "Cliente removido com sucesso",
    cliente: clienteRemovido
  })
}
