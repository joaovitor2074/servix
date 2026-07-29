import { z } from 'zod'
import { STATUS_ORDEM } from '../../../shared/types/ordem.types'

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

// As mesmas limitações do validator do backend são aplicadas antes do PATCH,
// permitindo mostrar cada problema ao lado do campo correspondente.
export const editarOrdemSchema = z.object({
  diagnostico: textoOpcional(4000),
  servicoRealizado: textoOpcional(4000),
  pecasUtilizadas: textoOpcional(4000),
  credencialAcesso: z.string().max(120),
  removerCredencialAcesso: z.boolean(),
  tecnicoResponsavel: textoOpcional(120),
  previsaoDeEntrega: previsaoSchema,
  status: z.enum(STATUS_ORDEM),
  mensagemPublica: textoOpcional(500),
})

export type EditarOrdemFormData = z.infer<typeof editarOrdemSchema>
