import { hash } from "bcryptjs"

import type { Prisma } from "../generated/prisma/client.js"
import { PapelUsuario } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"
import { erroPrismaPossuiCodigo } from "../lib/prisma-errors.js"
import type { CriarUsuarioInput, ListarUsuarioQuery, AtualizarUsuarioInput } from "../validators/usuario.validator.js"

// Lista usuários somente da empresa autenticada e permite buscar por nome ou
// e-mail sem diferenciar letras maiúsculas e minúsculas.
export async function listarUsuariosService(empresaId: number, filtro: ListarUsuarioQuery) {
    const where: Prisma.UsuarioWhereInput = {
        empresaId,
        ...(filtro.busca ? {
            OR: [
                {
                    nome: {
                        contains: filtro.busca,
                        mode: "insensitive"
                    },
                },
                { email: { contains: filtro.busca, mode: "insensitive" } },
            ]
        } : {})
    }

    // O deslocamento indica quantos registros das páginas anteriores ignorar.
    const skip = (filtro.pagina - 1) * filtro.limite

    const [usuarios, total] = await prisma.$transaction([
        prisma.usuario.findMany({
            where,
            skip,
            take: filtro.limite,
            orderBy: {
                nome: "asc"
            },
            select: {
                id: true,
                nome: true,
                email: true,
                papel: true,
                ativo: true,
                criadoEm: true,
                atualizadoEm: true,
            }
        }),
        prisma.usuario.count({ where })

    ])
    return {
        dados: usuarios,
        paginacao: {
            pagina: filtro.pagina,
            limite: filtro.limite,
            total,
            totalPaginas: Math.ceil(total / filtro.limite)
        }
    }
}

// O filtro duplo por id e empresaId impede leitura de usuários de outra empresa.
export async function buscarUsuarioService(id: number, empresaId: number) {
    return prisma.usuario.findFirst({
        where: {
            id,
            empresaId
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
}

// Senhas nunca são salvas diretamente. Apenas o hash bcrypt é persistido e o
// select da resposta não inclui `senhaHash`.
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

// Atualiza os dados permitidos e protege a empresa contra ficar sem um
// administrador ativo.
export async function atualizarUsuarioService(
    id: number,
    dados: AtualizarUsuarioInput,
    empresaId: number
) {
    // Somente campos presentes são enviados ao Prisma.
    const data: Prisma.UsuarioUpdateInput = {
        ...(dados.nome !== undefined && {
            nome: dados.nome
        }),
        ...(dados.email !== undefined && {
            email: dados.email
        }),
        ...(dados.papel !== undefined && {
            papel: dados.papel
        })
    }

    try {
        return await prisma.$transaction(async tx => {
            // A leitura e a possível atualização ocorrem na mesma transação para
            // reduzir condições de corrida nas regras de administrador único.
            const usuarioExistente = await tx.usuario.findFirst({
                where: {
                    id,
                    empresaId
                },
                select: {
                    papel: true,
                    ativo: true
                }
            })

            if (!usuarioExistente) {
                return {
                    sucesso: false as const,
                    motivo: "usuario_nao_encontrado" as const
                }
            }

            if (
                dados.papel !== undefined &&
                dados.papel !== PapelUsuario.ADMIN &&
                usuarioExistente.papel === PapelUsuario.ADMIN &&
                usuarioExistente.ativo
            ) {
                // Um ADMIN ativo só pode ser rebaixado se houver outro ADMIN ativo.
                const administradoresAtivos = await tx.usuario.count({
                    where: {
                        empresaId,
                        papel: PapelUsuario.ADMIN,
                        ativo: true
                    }
                })

                if (administradoresAtivos <= 1) {
                    return {
                        sucesso: false as const,
                        motivo: "unico_administrador" as const
                    }
                }
            }

            const usuario = await tx.usuario.update({
                where: {
                    id,
                    empresaId
                },
                data,
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

            return {
                sucesso: true as const,
                usuario
            }
        })
    } catch (error) {
        // Converte códigos técnicos do banco em motivos compreensíveis para o
        // controller escolher entre respostas 404 e 409.
        if (erroPrismaPossuiCodigo(error, "P2002")) {
            return {
                sucesso: false as const,
                motivo: "email_duplicado" as const
            }
        }

        if (erroPrismaPossuiCodigo(error, "P2025")) {
            return {
                sucesso: false as const,
                motivo: "usuario_nao_encontrado" as const
            }
        }

        throw error
    }
}

// Ativa ou desativa uma conta, impedindo que o administrador atual remova o
// próprio acesso ou desative o último administrador disponível.
export async function alterarAtivoUsuarioService(
    id: number,
    empresaId: number,
    usuarioAutenticadoId: number,
    ativo: boolean
) {
    return prisma.$transaction(async tx => {
        const usuario = await tx.usuario.findFirst({
            where: {
                id,
                empresaId
            },
            select: {
                id: true,
                papel: true,
                ativo: true
            }
        })
        if (!usuario) {
            return {
                sucesso: false as const,
                motivo: "usuario_nao_encontrado" as const
            }
        }

        if (!ativo && usuario.id === usuarioAutenticadoId) {
            return {
                sucesso: false as const,
                motivo: "propria_conta" as const
            }
        }

        if (
            !ativo &&
            usuario.ativo &&
            usuario.papel === PapelUsuario.ADMIN
        ) {
            // Só precisamos contar administradores quando um ADMIN ativo está
            // realmente sendo desativado.
            const administradoresAtivo = await tx.usuario.count({
                where: {
                    empresaId,
                    papel: PapelUsuario.ADMIN,
                    ativo: true
                }
            })

            if (administradoresAtivo <= 1) {
                return {
                    sucesso: false as const,
                    motivo: "unico_administrador" as const
                }
            }
        }

        const usuarioAtualizado = await tx.usuario.update({
            where: {
                id,
                empresaId
            },
            data: {
                ativo
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
        return {
            sucesso: true as const,
            usuario: usuarioAtualizado
        }
    })
}
