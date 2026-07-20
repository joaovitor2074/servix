import {hash} from "bcryptjs"

import { PapelUsuario } from "../generated/prisma/enums.js"
import {prisma} from "../lib/prisma.js"
import type { CriarEmpresaInput } from "../validators/empresa.validators.js"

// A empresa e seu primeiro administrador são criados pela mesma operação
// aninhada do Prisma. Se uma parte falhar, nenhuma das duas fica incompleta.
export async function criarEmpresaService(dados:CriarEmpresaInput) {
    // O custo 12 do bcrypt torna tentativas de descobrir a senha mais caras.
    const administradorSenha  = await hash(dados.administrador.senha,12)

    const empresa = await prisma.empresa.create({
        data:{
            nome:dados.nome,
            slug:dados.slug.trim().toLowerCase(),
            ...(dados.telefone !== undefined &&{
                telefone:dados.telefone
            }),
            ...(dados.email !==undefined && {
                email:dados.email.trim().toLowerCase()
            }),
            usuarios:{
                // A relação aninhada associa automaticamente o novo usuário à
                // empresa que está sendo criada.
                create:{
                    nome:dados.administrador.nome.trim(),
                    email:dados.administrador.email.trim().toLowerCase(),
                    senhaHash:administradorSenha,
                    papel:PapelUsuario.ADMIN
                }
            }
        }
    })

    
    return empresa
}

