// import { Prisma } from "../generated/prisma/client.js"
import { hash } from "bcryptjs"
// import type { PapelUsuario } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js"
import {
    erroDeChaveEstrangeira,
    erroPrismaPossuiCodigo
} from "../lib/prisma-errors.js"
import type { CriarUsuarioInput } from "../validators/usuario.validator.js"


export async function criarUsuarioService(empresaId: number, dados: CriarUsuarioInput) {
    const usuarioSenha = await hash(dados.senha, 12)
    const usuario = await prisma.usuario.create({
        data: {
            empresaId,
            nome: dados.nome,
            email: dados.email,
            senhaHash: usuarioSenha,
            papel: dados.papel

        },
        select: {
            id: true,
            nome: true,
            email: true,
            papel: true,
            ativo: true,
            criadoEm: true,
            atualizadoEm: true
        }
    })

    return usuario
}

