import { hash } from "bcryptjs"

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

// Cria empresa, administrador, configuracao de recebimento e assinatura SaaS
// na mesma operacao. A empresa so podera entrar depois que o checkout de teste
// ativar a assinatura.
export async function criarEmpresaService(dados: CriarEmpresaInput) {
  const plano = buscarPlanoServix(dados.planoCodigo)

  if (!plano) {
    throw new Error("Plano Servix invalido")
  }

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
          ambiente: AmbienteAssinatura.TESTE,
          provedor: ProvedorAssinatura.SIMULADO,
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
