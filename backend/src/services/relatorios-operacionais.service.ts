import { StatusRegistroPagamento, TipoMovimentacaoEstoque } from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

const TODOS_STATUS = ["RECEBIDO", "EM_ANALISE", "EM_EXECUCAO", "AGUARDANDO_PECA", "PRONTO", "ENTREGUE", "CANCELADO"] as const

export async function gerarRelatorioOperacionalService(
  empresaId: number,
  periodo: { inicio?: Date | undefined; fim?: Date | undefined }
) {
  const fim = periodo.fim ? new Date(periodo.fim) : new Date()
  fim.setUTCHours(23, 59, 59, 999)
  const inicio = periodo.inicio ? new Date(periodo.inicio) : new Date(fim.getTime() - 29 * 86_400_000)
  inicio.setUTCHours(0, 0, 0, 0)

  const [ordens, pagamentos, consumos, produtosBaixos, garantiasAtivas] = await prisma.$transaction([
    prisma.ordemServico.findMany({
      where: { empresaId, criadoEm: { gte: inicio, lte: fim } },
      select: {
        id: true,
        numero: true,
        status: true,
        valor: true,
        equipamento: true,
        criadoEm: true,
        atualizadoEm: true,
        tecnicoResponsavelUsuario: { select: { id: true, nome: true } }
      }
    }),
    prisma.pagamento.findMany({
      where: { empresaId, status: StatusRegistroPagamento.CONFIRMADO, pagoEm: { gte: inicio, lte: fim } },
      select: { valor: true }
    }),
    prisma.movimentacaoEstoque.findMany({
      where: { empresaId, tipo: TipoMovimentacaoEstoque.SAIDA_ORDEM, criadoEm: { gte: inicio, lte: fim } },
      select: { quantidade: true, custoUnitario: true }
    }),
    prisma.produtoEstoque.count({ where: { empresaId, ativo: true, quantidade: { lte: prisma.produtoEstoque.fields.estoqueMinimo } } }),
    prisma.garantiaServico.count({ where: { empresaId, status: "ATIVA", expiraEm: { gte: new Date() } } })
  ])

  const totalRecebido = pagamentos.reduce((soma, item) => soma + Number(item.valor), 0)
  const custoPecas = consumos.reduce((soma, item) => soma + item.quantidade * Number(item.custoUnitario), 0)
  const ordensValidas = ordens.filter(ordem => ordem.status !== "CANCELADO")
  const valorServicos = ordensValidas.reduce((soma, ordem) => soma + Number(ordem.valor), 0)
  const entregues = ordens.filter(ordem => ordem.status === "ENTREGUE")
  const tempoMedioDias = entregues.length
    ? entregues.reduce((soma, ordem) => soma + (ordem.atualizadoEm.getTime() - ordem.criadoEm.getTime()) / 86_400_000, 0) / entregues.length
    : 0

  const porStatus = Object.fromEntries(TODOS_STATUS.map(status => [status, ordens.filter(ordem => ordem.status === status).length]))
  const equipamentos = new Map<string, number>()
  const tecnicos = new Map<string, { id: number; nome: string; ordens: number; entregues: number; valor: number }>()
  for (const ordem of ordensValidas) {
    equipamentos.set(ordem.equipamento, (equipamentos.get(ordem.equipamento) ?? 0) + 1)
    const tecnico = ordem.tecnicoResponsavelUsuario
    if (tecnico) {
      const atual = tecnicos.get(String(tecnico.id)) ?? { ...tecnico, ordens: 0, entregues: 0, valor: 0 }
      atual.ordens += 1
      atual.entregues += ordem.status === "ENTREGUE" ? 1 : 0
      atual.valor += Number(ordem.valor)
      tecnicos.set(String(tecnico.id), atual)
    }
  }

  return {
    periodo: { inicio, fim },
    indicadores: {
      totalOrdens: ordens.length,
      ordensEntregues: entregues.length,
      taxaConclusao: ordens.length ? (entregues.length / ordens.length) * 100 : 0,
      valorServicos,
      totalRecebido,
      custoPecas,
      lucroEstimado: totalRecebido - custoPecas,
      ticketMedio: ordensValidas.length ? valorServicos / ordensValidas.length : 0,
      tempoMedioDias,
      produtosEstoqueBaixo: produtosBaixos,
      garantiasAtivas
    },
    porStatus,
    tecnicos: [...tecnicos.values()].sort((a, b) => b.entregues - a.entregues || b.valor - a.valor),
    equipamentos: [...equipamentos.entries()]
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 8)
  }
}
