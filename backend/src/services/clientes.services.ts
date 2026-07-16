import type { Cliente } from "../types/Cliente.js"
import {prisma} from "../lib/prisma.js"

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

export async function listarClientesService(empresaId:number) {
  return prisma.cliente.findMany({
    where: {
      empresaId
    },
    orderBy:{
      criadoEm:"desc"
    }
  })
}

export function buscarClienteService(id: number,empresaId:number){
  return prisma.cliente.findFirst({
    where:{
      id,
      empresaId
    }
  })  
}

export async function criarClienteService(dados: DadosCliente,empresaId:number){
  const telefoneExistente = await prisma.cliente.findFirst({
    where:{
      empresaId,
      telefone:dados.telefone
    }
  })

  if(telefoneExistente){
    return {
      sucesso:false as const,
      mnotivo:"telefone_duplicado"
    }
  }

  const cliente = await prisma.cliente.create({
    data:{
      empresaId,
      nome: dados.nome,
      telefone: dados.telefone,
      email: dados.email??null,
      cpfCnpj: dados.cpfCnpj??null,
      endereco: dados.endereco??null,
      observacoes: dados.observacoes ?? null
    }
  })

  return{
    sucesso: true as const,
    cliente
  }
}

export async function atualizarClienteService(
  id: number,
  dados: Partial<DadosCliente>,
  empresaId:number
){
  const clienteExistente = await buscarClienteService(id,empresaId)

  if(!clienteExistente){
    return{
      sucesso:false,
      motivo:"cliente nao encontrado" as const
    }
  }

  if(dados.telefone){
    const telefoneExistente= await prisma.cliente.findFirst({
      where:{
        empresaId,
        telefone:dados.telefone,
        NOT: {
          id
        }
      }
    })

    
    if (telefoneExistente) {
        return {
          sucesso: false as const,
          motivo: "telefone_duplicado" as const
        }
      }
  }

  const cliente = await prisma.cliente.update({
    where:{
      id
    },
    data:dados
  })

  return {
    sucesso:true as const,
    cliente
  }


}

export async function removerClienteService(
  id: number,
  empresaId: number
) {
  const clienteExistente = await buscarClienteService(id, empresaId)

  if (!clienteExistente) {
    return {
      sucesso: false as const,
      motivo: "cliente_nao_encontrado" as const
    }
  }

  const quantidadeOrdens = await prisma.ordemServico.count({
    where: {
      clienteId: id,
      empresaId
    }
  })

  if (quantidadeOrdens > 0) {
    return {
      sucesso: false as const,
      motivo: "cliente_possui_ordens" as const
    }
  }

  const cliente = await prisma.cliente.delete({
    where: {
      id
    }
  })

  return {
    sucesso: true as const,
    cliente
  }
}