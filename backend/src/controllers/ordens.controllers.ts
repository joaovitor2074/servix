import type { Request, Response } from "express"
import {
  alterarStatusOrdemService,
  atualizarOrdemService,
  buscarOrdemService,
  criarOrdemService,
  listarOrdensService,
  removerOrdemService
} from "../services/ordens.services.js"
import type { DadosOrdem } from "../services/ordens.services.js"
import type { StatusOrdem } from "../types/OrdemServico.js"

const statusPermitidos = new Set<StatusOrdem>([
  "orcamento",
  "aguardando_aprovacao",
  "aprovado",
  "em_andamento",
  "aguardando_peca",
  "concluido",
  "entregue",
  "cancelado"
])

type ResultadoValidacao =
  | { valido: true; dados: DadosOrdem }
  | { valido: false; erro: string }

function idEhInvalido(id: number): boolean {
  return !Number.isInteger(id) || id <= 0
}

function textoObrigatorioEhInvalido(valor: unknown): boolean {
  return typeof valor !== "string" || valor.trim().length === 0
}

function textoOpcionalEhInvalido(valor: unknown): boolean {
  return valor !== undefined && typeof valor !== "string"
}

function statusEhValido(status: unknown): status is StatusOrdem {
  return (
    typeof status === "string" &&
    statusPermitidos.has(status as StatusOrdem)
  )
}

function validarDadosOrdem(body: unknown): ResultadoValidacao {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {
      valido: false,
      erro: "Corpo da requisição inválido"
    }
  }

  const dadosRecebidos = body as Record<string, unknown>

  if (
    typeof dadosRecebidos.clienteId !== "number" ||
    idEhInvalido(dadosRecebidos.clienteId)
  ) {
    return {
      valido: false,
      erro: "clienteId deve ser um número inteiro positivo"
    }
  }

  if (textoObrigatorioEhInvalido(dadosRecebidos.equipamento)) {
    return {
      valido: false,
      erro: "Equipamento é obrigatório"
    }
  }

  if (textoObrigatorioEhInvalido(dadosRecebidos.problemaRelatado)) {
    return {
      valido: false,
      erro: "Problema relatado é obrigatório"
    }
  }

  if (textoObrigatorioEhInvalido(dadosRecebidos.tecnicoResponsavel)) {
    return {
      valido: false,
      erro: "Técnico responsável é obrigatório"
    }
  }

  if (textoObrigatorioEhInvalido(dadosRecebidos.previsaoDeEntrega)) {
    return {
      valido: false,
      erro: "Previsão de entrega é obrigatória"
    }
  }

  if (
    typeof dadosRecebidos.valor !== "number" ||
    !Number.isFinite(dadosRecebidos.valor) ||
    dadosRecebidos.valor < 0
  ) {
    return {
      valido: false,
      erro: "Valor deve ser um número maior ou igual a zero"
    }
  }

  if (textoObrigatorioEhInvalido(dadosRecebidos.formaDePagamento)) {
    return {
      valido: false,
      erro: "Forma de pagamento é obrigatória"
    }
  }

  if (!statusEhValido(dadosRecebidos.status)) {
    return {
      valido: false,
      erro: "Status inválido"
    }
  }

  if (textoOpcionalEhInvalido(dadosRecebidos.diagnostico)) {
    return {
      valido: false,
      erro: "Diagnóstico deve ser um texto"
    }
  }

  if (textoOpcionalEhInvalido(dadosRecebidos.servicoRealizado)) {
    return {
      valido: false,
      erro: "Serviço realizado deve ser um texto"
    }
  }

  if (textoOpcionalEhInvalido(dadosRecebidos.pecasUtilizadas)) {
    return {
      valido: false,
      erro: "Peças utilizadas devem ser um texto"
    }
  }

  const dados: DadosOrdem = {
    clienteId: dadosRecebidos.clienteId,
    equipamento: (dadosRecebidos.equipamento as string).trim(),
    problemaRelatado: (dadosRecebidos.problemaRelatado as string).trim(),
    tecnicoResponsavel: (dadosRecebidos.tecnicoResponsavel as string).trim(),
    previsaoDeEntrega: (dadosRecebidos.previsaoDeEntrega as string).trim(),
    valor: dadosRecebidos.valor,
    formaDePagamento: (dadosRecebidos.formaDePagamento as string).trim(),
    status: dadosRecebidos.status,
    ...(typeof dadosRecebidos.diagnostico === "string"
      ? { diagnostico: dadosRecebidos.diagnostico.trim() }
      : {}),
    ...(typeof dadosRecebidos.servicoRealizado === "string"
      ? { servicoRealizado: dadosRecebidos.servicoRealizado.trim() }
      : {}),
    ...(typeof dadosRecebidos.pecasUtilizadas === "string"
      ? { pecasUtilizadas: dadosRecebidos.pecasUtilizadas.trim() }
      : {})
  }

  return {
    valido: true,
    dados
  }
}

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
