import type { NextFunction, Request, Response } from "express"

import {
  alterarStatusOrcamentoService,
  aprovarOrcamentoPublicoService,
  atualizarOrcamentoService,
  buscarOrcamentoPublicoService,
  buscarOrcamentoService,
  criarOrcamentoService,
  listarOrcamentosService,
  rejeitarOrcamentoPublicoService,
  transformarOrcamentoEmOrdemService
} from "../services/orcamentos.service.js"
import {
  idOrcamentoEhInvalido,
  tokenOrcamentoEhInvalido,
  validarAcaoPublicaOrcamento,
  validarAprovacaoPublicaOrcamento,
  validarAlteracaoStatusOrcamento,
  validarAtualizacaoOrcamento,
  validarCriacaoOrcamento,
  validarQueryOrcamentos,
  validarTransformacaoOrcamento
} from "../validators/orcamentos.validators.js"
import type { ResultadoValidacao } from "../validators/validation.js"

type FalhaOrcamento = {
  motivo: string
  statusEsperado?: string
  statusAtual?: string
  statusSolicitado?: string
  statusPermitidos?: string[]
  versaoEsperada?: number
  versaoAtual?: number
  subtotal?: unknown
  desconto?: unknown
  campo?: string
  limite?: unknown
}

function responderFalhaOrcamento(res: Response, falha: FalhaOrcamento) {
  if (
    falha.motivo === "orcamento_nao_encontrado" ||
    falha.motivo === "cliente_nao_encontrado"
  ) {
    return res.status(404).json({
      erro: falha.motivo === "cliente_nao_encontrado"
        ? "Cliente nao encontrado"
        : "Orcamento nao encontrado",
      codigo: falha.motivo === "cliente_nao_encontrado"
        ? "CLIENTE_NAO_ENCONTRADO"
        : "ORCAMENTO_NAO_ENCONTRADO"
    })
  }

  if (falha.motivo === "conflito_atualizacao") {
    return res.status(409).json({
      erro: "O orcamento foi alterado por outra pessoa. Recarregue os dados antes de continuar.",
      codigo: "ORCAMENTO_ATUALIZACAO_CONFLITANTE",
      detalhes: {
        statusEsperado: falha.statusEsperado,
        statusAtual: falha.statusAtual,
        versaoEsperada: falha.versaoEsperada,
        versaoAtual: falha.versaoAtual
      }
    })
  }

  if (falha.motivo === "transicao_status_invalida") {
    return res.status(409).json({
      erro: "Transicao de status do orcamento nao permitida",
      codigo: "ORCAMENTO_TRANSICAO_INVALIDA",
      detalhes: {
        statusAtual: falha.statusAtual,
        statusSolicitado: falha.statusSolicitado,
        statusPermitidos: falha.statusPermitidos
      }
    })
  }

  if (falha.motivo === "orcamento_nao_editavel") {
    return res.status(409).json({
      erro: "Somente orcamentos em rascunho podem ser editados",
      codigo: "ORCAMENTO_NAO_EDITAVEL",
      detalhes: { statusAtual: falha.statusAtual }
    })
  }

  if (falha.motivo === "desconto_maior_que_subtotal") {
    return res.status(400).json({
      erro: "O desconto nao pode ser maior que o subtotal",
      codigo: "ORCAMENTO_DESCONTO_INVALIDO",
      detalhes: {
        subtotal: falha.subtotal,
        desconto: falha.desconto
      }
    })
  }

  if (falha.motivo === "valor_excede_limite") {
    return res.status(400).json({
      erro: "Um dos valores excede o limite monetario aceito",
      codigo: "ORCAMENTO_VALOR_EXCEDE_LIMITE",
      detalhes: {
        campo: falha.campo,
        limite: falha.limite
      }
    })
  }

  if (falha.motivo === "orcamento_expirado") {
    return res.status(409).json({
      erro: "O prazo de aprovacao deste orcamento expirou",
      codigo: "ORCAMENTO_EXPIRADO",
      detalhes: {
        statusAtual: falha.statusAtual,
        versaoAtual: falha.versaoAtual
      }
    })
  }

  if (falha.motivo === "pix_indisponivel") {
    return res.status(409).json({
      erro: "O pagamento por Pix nao esta disponivel para esta empresa.",
      codigo: "PIX_INDISPONIVEL"
    })
  }

  if (falha.motivo === "cobranca_paga") {
    return res.status(409).json({
      erro: "O orcamento possui uma cobranca paga e nao pode ser cancelado.",
      codigo: "ORCAMENTO_POSSUI_COBRANCA_PAGA"
    })
  }

  if (falha.motivo === "conversao_inconsistente") {
    return res.status(500).json({
      erro: "O orcamento esta convertido, mas sua ordem nao foi localizada",
      codigo: "ORCAMENTO_CONVERSAO_INCONSISTENTE"
    })
  }

  return res.status(500).json({
    erro: "Nao foi possivel concluir a operacao do orcamento",
    codigo: "ORCAMENTO_OPERACAO_FALHOU"
  })
}

