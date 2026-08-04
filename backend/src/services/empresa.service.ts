import { hash } from "bcryptjs"

import { obterModoBillingServix } from "../billing/billing-servix.config.js"
import {
  buscarPlanoServix,
  VERSAO_TERMOS_SERVIX
} from "../billing/planos-servix.js"
import {
  AmbienteAssinatura,
  PapelUsuario,
  ProvedorAssinatura,
  StatusAssinatura,
  StatusEmpresa
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import type { CriarEmpresaInput } from "../validators/empresa.validators.js"
import {
  DURACAO_TESTE_GRATUITO_DIAS,
  DURACAO_TESTE_GRATUITO_MS
} from "./acesso-empresa.service.js"

// Cria empresa, administrador e o direito local de teste na mesma operacao.
// Nenhum checkout ou recurso do provedor e acionado durante o cadastro.
export async function criarEmpresaService(dados: CriarEmpresaInput) {
  const plano = buscarPlanoServix(dados.planoCodigo)

  if (!plano) {
    throw new Error("Plano Servix invalido")
  }

  const modoBilling = obterModoBillingServix()

  const ambienteAssinatura = modoBilling === "PRODUCAO"
    ? AmbienteAssinatura.PRODUCAO
    : AmbienteAssinatura.TESTE
  const provedorAssinatura = modoBilling === "PRODUCAO"
    ? ProvedorAssinatura.MERCADO_PAGO_SERVIX
    : ProvedorAssinatura.SIMULADO

  const agora = new Date()
  const testeGratisExpiraEm = new Date(
    agora.getTime() + DURACAO_TESTE_GRATUITO_MS
  )
  const administradorSenha = await hash(dados.administrador.senha, 12)
  const empresa = await prisma.empresa.create({
    data: {
      nome: dados.nome,
      slug: dados.slug,
      status: StatusEmpresa.ATIVA,
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
          emailPagador: dados.administrador.email,
          versaoTermos: VERSAO_TERMOS_SERVIX,
          termosAceitosEm: agora,
          testeGratisIniciadoEm: agora,
          testeGratisExpiraEm
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
          status: true,
          testeGratisIniciadoEm: true,
          testeGratisExpiraEm: true
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
    },
    acesso: {
      tipo: "TESTE_GRATUITO" as const,
      ativo: true,
      diasRestantes: DURACAO_TESTE_GRATUITO_DIAS,
      expiraEm: empresa.assinatura.testeGratisExpiraEm
    }
  }
}
