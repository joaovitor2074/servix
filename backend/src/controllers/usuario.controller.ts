import type { NextFunction, Request, Response } from "express";

import {
    alterarAtivoUsuarioService,
    atualizarUsuarioService,
    buscarUsuarioService,
    criarUsuarioService,
    listarUsuariosAtribuiveisService,
    listarUsuariosService,
    redefinirSenhaUsuarioService
} from "../services/usuario.service.js";
import {
    validarAlteracaoAtivoUsuario,
    validarAtualizacaoUsuario,
    validarCriacaoUsuario,
    validarQueryUsuarios,
    validarRedefinicaoSenhaUsuario
} from "../validators/usuario.validator.js";
import { idEhInvalido } from "../validators/clientes.validators.js";

// As rotas que chegam a estes controllers já passaram por autenticação e pela
// autorização ADMIN configurada em usuarios.routes.ts.

// Lista somente usuários pertencentes à empresa do administrador autenticado.
export async function listarUsuariosController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const validacao = validarQueryUsuarios(req.query)

        if (!validacao.valido) {
            return res.status(400).json({
                erro: validacao.erro,
                detalhes: validacao.detalhes
            })
        }

        const resultado = await listarUsuariosService(req.auth.empresaId, validacao.dados)

        return res.status(200).json(resultado)
    } catch (error) {
        return next(error)
    }
}

// Busca um usuário específico sem permitir acesso cruzado entre empresas.
export async function buscarUsuarioController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const id = Number(req.params.id)

        if (idEhInvalido(id)) {
            return res.status(400).json({ erro: "ID invalido" })
        }

        const usuario = await buscarUsuarioService(id, req.auth.empresaId)

        if (!usuario) {
            return res.status(404).json({
                erro: "Usuário não encontrado"
            })
        }

        return res.status(200).json(usuario)
    } catch (error) {
        return next(error)
    }
}

// Cria um usuário dentro da empresa atual; o service transforma a senha em hash.
export async function criarUsuarioController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const validacao = validarCriacaoUsuario(req.body)

        if (!validacao.valido) {
            return res.status(400).json({
                erro: validacao.erro,
                detalhes: validacao.detalhes
            })
        }

        const resultado = await criarUsuarioService(req.auth.empresaId, validacao.dados)

        if (!resultado.sucesso) {
            return res.status(409).json({
                erro: "Já existe um usuário com este e-mail na empresa"
            })
        }

        return res.status(201).json(resultado.usuario)

    } catch (error) {
        return next(error)
    }
}

// Ativa ou desativa uma conta aplicando proteções administrativas no service.
export async function alterarAtivoUsuarioController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const id = Number(req.params.id)

        if (idEhInvalido(id)) {
            return res.status(400).json({ erro: "ID inválido" })
        }

        const validacao = validarAlteracaoAtivoUsuario(req.body)

        if (!validacao.valido) {
            return res.status(400).json({
                erro: validacao.erro,
                detalhes: validacao.detalhes
            })
        }

        const resultado = await alterarAtivoUsuarioService(
            id,
            req.auth.empresaId,
            req.auth.usuarioId,
            validacao.dados.ativo
        )

        if (!resultado.sucesso) {
            if (resultado.motivo === "usuario_nao_encontrado") {
                return res.status(404).json({
                    erro: "Usuário não encontrado"
                })
            }

            if (resultado.motivo === "propria_conta") {
                return res.status(409).json({
                    erro: "Você não pode desativar a própria conta"
                })
            }

            return res.status(409).json({
                erro: "Não é possível desativar o único administrador ativo"
            })
        }

        return res.status(200).json(resultado.usuario)
    } catch (error) {
        return next(error)
    }
}

// Atualiza nome, e-mail ou papel e traduz os motivos de falha para HTTP.
export async function atualizarUsuarioController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const id = Number(req.params.id)

        if (idEhInvalido(id)) {
            return res.status(400).json({ erro: "ID inválido" })
        }

        const validacao = validarAtualizacaoUsuario(req.body)

        if (!validacao.valido) {
            return res.status(400).json({
                erro: validacao.erro,
                detalhes: validacao.detalhes
            })
        }

        const resultado = await atualizarUsuarioService(
            id,
            validacao.dados,
            req.auth.empresaId,
            req.auth.usuarioId
        )

        if (!resultado.sucesso) {
            if (resultado.motivo === "usuario_nao_encontrado") {
                return res.status(404).json({
                    erro: "Usuário não encontrado"
                })
            }

            if (resultado.motivo === "email_duplicado") {
                return res.status(409).json({
                    erro: "Já existe um usuário com este e-mail na empresa"
                })
            }

            if (resultado.motivo === "propria_conta") {
                return res.status(409).json({
                    erro: "Você não pode remover o próprio acesso de administrador"
                })
            }

            return res.status(409).json({
                erro: "Não é possível rebaixar o único administrador ativo"
            })
        }

        return res.status(200).json(resultado.usuario)
    } catch (error) {
        return next(error)
    }
}

export async function listarUsuariosAtribuiveisController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        return res.status(200).json(
            await listarUsuariosAtribuiveisService(req.auth.empresaId)
        )
    } catch (error) {
        return next(error)
    }
}

export async function redefinirSenhaUsuarioController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const id = Number(req.params.id)
        if (idEhInvalido(id)) return res.status(400).json({ erro: "ID inválido" })

        const validacao = validarRedefinicaoSenhaUsuario(req.body)
        if (!validacao.valido) {
            return res.status(400).json({
                erro: validacao.erro,
                detalhes: validacao.detalhes
            })
        }

        const resultado = await redefinirSenhaUsuarioService(
            id,
            req.auth.empresaId,
            validacao.dados
        )

        if (!resultado.sucesso) {
            return res.status(404).json({ erro: "Usuário não encontrado" })
        }

        return res.status(204).send()
    } catch (error) {
        return next(error)
    }
}

