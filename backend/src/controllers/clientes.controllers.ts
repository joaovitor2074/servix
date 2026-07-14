import type { Request, Response } from "express"
import type { Cliente } from "../types/Cliente.js"

const clientes: Cliente[] = [
  {
    id: 1,
    nome: "João Vitor",
    telefone: "99999-9999",
    criadoEm: new Date()
  }
]

export const listarClientes = (
  req: Request,
  res: Response
) => {
  return res.status(200).json(clientes)
}

export const buscarCliente = (
  req: Request,
  res: Response
) => {
  const idCliente = Number(req.params.id)

  if (Number.isNaN(idCliente)) {
    return res.status(400).json({
      erro: "ID inválido"
    })
  }

  const clienteEncontrado = clientes.find(
    cliente => cliente.id === idCliente
  )

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

  const telefoneJaCadastrado = clientes.some(
    cliente => cliente.telefone === telefone
  )

  if (telefoneJaCadastrado) {
    return res.status(409).json({
      erro: "Já existe um cliente com esse telefone"
    })
  }

  const maiorId =
    clientes.length > 0
      ? Math.max(...clientes.map(cliente => cliente.id))
      : 0

  const novoCliente: Cliente = {
    id: maiorId + 1,
    nome,
    telefone,
    email,
    cpfCnpj,
    endereco,
    observacoes,
    historicoDePecas,
    criadoEm: new Date()
  }

  clientes.push(novoCliente)

  return res.status(201).json(novoCliente)
}