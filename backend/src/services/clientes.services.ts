import type { Cliente } from "../types/Cliente.js"

export type DadosCliente = Omit<Cliente, "id" | "criadoEm">

type ResultadoCriacao =
  | { sucesso: true; cliente: Cliente }
  | { sucesso: false; motivo: "telefone_duplicado" }

type ResultadoAtualizacao =
  | { sucesso: true; cliente: Cliente }
  | {
      sucesso: false
      motivo: "cliente_nao_encontrado" | "telefone_duplicado"
    }

const clientes: Cliente[] = [
  {
    id: 1,
    nome: "João Vitor",
    telefone: "99999-9999",
    criadoEm: new Date()
  }
]

export function listarClientesService(): Cliente[] {
  return clientes
}

export function buscarClienteService(idCliente: number): Cliente | undefined {
  return clientes.find(cliente => cliente.id === idCliente)
}

export function criarClienteService(dados: DadosCliente): ResultadoCriacao {
  const telefoneJaCadastrado = clientes.some(
    cliente => cliente.telefone === dados.telefone
  )

  if (telefoneJaCadastrado) {
    return {
      sucesso: false,
      motivo: "telefone_duplicado"
    }
  }

  const maiorId =
    clientes.length > 0
      ? Math.max(...clientes.map(cliente => cliente.id))
      : 0

  const novoCliente: Cliente = {
    id: maiorId + 1,
    ...dados,
    criadoEm: new Date()
  }

  clientes.push(novoCliente)

  return {
    sucesso: true,
    cliente: novoCliente
  }
}

export function atualizarClienteService(
  idCliente: number,
  dados: DadosCliente
): ResultadoAtualizacao {
  const indiceCliente = clientes.findIndex(
    cliente => cliente.id === idCliente
  )

  if (indiceCliente === -1) {
    return {
      sucesso: false,
      motivo: "cliente_nao_encontrado"
    }
  }

  const telefoneJaUtilizado = clientes.some(
    cliente =>
      cliente.telefone === dados.telefone &&
      cliente.id !== idCliente
  )

  if (telefoneJaUtilizado) {
    return {
      sucesso: false,
      motivo: "telefone_duplicado"
    }
  }

  const clienteAnterior = clientes[indiceCliente]!

  const clienteAtualizado: Cliente = {
    ...clienteAnterior,
    ...dados
  }

  clientes[indiceCliente] = clienteAtualizado

  return {
    sucesso: true,
    cliente: clienteAtualizado
  }
}

export function removerClienteService(idCliente: number): Cliente | undefined {
  const indiceCliente = clientes.findIndex(
    cliente => cliente.id === idCliente
  )

  if (indiceCliente === -1) {
    return undefined
  }

  const [clienteRemovido] = clientes.splice(indiceCliente, 1)

  return clienteRemovido
}
