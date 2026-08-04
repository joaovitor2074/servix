import { z } from "zod"

import { StatusOrdem } from "../generated/prisma/enums.js"
import { validarComSchema } from "./validation.js"

// Os enums vêm do Prisma para que banco, regra de negócio e validação aceitem
// exatamente o mesmo conjunto de valores.
const statusSchema = z.enum([
  StatusOrdem.RECEBIDO,
  StatusOrdem.EM_ANALISE,
  StatusOrdem.EM_EXECUCAO,
  StatusOrdem.AGUARDANDO_PECA,
  StatusOrdem.PRONTO,
  StatusOrdem.ENTREGUE,
  StatusOrdem.CANCELADO
])

const textoOpcional = (limite: number) =>
  z.preprocess(
    valor => valor === "" ? null : valor,
    z.string().trim().max(limite).nullable().optional()
  )

const credencialAcessoSchema = z.preprocess(
  valor => valor === "" ? null : valor,
  z.string().min(1).max(120).nullable().optional()
)

export const ITENS_CHECKLIST_ENTRADA = [
  "TELA_TRINCADA",
  "RISCOS",
  "AMASSADOS",
  "MARCAS_DE_QUEDA",
  "SINAIS_DE_LIQUIDO",
  "NAO_LIGA"
] as const

const idUsuarioOpcional = z.preprocess(
  valor => valor === "" ? null : valor,
  z.number().int().positive().nullable().optional()
)

// A mensagem pública é separada dos campos técnicos. Texto vazio vira nulo e
// uma mensagem real só pode acompanhar uma mudança efetiva de status.
const mensagemPublicaSchema = z.preprocess(
  valor =>
    typeof valor === "string" && valor.trim() === ""
      ? null
      : valor,
  z.string().trim().max(500).nullable().optional()
)

function validarMensagemDeTransicao(
  dados: {
    statusEsperado: StatusOrdem
    status?: StatusOrdem | undefined
    mensagemPublica?: string | null | undefined
  },
  contexto: z.RefinementCtx
) {
  if (
    dados.mensagemPublica != null &&
    (dados.status === undefined || dados.status === dados.statusEsperado)
  ) {
    contexto.addIssue({
      code: "custom",
      path: ["mensagemPublica"],
      message: "A mensagem pública deve acompanhar uma mudança de status"
    })
  }
}

// Datas chegam como texto ISO com fuso e são transformadas em Date para o Prisma.
const dataOpcional = z.preprocess(
  valor => valor === "" ? null : valor,
  z
    .string()
    .datetime({ offset: true })
    .transform(valor => new Date(valor))
    .nullable()
    .optional()
)

// Fonte única das regras dos campos editáveis de uma ordem.
const camposEditaveis = {
  diagnostico: textoOpcional(4000),
  servicoRealizado: textoOpcional(4000),
  pecasUtilizadas: textoOpcional(4000),
  marcaAparelho: textoOpcional(80),
  modeloAparelho: textoOpcional(120),
  imei: textoOpcional(30),
  numeroSerie: textoOpcional(80),
  corAparelho: textoOpcional(60),
  capacidadeAparelho: textoOpcional(60),
  acessoriosEntrada: textoOpcional(1000),
  checklistEntrada: z.array(z.enum(ITENS_CHECKLIST_ENTRADA)).max(6).optional(),
  defeitosVisiveis: textoOpcional(2000),
  aparelhoJaAberto: z.boolean().nullable().optional(),
  aceiteCliente: z.boolean().optional(),
  tecnicoResponsavel: textoOpcional(120),
  tecnicoResponsavelId: idUsuarioOpcional,
  previsaoDeEntrega: dataOpcional,
  status: statusSchema
}

const controleConcorrencia = {
  // O status protege a sequência do fluxo e a versão detecta qualquer edição
  // paralela, inclusive quando os dois usuários mantêm o mesmo status.
  statusEsperado: statusSchema,
  versaoEsperada: z.number().int().positive()
}

