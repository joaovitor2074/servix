import { z } from 'zod'
import {
  ITENS_CHECKLIST_ENTRADA,
  STATUS_ORDEM,
} from '../../../shared/types/ordem.types'

// Textos opcionais vazios viram null. Isso permite apagar uma informação já
// registrada sem enviar uma string vazia para o banco.
const textoOpcional = (limite: number) =>
  z.preprocess(
    valor =>
      typeof valor === 'string' && valor.trim() === '' ? null : valor,
    z.string().trim().max(limite).nullable(),
  )

const previsaoSchema = z.preprocess(
  valor =>
    typeof valor === 'string' && valor.trim() === '' ? null : valor,
  z
    .string()
    .refine(valor => !Number.isNaN(new Date(valor).getTime()), {
      message: 'Informe uma data e hora válidas',
    })
    .nullable(),
)

const idUsuarioSchema = z.preprocess(
  valor => typeof valor === 'string' && valor.trim() ? Number(valor) : null,
  z.number().int().positive().nullable(),
)

const booleanoOpcional = z.preprocess(
  valor => valor === 'SIM' ? true : valor === 'NAO' ? false : null,
  z.boolean().nullable(),
)

// As mesmas limitações do validator do backend são aplicadas antes do PATCH,
// permitindo mostrar cada problema ao lado do campo correspondente.
export const editarOrdemSchema = z.object({
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
  checklistEntrada: z.array(z.enum(ITENS_CHECKLIST_ENTRADA)),
  defeitosVisiveis: textoOpcional(2000),
  aparelhoJaAberto: booleanoOpcional,
  aceiteCliente: z.boolean(),
  credencialAcesso: z.string().max(120),
  removerCredencialAcesso: z.boolean(),
  tecnicoResponsavelId: idUsuarioSchema,
  previsaoDeEntrega: previsaoSchema,
  status: z.enum(STATUS_ORDEM),
  mensagemPublica: textoOpcional(500),
})

export type EditarOrdemFormData = z.infer<typeof editarOrdemSchema>
