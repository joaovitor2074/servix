import { hash } from "bcryptjs"

import { obterModoBillingServix } from "../billing/billing-servix.config.js"
import { identidadeLegalProducaoConfirmada } from "../config/legal-readiness.js"
import {
  buscarPlanoServix,
  VERSAO_TERMOS_SERVIX
} from "../billing/planos-servix.js"
import { AppError } from "../errors/app-error.js"
import {
  AmbienteAssinatura,
  PapelUsuario,
  ProvedorAssinatura,
  StatusAssinatura,
  StatusEmpresa
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import type { CriarEmpresaInput } from "../validators/empresa.validators.js"

// Cria empresa, administrador, configuracao de recebimento e assinatura SaaS
// na mesma operacao. A empresa so podera entrar depois que o checkout de teste
// ativar a assinatura.
export async function criarEmpresaService(dados: CriarEmpresaInput) {
  const plano = buscarPlanoServix(dados.planoCodigo)

  if (!plano) {
    throw new Error("Plano Servix invalido")
  }

  const modoBilling = obterModoBillingServix()

  if (modoBilling === "BLOQUEADO") {
    throw new AppError(
      "As assinaturas do Servix nao estao configuradas no servidor.",
      503,
      "ASSINATURAS_NAO_CONFIGURADAS"
    )
  }

  if (
    modoBilling === "PRODUCAO" &&
    !identidadeLegalProducaoConfirmada()
  ) {
    throw new AppError(
      "A contratacao em producao ainda nao foi liberada.",
      503,
      "IDENTIDADE_LEGAL_NAO_CONFIGURADA"
    )
  }

  const ambienteAssinatura = modoBilling === "PRODUCAO"
    ? AmbienteAssinatura.PRODUCAO
    : AmbienteAssinatura.TESTE
  const provedorAssinatura = modoBilling === "PRODUCAO"
    ? ProvedorAssinatura.MERCADO_PAGO_SERVIX
    : ProvedorAssinatura.SIMULADO

  const administradorSenha = await hash(dados.administrador.senha, 12)
  const empresa = await prisma.empresa.create({
    data: {
      nome: dados.nome,
      slug: dados.slug,
      status: StatusEmpresa.PENDENTE_ASSINATURA,
      tipoNegocio: dados.tipoNegocio,
      cpfCnpj: dados.cpfCnpj,
      cidade: dados.cidade,
      estado: dados.estado,
      ...(dados.endereco !== undefined && { endereco: dados.endereco }),
      ...(dados.telefone !== undefined && { telefone: dados.telefone }),
      ...(dados.email !== undefined && { email: dados.email }),
      usuarios: {
        create: {
          nome: dados.administrador.nome,
          email: dados.administrador.email,
          telefone: dados.administrador.telefone,
          senhaHash: administradorSenha,
          papel: PapelUsuario.ADMIN
        }
      },
      configuracaoPagamento: {
        // Pagamentos dos clientes comecam manuais e sem credencial. A futura
        // conexao OAuth continuara pertencendo exclusivamente a esta empresa.
        create: {}
      },
      assinatura: {
        // O onboarding inicial nao movimenta dinheiro. A futura cobranca real
        // usara somente credenciais SERVIX_BILLING_* da conta do Servix.
        create: {
          planoCodigo: plano.codigo,
          planoNome: plano.nome,
          valorMensal: plano.valorMensal,
          ambiente: ambienteAssinatura,
          provedor: provedorAssinatura,
          status: StatusAssinatura.PENDENTE,
          versaoTermos: VERSAO_TERMOS_SERVIX,
          termosAceitosEm: new Date()
        }
      }
    },
    select: {
      id: true,
      nome: true,
      slug: true,
      email: true,
      assinatura: {
        select: {
          checkoutToken: true,
          planoCodigo: true,
          planoNome: true,
          valorMensal: true,
          ambiente: true,
          status: true
        }
      }
    }
  })

  if (!empresa.assinatura) {
    throw new Error("Assinatura inicial nao criada")
  }

  return {
    empresa: {
      id: empresa.id,
      nome: empresa.nome,
      slug: empresa.slug,
      email: empresa.email
    },
    assinatura: {
      ...empresa.assinatura,
      valorMensal: empresa.assinatura.valorMensal.toFixed(2)
    }
  }
}
