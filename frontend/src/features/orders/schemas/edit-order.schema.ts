import { z } from 'zod'
import {
  FORMAS_PAGAMENTO,
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

const valorSchema = z.preprocess(
  valor => {
    if (typeof valor === 'string' && valor.trim() === '') return 0
    if (typeof valor === 'string') return Number(valor.replace(',', '.'))
    return valor
  },
  z
    .number()
    .finite('Informe um valor válido')
    .min(0, 'O valor não pode ser negativo')
    .max(99_999_999.99, 'O valor informado é muito alto')
    .multipleOf(0.01, 'Use no máximo duas casas decimais'),
)

// As mesmas limitações do validator do backend são aplicadas antes do PATCH,
// permitindo mostrar cada problema ao lado do campo correspondente.
export const editarOrdemSchema = z.object({
  equipamento: z
    .string()
    .trim()
    .min(1, 'Informe o equipamento recebido')
    .max(500, 'O equipamento deve possuir no máximo 500 caracteres'),
  problemaRelatado: z
    .string()
    .trim()
    .min(1, 'Descreva o problema relatado pelo cliente')
    .max(2000, 'O problema deve possuir no máximo 2.000 caracteres'),
  diagnostico: textoOpcional(4000),
  servicoRealizado: textoOpcional(4000),
  pecasUtilizadas: textoOpcional(4000),
  tecnicoResponsavel: textoOpcional(120),
  previsaoDeEntrega: previsaoSchema,
  valor: valorSchema,
  formaDePagamento: z.enum(FORMAS_PAGAMENTO),
  status: z.enum(STATUS_ORDEM),
})

export type EditarOrdemFormData = z.infer<typeof editarOrdemSchema>
