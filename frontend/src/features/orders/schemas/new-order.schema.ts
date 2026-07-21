import { z } from 'zod'
import { FORMAS_PAGAMENTO } from '../../../shared/types/ordem.types'

// Entradas opcionais vazias viram null, que é o formato esperado pela API e
// também permite diferenciar "não informado" de um texto preenchido.
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

export const novaOrdemSchema = z.object({
  clienteId: z
    .number()
    .int()
    .positive('Selecione um cliente para continuar'),
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
  tecnicoResponsavel: textoOpcional(120),
  previsaoDeEntrega: previsaoSchema,
  valor: valorSchema,
  formaDePagamento: z.enum(FORMAS_PAGAMENTO),
})

export type NovaOrdemFormData = z.infer<typeof novaOrdemSchema>
