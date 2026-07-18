import {hash} from "bcryptjs"

import { PapelUsuario } from "../generated/prisma/enums.js"
import {prisma} from "../lib/prisma.js"
import type { CriarEmpresaInput } from "../validators/empresa.validators.js"

export async function criarEmpresaService(dados:CriarEmpresaInput) {
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