export async function listarOrcamentos(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarQueryOrcamentos(req.query)
    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await listarOrcamentosService(
      req.auth.empresaId,
      validacao.dados
    )
    return res.status(200).json(resultado)
  } catch (error) {
    return next(error)
  }
}

export async function buscarOrcamento(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)
    if (idOrcamentoEhInvalido(id)) {
      return res.status(400).json({ erro: "ID invalido" })
    }

    const orcamento = await buscarOrcamentoService(id, req.auth.empresaId)
    if (!orcamento) {
      return res.status(404).json({
        erro: "Orcamento nao encontrado",
        codigo: "ORCAMENTO_NAO_ENCONTRADO"
      })
    }

    return res.status(200).json(orcamento)
  } catch (error) {
    return next(error)
  }
}

export async function criarOrcamento(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarCriacaoOrcamento(req.body)
    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await criarOrcamentoService(
      req.auth.empresaId,
      req.auth.usuarioId,
      validacao.dados
    )
    if (!resultado.sucesso) {
      return responderFalhaOrcamento(res, resultado)
    }

    return res.status(201).json(resultado.orcamento)
  } catch (error) {
    return next(error)
  }
}

export async function atualizarOrcamento(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)
    if (idOrcamentoEhInvalido(id)) {
      return res.status(400).json({ erro: "ID invalido" })
    }

    const validacao = validarAtualizacaoOrcamento(req.body)
    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await atualizarOrcamentoService(
      id,
      req.auth.empresaId,
      validacao.dados
    )
    if (!resultado.sucesso) {
      return responderFalhaOrcamento(res, resultado)
    }

    return res.status(200).json(resultado.orcamento)
  } catch (error) {
    return next(error)
  }
}

export async function alterarStatusOrcamento(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)
    if (idOrcamentoEhInvalido(id)) {
      return res.status(400).json({ erro: "ID invalido" })
    }

    const validacao = validarAlteracaoStatusOrcamento(req.body)
    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await alterarStatusOrcamentoService(
      id,
      req.auth.empresaId,
      req.auth.usuarioId,
      validacao.dados
    )
    if (!resultado.sucesso) {
      return responderFalhaOrcamento(res, resultado)
    }

    return res.status(200).json(resultado.orcamento)
  } catch (error) {
    return next(error)
  }
}

export async function transformarOrcamentoEmOrdem(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)
    if (idOrcamentoEhInvalido(id)) {
      return res.status(400).json({ erro: "ID invalido" })
    }

    const validacao = validarTransformacaoOrcamento(req.body)
    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await transformarOrcamentoEmOrdemService(
      id,
      req.auth.empresaId,
      req.auth.usuarioId,
      validacao.dados
    )
    if (!resultado.sucesso) {
      return responderFalhaOrcamento(res, resultado)
    }

    return res.status(resultado.jaExistente ? 200 : 201).json({
      ordem: resultado.ordem,
      jaExistente: resultado.jaExistente
    })
  } catch (error) {
    return next(error)
  }
}

export async function buscarOrcamentoPublico(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    res.setHeader("Cache-Control", "no-store")
    const token = req.params.token
    if (tokenOrcamentoEhInvalido(token)) {
      return res.status(400).json({ erro: "Token invalido" })
    }
    const tokenNormalizado = typeof token === "string" ? token.trim() : ""

    const orcamento = await buscarOrcamentoPublicoService(tokenNormalizado)
    if (!orcamento) {
      return res.status(404).json({
        erro: "Orcamento nao encontrado",
        codigo: "ORCAMENTO_NAO_ENCONTRADO"
      })
    }

    return res.status(200).json(orcamento)
  } catch (error) {
    return next(error)
  }
}

type ResultadoAcaoPublica = Awaited<
  ReturnType<typeof aprovarOrcamentoPublicoService>
> | Awaited<ReturnType<typeof rejeitarOrcamentoPublicoService>>

async function executarAcaoPublica<T>(
  acao: (token: string, dados: T) => Promise<ResultadoAcaoPublica>,
  validar: (dados: unknown) => ResultadoValidacao<T>,
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    res.setHeader("Cache-Control", "no-store")
    const token = req.params.token
    if (tokenOrcamentoEhInvalido(token)) {
      return res.status(400).json({ erro: "Token invalido" })
    }
    const tokenNormalizado = typeof token === "string" ? token.trim() : ""

    const validacao = validar(req.body)
    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await acao(tokenNormalizado, validacao.dados)
    if (!resultado.sucesso) {
      return responderFalhaOrcamento(res, resultado)
    }

    return res.status(200).json(resultado.orcamento)
  } catch (error) {
    return next(error)
  }
}

export function aprovarOrcamentoPublico(
  req: Request,
  res: Response,
  next: NextFunction
) {
  return executarAcaoPublica(
    aprovarOrcamentoPublicoService,
    validarAprovacaoPublicaOrcamento,
    req,
    res,
    next
  )
}

export function rejeitarOrcamentoPublico(
  req: Request,
  res: Response,
  next: NextFunction
) {
  return executarAcaoPublica(
    rejeitarOrcamentoPublicoService,
    validarAcaoPublicaOrcamento,
    req,
    res,
    next
  )
}
