import type { NextFunction, Request, Response } from "express"

import { gatewayPagamentoSimuladoHabilitado } from "../config/env.js"
import {
  buscarCobrancaService,
  confirmarCobrancaSimuladaService,
  criarCobrancaService,
  listarCobrancasService
} from "../services/cobrancas.service.js"
import {
  idCobrancaEhInvalido,
  validarCriacaoCobranca,
  validarListagemCobrancas
} from "../validators/cobrancas.validators.js"

export function permitirSimulacaoForaDeProducao(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (!gatewayPagamentoSimuladoHabilitado()) {
    return res.status(404).json({ erro: "Rota nao encontrada" })
  }

  return next()
}

export async function listarCobrancasController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarListagemCobrancas(req.query)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await listarCobrancasService(
      req.auth.empresaId,
      validacao.dados
    )
    return res.status(200).json(resultado)
  } catch (error) {
    return next(error)
  }
}

export async function buscarCobrancaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)

    if (idCobrancaEhInvalido(id)) {
      return res.status(400).json({ erro: "ID invalido" })
    }

    const cobranca = await buscarCobrancaService(id, req.auth.empresaId)

    if (!cobranca) {
      return res.status(404).json({ erro: "Cobranca nao encontrada" })
    }

    return res.status(200).json(cobranca)
  } catch (error) {
    return next(error)
  }
}

export async function criarCobrancaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const validacao = validarCriacaoCobranca(req.body)

    if (!validacao.valido) {
      return res.status(400).json({
        erro: validacao.erro,
        detalhes: validacao.detalhes
      })
    }

    const resultado = await criarCobrancaService(
      req.auth.empresaId,
      validacao.dados
    )

    if (!resultado.sucesso) {
      if (resultado.motivo === "orcamento_nao_encontrado") {
        return res.status(404).json({ erro: "Orcamento nao encontrado" })
      }

      const respostas = {
        chave_idempotencia_em_uso: [
          "A chave de idempotencia ja foi usada em outra cobranca.",
          "CHAVE_IDEMPOTENCIA_EM_USO"
        ],
        gateway_nao_configurado: [
          "Configure e ative um gateway de pagamento antes de criar cobrancas.",
          "GATEWAY_PAGAMENTO_NAO_CONFIGURADO"
        ],
        pix_nao_habilitado: [
          "Habilite o Pix nas configuracoes de pagamento.",
          "PIX_NAO_HABILITADO"
        ],
        simulador_indisponivel: [
          "O gateway simulado nao esta disponivel neste ambiente.",
          "GATEWAY_SIMULADO_INDISPONIVEL"
        ],
        provedor_nao_conectado: [
          "O provedor selecionado ainda nao foi conectado.",
          "PROVEDOR_PAGAMENTO_NAO_CONECTADO"
        ],
        orcamento_nao_aprovado: [
          "A cobranca so pode ser criada para um orcamento aprovado.",
          "COBRANCA_EXIGE_ORCAMENTO_APROVADO"
        ],
        ordem_nao_pertence_orcamento: [
          "A ordem informada nao pertence ao orcamento.",
          "ORDEM_NAO_PERTENCE_ORCAMENTO"
        ],
        ordem_finalizada: [
          "Nao e possivel criar cobranca para uma ordem finalizada.",
          "COBRANCA_ORDEM_FINALIZADA"
        ],
        sem_saldo_para_cobranca: [
          "Nao existe saldo disponivel para uma nova cobranca.",
          "COBRANCA_SEM_SALDO"
        ]
      } as const
      const [erro, codigo] = respostas[resultado.motivo]

      return res.status(409).json({ erro, codigo })
    }

    return res.status(resultado.reutilizada ? 200 : 201).json(resultado)
  } catch (error) {
    return next(error)
  }
}

export async function confirmarCobrancaSimuladaController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Number(req.params.id)

    if (idCobrancaEhInvalido(id)) {
      return res.status(400).json({ erro: "ID invalido" })
    }

    const resultado = await confirmarCobrancaSimuladaService(
      id,
      req.auth.empresaId
    )

    if (!resultado.sucesso) {
      if (resultado.motivo === "cobranca_nao_encontrada") {
        return res.status(404).json({ erro: "Cobranca nao encontrada" })
      }

      if (resultado.motivo === "cobranca_nao_simulada") {
        return res.status(409).json({
          erro: "Somente cobrancas simuladas podem usar esta operacao.",
          codigo: "COBRANCA_NAO_SIMULADA"
        })
      }

      if (resultado.motivo === "ordem_finalizada") {
        return res.status(409).json({
          erro: "Nao e possivel confirmar cobranca de uma ordem finalizada.",
          codigo: "COBRANCA_ORDEM_FINALIZADA",
          detalhes: { statusAtual: resultado.statusAtual }
        })
      }

      if (resultado.motivo === "orcamento_nao_confirmavel") {
        return res.status(409).json({
          erro: "O orcamento nao permite mais confirmar esta cobranca.",
          codigo: "COBRANCA_ORCAMENTO_NAO_CONFIRMAVEL",
          detalhes: { statusAtual: resultado.statusAtual }
        })
      }

      return res.status(409).json({
        erro: "O estado atual da cobranca nao permite confirmacao.",
        codigo: "COBRANCA_STATUS_NAO_CONFIRMAVEL",
        detalhes: { statusAtual: resultado.statusAtual }
      })
    }

    return res.status(200).json(resultado)
  } catch (error) {
    return next(error)
  }
}