// Os campos editáveis são opcionais, mas o cliente precisa enviar a fotografia
// da ordem que carregou e ao menos uma alteração real.
export const atualizarOrdemSchema = z
  .object({
    ...controleConcorrencia,
    diagnostico: camposEditaveis.diagnostico,
    servicoRealizado: camposEditaveis.servicoRealizado,
    pecasUtilizadas: camposEditaveis.pecasUtilizadas,
    marcaAparelho: camposEditaveis.marcaAparelho,
    modeloAparelho: camposEditaveis.modeloAparelho,
    imei: camposEditaveis.imei,
    numeroSerie: camposEditaveis.numeroSerie,
    corAparelho: camposEditaveis.corAparelho,
    capacidadeAparelho: camposEditaveis.capacidadeAparelho,
    acessoriosEntrada: camposEditaveis.acessoriosEntrada,
    checklistEntrada: camposEditaveis.checklistEntrada,
    defeitosVisiveis: camposEditaveis.defeitosVisiveis,
    aparelhoJaAberto: camposEditaveis.aparelhoJaAberto,
    aceiteCliente: camposEditaveis.aceiteCliente,
    credencialAcesso: credencialAcessoSchema,
    tecnicoResponsavel: camposEditaveis.tecnicoResponsavel,
    tecnicoResponsavelId: camposEditaveis.tecnicoResponsavelId,
    previsaoDeEntrega: camposEditaveis.previsaoDeEntrega,
    status: camposEditaveis.status.optional(),
    mensagemPublica: mensagemPublicaSchema
  })
  .strict()
  .refine(
    ({
      statusEsperado: _statusEsperado,
      versaoEsperada: _versaoEsperada,
      mensagemPublica: _mensagemPublica,
      ...campos
    }) => Object.keys(campos).length > 0,
    { message: "Informe ao menos um campo para atualização" }
  )
  .superRefine(validarMensagemDeTransicao)

// Contrato reduzido para a rota dedicada exclusivamente ao status.
export const alterarStatusSchema = z
  .object({
    ...controleConcorrencia,
    status: statusSchema,
    mensagemPublica: mensagemPublicaSchema
  })
  .strict()
  .superRefine(validarMensagemDeTransicao)

// O cancelamento também muda o status e participa do mesmo controle otimista.
export const cancelarOrdemSchema = z
  .object({
    statusEsperado: statusSchema,
    // O DELETE também aceita estes dados na query string, onde números chegam
    // como texto. O corpo JSON continua aceitando um número normalmente.
    versaoEsperada: z.coerce.number().int().positive(),
    mensagemPublica: mensagemPublicaSchema
  })
  .strict()
  .superRefine((dados, contexto) => {
    validarMensagemDeTransicao(
      {
        ...dados,
        status: StatusOrdem.CANCELADO
      },
      contexto
    )
  })

// Filtros de URL são convertidos e recebem limites seguros de paginação.
export const listarOrdensQuerySchema = z
  .object({
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    busca: z.string().trim().max(120).optional(),
    status: statusSchema.optional(),
    clienteId: z.coerce.number().int().positive().optional()
  })
  .strict()

export type AtualizarOrdemInput = z.infer<typeof atualizarOrdemSchema>
export type AlterarStatusOrdemInput = z.infer<typeof alterarStatusSchema>
export type CancelarOrdemInput = z.infer<typeof cancelarOrdemSchema>
export type ListarOrdensQuery = z.infer<typeof listarOrdensQuerySchema>

export function validarAtualizacaoOrdem(dados: unknown) {
  return validarComSchema(atualizarOrdemSchema, dados)
}

export function validarAlteracaoStatus(dados: unknown) {
  return validarComSchema(alterarStatusSchema, dados)
}

export function validarCancelamentoOrdem(dados: unknown) {
  return validarComSchema(cancelarOrdemSchema, dados)
}

export function validarQueryOrdens(dados: unknown) {
  return validarComSchema(listarOrdensQuerySchema, dados)
}

// Mantém IDs inválidos longe da camada de banco.
export function idEhInvalido(id: number): boolean {
  return !Number.isInteger(id) || id <= 0
}
