import { buscarClienteService } from "./clientes.services.js"
import type {
  OrdemServico,
  StatusOrdem
} from "../types/OrdemServico.js"

export type DadosOrdem = Omit<
  OrdemServico,
  "id" | "criadoEm" | "atualizadoEm"
>

type ResultadoCriacao =
  | { sucesso: true; ordem: OrdemServico }
  | { sucesso: false; motivo: "cliente_nao_encontrado" }

type ResultadoAtualizacao =
  | { sucesso: true; ordem: OrdemServico }
  | {
      sucesso: false
      motivo: "ordem_nao_encontrada" | "cliente_nao_encontrado"
    }

type ResultadoRemocao =
  | { sucesso: true; ordem: OrdemServico }
  | {
      sucesso: false
      motivo: "ordem_nao_encontrada" | "ordem_entregue"
    }

type ResultadoAlteracaoStatus =
  | { sucesso: true; ordem: OrdemServico }
  | { sucesso: false; motivo: "ordem_nao_encontrada" }

const ordens: OrdemServico[] = []

export function listarOrdensService(): OrdemServico[] {
  return ordens
}

export function buscarOrdemService(
  idOrdem: number
): OrdemServico | undefined {
  return ordens.find(ordem => ordem.id === idOrdem)
}

export function criarOrdemService(dados: DadosOrdem): ResultadoCriacao {
  const clienteExiste = buscarClienteService(dados.clienteId)

  if (!clienteExiste) {
    return {
      sucesso: false,
      motivo: "cliente_nao_encontrado"
    }
  }

  const maiorId =
    ordens.length > 0
      ? Math.max(...ordens.map(ordem => ordem.id))
      : 0

  const agora = new Date()

  const novaOrdem: OrdemServico = {
    id: maiorId + 1,
    ...dados,
    criadoEm: agora,
    atualizadoEm: agora
  }

  ordens.push(novaOrdem)

  return {
    sucesso: true,
    ordem: novaOrdem
  }
}

export function atualizarOrdemService(
  idOrdem: number,
  dados: DadosOrdem
): ResultadoAtualizacao {
  const indiceOrdem = ordens.findIndex(ordem => ordem.id === idOrdem)

  if (indiceOrdem === -1) {
    return {
      sucesso: false,
      motivo: "ordem_nao_encontrada"
    }
  }

  const clienteExiste = buscarClienteService(dados.clienteId)

  if (!clienteExiste) {
    return {
      sucesso: false,
      motivo: "cliente_nao_encontrado"
    }
  }

  const ordemAnterior = ordens[indiceOrdem]!

  const ordemAtualizada: OrdemServico = {
    ...ordemAnterior,
    ...dados,
    atualizadoEm: new Date()
  }

  ordens[indiceOrdem] = ordemAtualizada

  return {
    sucesso: true,
    ordem: ordemAtualizada
  }
}

export function alterarStatusOrdemService(
  idOrdem: number,
  status: StatusOrdem
): ResultadoAlteracaoStatus {
  const indiceOrdem = ordens.findIndex(ordem => ordem.id === idOrdem)

  if (indiceOrdem === -1) {
    return {
      sucesso: false,
      motivo: "ordem_nao_encontrada"
    }
  }

  const ordemAnterior = ordens[indiceOrdem]!

  const ordemAtualizada: OrdemServico = {
    ...ordemAnterior,
    status,
    atualizadoEm: new Date()
  }

  ordens[indiceOrdem] = ordemAtualizada

  return {
    sucesso: true,
    ordem: ordemAtualizada
  }
}

export function removerOrdemService(idOrdem: number): ResultadoRemocao {
  const indiceOrdem = ordens.findIndex(ordem => ordem.id === idOrdem)

  if (indiceOrdem === -1) {
    return {
      sucesso: false,
      motivo: "ordem_nao_encontrada"
    }
  }

  const ordemEncontrada = ordens[indiceOrdem]!

  if (ordemEncontrada.status === "entregue") {
    return {
      sucesso: false,
      motivo: "ordem_entregue"
    }
  }

  const [ordemRemovida] = ordens.splice(indiceOrdem, 1)

  return {
    sucesso: true,
    ordem: ordemRemovida!
  }
}
