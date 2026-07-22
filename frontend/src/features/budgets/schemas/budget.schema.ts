import { z } from 'zod'
import { TIPOS_ITEM_ORCAMENTO } from '../types/budget.types'

const numeroMonetario = z.preprocess(
  valor => {
    if (typeof valor === 'string') {
      const normalizado = valor.trim().replace(',', '.')
      return normalizado === '' ? 0 : Number(normalizado)
    }

    return valor
  },
  z
    .number()
    .finite('Informe um valor válido')
    .min(0, 'O valor não pode ser negativo')
    .max(9_999_999_999.99, 'O valor informado é muito alto')
    .multipleOf(0.01, 'Use no máximo duas casas decimais'),
)

const inteiroPositivo = z.preprocess(
  valor => typeof valor === 'string' ? Number(valor) : valor,
  z
    .number()
    .int('A quantidade deve ser um número inteiro')
    .min(1, 'A quantidade mínima é 1')
    .max(1_000_000, 'A quantidade informada é muito alta'),
)

const textoOpcional = z.preprocess(
  valor => typeof valor === 'string' && valor.trim() === '' ? null : valor,
  z.string().trim().max(4_000, 'Use no máximo 4.000 caracteres').nullable(),
)

const validade = z.preprocess(
  valor => typeof valor === 'string' && valor.trim() === '' ? null : valor,
  z
    .string()
    .refine(valor => !Number.isNaN(new Date(valor).getTime()), {
      message: 'Informe uma data de validade válida',
    })
    .nullable(),
)

export const itemOrcamentoSchema = z.object({
  descricao: z
    .string()
    .trim()
    .min(1, 'Descreva o item')
    .max(500, 'A descrição deve possuir no máximo 500 caracteres'),
  quantidade: inteiroPositivo,
  valorUnitario: numeroMonetario,
  tipo: z.enum(TIPOS_ITEM_ORCAMENTO),
})

export const orcamentoSchema = z
  .object({
    clienteId: z.number().int().positive('Selecione um cliente'),
    equipamento: z
      .string()
      .trim()
      .min(1, 'Informe o equipamento')
      .max(500, 'O equipamento deve possuir no máximo 500 caracteres'),
    descricaoProblema: z
      .string()
      .trim()
      .min(1, 'Descreva o problema relatado')
      .max(2_000, 'A descrição deve possuir no máximo 2.000 caracteres'),
    itens: z
      .array(itemOrcamentoSchema)
      .min(1, 'Adicione ao menos um item ao orçamento')
      .max(100, 'O orçamento pode possuir no máximo 100 itens'),
    desconto: numeroMonetario,
    validade,
    observacoes: textoOpcional,
  })
  .superRefine((dados, contexto) => {
    const subtotal = dados.itens.reduce(
      (soma, item) => soma + item.quantidade * item.valorUnitario,
      0,
    )

    if (dados.desconto > subtotal) {
      contexto.addIssue({
        code: 'custom',
        path: ['desconto'],
        message: 'O desconto não pode ser maior que o subtotal',
      })
    }
  })

export type OrcamentoFormData = z.infer<typeof orcamentoSchema>
