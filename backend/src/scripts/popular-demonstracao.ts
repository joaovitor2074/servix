import "../config/load-env.js"

import { Prisma } from "../generated/prisma/client.js"
import {
  FormaPagamento,
  OrigemPagamento,
  StatusEmpresa,
  StatusOrcamento,
  StatusOrdem,
  StatusRegistroPagamento,
  TipoItemOrcamento
} from "../generated/prisma/enums.js"
import { prisma } from "../lib/prisma.js"

const MARCADOR = "[DEMO-ANUNCIO-SERVIX-2026-07]"

type ResumoCarga = {
  empresa: string
  clientes: number
  orcamentos: number
  ordens: number
  pagamentos: number
}

class SimulacaoConcluida extends Error {
  constructor(readonly resumo: ResumoCarga) {
    super(`SIMULACAO_DEMO_CONCLUIDA:${JSON.stringify(resumo)}`)
  }
}

function variavelObrigatoria(nome: string): string {
  const valor = process.env[nome]?.trim()

  if (!valor) {
    throw new Error(`${nome} nao configurada`)
  }

  return valor
}

function diasAtras(dias: number, hora = 10): Date {
  const data = new Date()
  data.setHours(hora, 0, 0, 0)
  data.setDate(data.getDate() - dias)
  return data
}

function diasDepois(data: Date, dias: number): Date {
  const resultado = new Date(data)
  resultado.setDate(resultado.getDate() + dias)
  return resultado
}

type ItemDemo = {
  descricao: string
  quantidade: number
  valorUnitario: string
  tipo: typeof TipoItemOrcamento[keyof typeof TipoItemOrcamento]
}

type StatusOrcamentoValor =
  typeof StatusOrcamento[keyof typeof StatusOrcamento]
type StatusOrdemValor = typeof StatusOrdem[keyof typeof StatusOrdem]

type OrcamentoDemo = {
  cliente: number
  equipamento: string
  problema: string
  itens: ItemDemo[]
  desconto?: string
  status: typeof StatusOrcamento[keyof typeof StatusOrcamento]
  criadoHaDias: number
  pagamento?: typeof FormaPagamento[keyof typeof FormaPagamento]
  statusOrdem?: typeof StatusOrdem[keyof typeof StatusOrdem]
  tecnico?: string
  diagnostico?: string
  servico?: string
  pecas?: string
}

const clientesDemo = [
  ["Marina Alves", "11990010001", "cliente01@example.com", "Rua das Acacias, 101 - Centro"],
  ["Carlos Mendes", "11990010002", "cliente02@example.com", "Avenida Horizonte, 245 - Jardim Sul"],
  ["Renata Souza", "11990010003", "cliente03@example.com", "Rua do Comercio, 88 - Centro"],
  ["Felipe Rocha", "11990010004", "cliente04@example.com", "Rua Primavera, 430 - Vila Nova"],
  ["Juliana Lima", "11990010005", "cliente05@example.com", "Avenida Central, 712 - Bela Vista"],
  ["Bruno Castro", "11990010006", "cliente06@example.com", "Rua das Palmeiras, 56 - Parque Verde"],
  ["Camila Nogueira", "11990010007", "cliente07@example.com", "Rua do Lago, 193 - Jardim Azul"],
  ["Ricardo Martins", "11990010008", "cliente08@example.com", "Avenida Brasil, 920 - Centro"],
  ["Larissa Gomes", "11990010009", "cliente09@example.com", "Rua Aurora, 317 - Vila Rica"],
  ["Eduardo Freitas", "11990010010", "cliente10@example.com", "Rua das Flores, 144 - Jardim Europa"],
  ["Beatriz Oliveira", "11990010011", "cliente11@example.com", "Avenida das Nacoes, 605 - Centro"],
  ["Andre Ribeiro", "11990010012", "cliente12@example.com", "Rua Monte Azul, 279 - Vila Progresso"]
] as const

const orcamentosDemo: OrcamentoDemo[] = [
  {
    cliente: 0,
    equipamento: "Notebook Dell Inspiron 15",
    problema: "Equipamento nao liga e nao acende os indicadores de energia.",
    itens: [
      { descricao: "Diagnostico eletronico", quantidade: 1, valorUnitario: "90.00", tipo: TipoItemOrcamento.SERVICO },
      { descricao: "Reparo do circuito de alimentacao", quantidade: 1, valorUnitario: "310.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.CONVERTIDO,
    statusOrdem: StatusOrdem.EM_ANALISE,
    criadoHaDias: 5,
    pagamento: FormaPagamento.CARTAO_DEBITO,
    tecnico: "Lucas Ferreira",
    diagnostico: "Analise da placa principal em andamento."
  },
  {
    cliente: 1,
    equipamento: "Smartphone Samsung Galaxy A54",
    problema: "Tela quebrada e touch com falhas na lateral direita.",
    itens: [
      { descricao: "Modulo de tela compativel", quantidade: 1, valorUnitario: "420.00", tipo: TipoItemOrcamento.PECA },
      { descricao: "Substituicao e testes", quantidade: 1, valorUnitario: "140.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    desconto: "20.00",
    status: StatusOrcamento.CONVERTIDO,
    statusOrdem: StatusOrdem.AGUARDANDO_PECA,
    criadoHaDias: 6,
    pagamento: FormaPagamento.CARTAO_CREDITO,
    tecnico: "Mariana Costa",
    diagnostico: "Display e camada de toque danificados.",
    pecas: "Modulo de tela solicitado ao fornecedor."
  },
  {
    cliente: 2,
    equipamento: "Computador gamer Ryzen 7",
    problema: "Desliga durante jogos e apresenta temperatura elevada.",
    itens: [
      { descricao: "Limpeza tecnica completa", quantidade: 1, valorUnitario: "160.00", tipo: TipoItemOrcamento.SERVICO },
      { descricao: "Pasta termica de alta performance", quantidade: 1, valorUnitario: "55.00", tipo: TipoItemOrcamento.MATERIAL },
      { descricao: "Ajuste do sistema de refrigeracao", quantidade: 1, valorUnitario: "95.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.CONVERTIDO,
    statusOrdem: StatusOrdem.EM_EXECUCAO,
    criadoHaDias: 9,
    pagamento: FormaPagamento.DINHEIRO,
    tecnico: "Lucas Ferreira",
    diagnostico: "Superaquecimento causado por obstrucao e pasta termica ressecada.",
    servico: "Limpeza concluida; testes de estabilidade em execucao.",
    pecas: "Pasta termica e pads termicos."
  },
  {
    cliente: 3,
    equipamento: "Impressora Epson EcoTank L3250",
    problema: "Nao puxa papel e apresenta ruido ao iniciar a impressao.",
    itens: [
      { descricao: "Kit de roletes de tracao", quantidade: 1, valorUnitario: "115.00", tipo: TipoItemOrcamento.PECA },
      { descricao: "Manutencao do mecanismo de papel", quantidade: 1, valorUnitario: "185.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.CONVERTIDO,
    statusOrdem: StatusOrdem.PRONTO,
    criadoHaDias: 13,
    pagamento: FormaPagamento.DINHEIRO,
    tecnico: "Mariana Costa",
    diagnostico: "Roletes desgastados e residuos no mecanismo de tracao.",
    servico: "Roletes substituidos, mecanismo limpo e impressao testada.",
    pecas: "Kit de roletes de tracao."
  },
  {
    cliente: 4,
    equipamento: "Console PlayStation 5",
    problema: "Console desliga sozinho depois de alguns minutos de uso.",
    itens: [
      { descricao: "Higienizacao interna", quantidade: 1, valorUnitario: "190.00", tipo: TipoItemOrcamento.SERVICO },
      { descricao: "Revisao do sistema termico", quantidade: 1, valorUnitario: "230.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.CONVERTIDO,
    statusOrdem: StatusOrdem.ENTREGUE,
    criadoHaDias: 31,
    pagamento: FormaPagamento.CARTAO_CREDITO,
    tecnico: "Lucas Ferreira",
    diagnostico: "Fluxo de ar obstruido por acumulo de poeira.",
    servico: "Higienizacao e revisao termica realizadas; teste de carga aprovado.",
    pecas: "Materiais de limpeza tecnica."
  },
  {
    cliente: 5,
    equipamento: "Notebook Lenovo IdeaPad 3",
    problema: "Teclas falhando e dobradica direita com folga.",
    itens: [
      { descricao: "Teclado ABNT2", quantidade: 1, valorUnitario: "180.00", tipo: TipoItemOrcamento.PECA },
      { descricao: "Reparo de dobradica e montagem", quantidade: 1, valorUnitario: "220.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.CONVERTIDO,
    statusOrdem: StatusOrdem.ENTREGUE,
    criadoHaDias: 42,
    pagamento: FormaPagamento.CARTAO_DEBITO,
    tecnico: "Mariana Costa",
    diagnostico: "Membrana do teclado danificada e fixacao da dobradica solta.",
    servico: "Teclado substituido e estrutura da dobradica reforcada.",
    pecas: "Teclado ABNT2 e kit de fixacao."
  },
  {
    cliente: 6,
    equipamento: "Apple iPhone 13",
    problema: "Bateria descarrega rapidamente e aparelho aquece em repouso.",
    itens: [
      { descricao: "Bateria premium compativel", quantidade: 1, valorUnitario: "340.00", tipo: TipoItemOrcamento.PECA },
      { descricao: "Substituicao com testes", quantidade: 1, valorUnitario: "160.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.CONVERTIDO,
    statusOrdem: StatusOrdem.RECEBIDO,
    criadoHaDias: 4,
    pagamento: FormaPagamento.CARTAO_CREDITO
  },
  {
    cliente: 7,
    equipamento: "Monitor LG UltraGear 24",
    problema: "Imagem pisca depois de aquecer e perde sinal em 144 Hz.",
    itens: [
      { descricao: "Analise de fonte e sinal", quantidade: 1, valorUnitario: "120.00", tipo: TipoItemOrcamento.SERVICO },
      { descricao: "Reparo da placa de alimentacao", quantidade: 1, valorUnitario: "280.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.CONVERTIDO,
    statusOrdem: StatusOrdem.EM_EXECUCAO,
    criadoHaDias: 8,
    pagamento: FormaPagamento.CARTAO_DEBITO,
    tecnico: "Lucas Ferreira",
    diagnostico: "Instabilidade no circuito de alimentacao do painel.",
    servico: "Componentes da fonte em substituicao."
  },
  {
    cliente: 8,
    equipamento: "MacBook Air M1",
    problema: "Nao reconhece o carregador e a bateria nao recebe carga.",
    itens: [
      { descricao: "Diagnostico USB-C", quantidade: 1, valorUnitario: "150.00", tipo: TipoItemOrcamento.SERVICO },
      { descricao: "Reparo do circuito de carga", quantidade: 1, valorUnitario: "490.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.CONVERTIDO,
    statusOrdem: StatusOrdem.CANCELADO,
    criadoHaDias: 18,
    pagamento: FormaPagamento.DINHEIRO,
    tecnico: "Mariana Costa",
    diagnostico: "Falha no circuito controlador de carga."
  },
  {
    cliente: 9,
    equipamento: "Tablet Samsung Galaxy Tab S7",
    problema: "Conector USB-C com mau contato.",
    itens: [
      { descricao: "Conector USB-C", quantidade: 1, valorUnitario: "95.00", tipo: TipoItemOrcamento.PECA },
      { descricao: "Microssolda e testes", quantidade: 1, valorUnitario: "260.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.APROVADO,
    criadoHaDias: 4,
    pagamento: FormaPagamento.CARTAO_CREDITO
  },
  {
    cliente: 10,
    equipamento: "Xbox Series S",
    problema: "Saida HDMI sem imagem, embora o console inicialize.",
    itens: [
      { descricao: "Conector HDMI", quantidade: 1, valorUnitario: "110.00", tipo: TipoItemOrcamento.PECA },
      { descricao: "Substituicao HDMI e testes", quantidade: 1, valorUnitario: "320.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.ENVIADO,
    criadoHaDias: 3
  },
  {
    cliente: 11,
    equipamento: "Nobreak SMS 1400 VA",
    problema: "Autonomia muito baixa durante quedas de energia.",
    itens: [
      { descricao: "Bateria selada 12 V", quantidade: 2, valorUnitario: "145.00", tipo: TipoItemOrcamento.PECA },
      { descricao: "Revisao e substituicao do banco de baterias", quantidade: 1, valorUnitario: "170.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.RASCUNHO,
    criadoHaDias: 1
  },
  {
    cliente: 0,
    equipamento: "Roteador Mesh TP-Link Deco",
    problema: "Quedas de conexao entre os pontos da rede.",
    itens: [
      { descricao: "Diagnostico de rede", quantidade: 1, valorUnitario: "120.00", tipo: TipoItemOrcamento.SERVICO },
      { descricao: "Reconfiguracao e atualizacao dos pontos", quantidade: 3, valorUnitario: "70.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.REJEITADO,
    criadoHaDias: 16
  },
  {
    cliente: 3,
    equipamento: "Computador All-in-One Dell",
    problema: "Sistema muito lento e travando ao abrir programas.",
    itens: [
      { descricao: "SSD NVMe 500 GB", quantidade: 1, valorUnitario: "280.00", tipo: TipoItemOrcamento.PECA },
      { descricao: "Instalacao, migracao e otimizacao", quantidade: 1, valorUnitario: "240.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.EXPIRADO,
    criadoHaDias: 24
  },
  {
    cliente: 7,
    equipamento: "Smart TV Samsung 50 polegadas",
    problema: "Possui som, mas a tela permanece escura.",
    itens: [
      { descricao: "Kit de barras de LED", quantidade: 1, valorUnitario: "290.00", tipo: TipoItemOrcamento.PECA },
      { descricao: "Substituicao do backlight", quantidade: 1, valorUnitario: "360.00", tipo: TipoItemOrcamento.SERVICO }
    ],
    status: StatusOrcamento.CANCELADO,
    criadoHaDias: 21
  }
]

function caminhoOrcamento(
  status: OrcamentoDemo["status"]
): StatusOrcamentoValor[] {
  if (status === StatusOrcamento.RASCUNHO) return [StatusOrcamento.RASCUNHO]
  if (status === StatusOrcamento.CANCELADO) {
    return [StatusOrcamento.RASCUNHO, StatusOrcamento.ENVIADO, StatusOrcamento.CANCELADO]
  }

  const caminho: StatusOrcamentoValor[] = [
    StatusOrcamento.RASCUNHO,
    StatusOrcamento.ENVIADO
  ]
  if (status !== StatusOrcamento.ENVIADO) caminho.push(status)
  if (status === StatusOrcamento.CONVERTIDO) {
    caminho.splice(2, 0, StatusOrcamento.APROVADO)
  }
  return caminho
}

function caminhoOrdem(
  status: NonNullable<OrcamentoDemo["statusOrdem"]>
): StatusOrdemValor[] {
  const caminhos: Record<StatusOrdemValor, StatusOrdemValor[]> = {
    [StatusOrdem.RECEBIDO]: [StatusOrdem.RECEBIDO],
    [StatusOrdem.EM_ANALISE]: [StatusOrdem.RECEBIDO, StatusOrdem.EM_ANALISE],
    [StatusOrdem.EM_EXECUCAO]: [StatusOrdem.RECEBIDO, StatusOrdem.EM_ANALISE, StatusOrdem.EM_EXECUCAO],
    [StatusOrdem.AGUARDANDO_PECA]: [StatusOrdem.RECEBIDO, StatusOrdem.EM_ANALISE, StatusOrdem.EM_EXECUCAO, StatusOrdem.AGUARDANDO_PECA],
    [StatusOrdem.PRONTO]: [StatusOrdem.RECEBIDO, StatusOrdem.EM_ANALISE, StatusOrdem.EM_EXECUCAO, StatusOrdem.PRONTO],
    [StatusOrdem.ENTREGUE]: [StatusOrdem.RECEBIDO, StatusOrdem.EM_ANALISE, StatusOrdem.EM_EXECUCAO, StatusOrdem.PRONTO, StatusOrdem.ENTREGUE],
    [StatusOrdem.CANCELADO]: [StatusOrdem.RECEBIDO, StatusOrdem.EM_ANALISE, StatusOrdem.CANCELADO]
  }
  return caminhos[status]
}

const mensagensOrdem = {
  [StatusOrdem.RECEBIDO]: "Equipamento recebido e registrado.",
  [StatusOrdem.EM_ANALISE]: "Equipamento em analise tecnica.",
  [StatusOrdem.EM_EXECUCAO]: "Servico autorizado e em execucao.",
  [StatusOrdem.AGUARDANDO_PECA]: "Aguardando a chegada de uma peca.",
  [StatusOrdem.PRONTO]: "Servico concluido e equipamento pronto para retirada.",
  [StatusOrdem.ENTREGUE]: "Equipamento entregue ao cliente.",
  [StatusOrdem.CANCELADO]: "Atendimento cancelado a pedido do cliente."
} as const

async function executar() {
  if (process.env.POPULAR_DEMO_LISTAR_EMPRESAS?.trim().toUpperCase() === "SIM") {
    const empresas = await prisma.empresa.findMany({
      orderBy: { id: "asc" },
      select: {
        slug: true,
        status: true,
        _count: {
          select: {
            usuarios: true,
            clientes: true,
            orcamentos: true
          }
        }
      }
    })
    console.log("Empresas disponiveis:", empresas)
    return
  }

  if (process.env.POPULAR_DEMO_VERIFICAR?.trim().toUpperCase() === "SIM") {
    const slug = variavelObrigatoria("DEMO_EMPRESA_SLUG").toLowerCase()
    const empresa = await prisma.empresa.findUnique({
      where: { slug },
      select: { id: true }
    })
    if (!empresa) throw new Error(`Empresa ${slug} nao encontrada`)

    const [clientes, orcamentos, pagamentos] = await Promise.all([
      prisma.cliente.count({
        where: { empresaId: empresa.id, observacoes: { contains: MARCADOR } }
      }),
      prisma.orcamento.findMany({
        where: { empresaId: empresa.id, observacoes: { contains: MARCADOR } },
        select: { id: true, status: true }
      }),
      prisma.pagamento.count({
        where: { empresaId: empresa.id, observacao: { contains: MARCADOR } }
      })
    ])
    const ordens = await prisma.ordemServico.findMany({
      where: {
        empresaId: empresa.id,
        orcamentoId: { in: orcamentos.map(item => item.id) }
      },
      select: { status: true }
    })
    const porStatus = (valores: string[]) => valores.reduce<Record<string, number>>(
      (resumo, status) => ({ ...resumo, [status]: (resumo[status] ?? 0) + 1 }),
      {}
    )
    console.log("Verificacao da carga de demonstracao:", {
      empresa: slug,
      clientes,
      orcamentos: orcamentos.length,
      orcamentosPorStatus: porStatus(orcamentos.map(item => item.status)),
      ordens: ordens.length,
      ordensPorStatus: porStatus(ordens.map(item => item.status)),
      pagamentos
    })
    return
  }

  if (variavelObrigatoria("POPULAR_DEMO_CONFIRMAR").toUpperCase() !== "SIM") {
    throw new Error("Defina POPULAR_DEMO_CONFIRMAR=SIM para autorizar a carga")
  }

  const slug = variavelObrigatoria("DEMO_EMPRESA_SLUG").toLowerCase()
  const empresa = await prisma.empresa.findUnique({
    where: { slug },
    include: {
      usuarios: {
        where: { ativo: true },
        orderBy: { id: "asc" }
      }
    }
  })

  if (!empresa) throw new Error(`Empresa ${slug} nao encontrada`)
  if (empresa.status !== StatusEmpresa.ATIVA) {
    throw new Error(`Empresa ${slug} precisa estar ATIVA`)
  }

  const usuario = empresa.usuarios.find(item => item.papel === "ADMIN") ??
    empresa.usuarios[0]
  if (!usuario) throw new Error(`Empresa ${slug} nao possui usuario ativo`)

  const existente = await prisma.cliente.findFirst({
    where: {
      empresaId: empresa.id,
      observacoes: { contains: MARCADOR }
    },
    select: { id: true }
  })

  if (existente) {
    const [clientes, orcamentos, ordens] = await Promise.all([
      prisma.cliente.count({ where: { empresaId: empresa.id, observacoes: { contains: MARCADOR } } }),
      prisma.orcamento.count({ where: { empresaId: empresa.id, observacoes: { contains: MARCADOR } } }),
      prisma.ordemServico.count({ where: { empresaId: empresa.id, orcamento: { observacoes: { contains: MARCADOR } } } })
    ])
    console.log("Carga de demonstracao ja existente:", { slug, clientes, orcamentos, ordens })
    return
  }

  let resultado: ResumoCarga
  try {
    resultado = await prisma.$transaction(async tx => {
    const clientes = []
    for (let indice = 0; indice < clientesDemo.length; indice += 1) {
      const [nome, telefone, email, endereco] = clientesDemo[indice]!
      clientes.push(await tx.cliente.create({
        data: {
          empresaId: empresa.id,
          nome,
          telefone,
          email,
          endereco,
          observacoes: `${MARCADOR} Cadastro ficticio para demonstracao.`,
          criadoEm: diasAtras(48 - indice * 3)
        }
      }))
    }

    const numeracao = await tx.empresa.update({
      where: { id: empresa.id },
      data: {
        proximoNumeroOrcamento: { increment: orcamentosDemo.length },
        proximoNumeroOrdem: {
          increment: orcamentosDemo.filter(item => item.statusOrdem).length
        }
      },
      select: {
        proximoNumeroOrcamento: true,
        proximoNumeroOrdem: true
      }
    })
    const primeiroOrcamento = numeracao.proximoNumeroOrcamento - orcamentosDemo.length
    const primeiroOrdem = numeracao.proximoNumeroOrdem -
      orcamentosDemo.filter(item => item.statusOrdem).length
    let indiceOrdem = 0
    let pagamentos = 0

    for (let indice = 0; indice < orcamentosDemo.length; indice += 1) {
      const demo = orcamentosDemo[indice]!
      const criadoEm = diasAtras(demo.criadoHaDias, 9 + (indice % 5))
      const desconto = new Prisma.Decimal(demo.desconto ?? "0")
      const itens = demo.itens.map(item => ({
        ...item,
        valorUnitario: new Prisma.Decimal(item.valorUnitario),
        valorTotal: new Prisma.Decimal(item.valorUnitario).mul(item.quantidade)
      }))
      const subtotal = itens.reduce(
        (total, item) => total.plus(item.valorTotal),
        new Prisma.Decimal(0)
      )
      const total = subtotal.minus(desconto)
      const caminho = caminhoOrcamento(demo.status)
      const enviadoEm = caminho.includes(StatusOrcamento.ENVIADO)
        ? diasDepois(criadoEm, 1)
        : null
      const aprovadoEm = caminho.includes(StatusOrcamento.APROVADO)
        ? diasDepois(criadoEm, 2)
        : null
      const convertidoEm = demo.status === StatusOrcamento.CONVERTIDO
        ? diasDepois(criadoEm, 3)
        : null

      const orcamento = await tx.orcamento.create({
        data: {
          empresaId: empresa.id,
          clienteId: clientes[demo.cliente]!.id,
          numero: primeiroOrcamento + indice,
          equipamento: demo.equipamento,
          descricaoProblema: demo.problema,
          status: demo.status,
          subtotal,
          desconto,
          total,
          validade: diasDepois(criadoEm, 10),
          observacoes: `${MARCADOR} Orcamento ficticio para demonstracao.`,
          formaPagamentoEscolhida: demo.pagamento ?? FormaPagamento.NAO_INFORMADA,
          versao: caminho.length,
          enviadoEm,
          aprovadoEm,
          convertidoEm,
          criadoEm,
          atualizadoEm: diasDepois(criadoEm, Math.max(0, caminho.length - 1)),
          itens: { create: itens },
          historico: {
            create: caminho.map((status, posicao) => ({
              statusAnterior: posicao === 0 ? null : caminho[posicao - 1]!,
              status,
              versaoResultante: posicao + 1,
              observacao: posicao === 0 ? "Orcamento criado." : "Status atualizado para demonstracao.",
              alteradoPorId: usuario.id,
              criadoEm: diasDepois(criadoEm, posicao)
            }))
          }
        }
      })

      if (!demo.statusOrdem) continue

      const caminhoDaOrdem = caminhoOrdem(demo.statusOrdem)
      const ordemCriadaEm = convertidoEm ?? diasDepois(criadoEm, 3)
      const ordem = await tx.ordemServico.create({
        data: {
          numero: primeiroOrdem + indiceOrdem,
          empresaId: empresa.id,
          clienteId: clientes[demo.cliente]!.id,
          orcamentoId: orcamento.id,
          equipamento: demo.equipamento,
          problemaRelatado: demo.problema,
          diagnostico: demo.diagnostico ?? null,
          servicoRealizado: demo.servico ?? null,
          pecasUtilizadas: demo.pecas ?? null,
          tecnicoResponsavel: demo.tecnico ?? null,
          previsaoDeEntrega: diasDepois(ordemCriadaEm, 7),
          valor: total,
          formaDePagamento: demo.pagamento ?? FormaPagamento.NAO_INFORMADA,
          status: demo.statusOrdem,
          versao: caminhoDaOrdem.length,
          criadoEm: ordemCriadaEm,
          atualizadoEm: diasDepois(ordemCriadaEm, Math.max(0, caminhoDaOrdem.length - 1))
        }
      })
      await tx.historicoStatusOrdem.createMany({
        data: caminhoDaOrdem.map((status, posicao) => ({
          ordemId: ordem.id,
          empresaId: empresa.id,
          statusAnterior: posicao === 0 ? null : caminhoDaOrdem[posicao - 1]!,
          status,
          mensagemPublica: mensagensOrdem[status],
          alteradoPorId: usuario.id,
          criadoEm: diasDepois(ordemCriadaEm, posicao)
        }))
      })
      indiceOrdem += 1

      if (demo.statusOrdem === StatusOrdem.ENTREGUE) {
        await tx.pagamento.create({
          data: {
            empresaId: empresa.id,
            ordemId: ordem.id,
            valor: total,
            formaPagamento: demo.pagamento ?? FormaPagamento.DINHEIRO,
            status: StatusRegistroPagamento.CONFIRMADO,
            origem: OrigemPagamento.MANUAL,
            observacao: `${MARCADOR} Pagamento ficticio para demonstracao.`,
            pagoEm: diasDepois(ordemCriadaEm, caminhoDaOrdem.length - 1),
            registradoPorId: usuario.id,
            criadoEm: diasDepois(ordemCriadaEm, caminhoDaOrdem.length - 1)
          }
        })
        pagamentos += 1
      }
    }

      const resumo = {
        empresa: empresa.slug,
        clientes: clientes.length,
        orcamentos: orcamentosDemo.length,
        ordens: indiceOrdem,
        pagamentos
      }

      if (process.env.POPULAR_DEMO_SIMULAR?.trim().toUpperCase() === "SIM") {
        console.log("Simulacao validada; revertendo a transacao:", resumo)
        throw new SimulacaoConcluida(resumo)
      }

      return resumo
    }, {
      maxWait: 10_000,
      timeout: 60_000
    })
  } catch (error) {
    if (
      error instanceof SimulacaoConcluida ||
      (error instanceof Error && error.message.includes("SIMULACAO_DEMO_CONCLUIDA"))
    ) {
      console.log("Simulacao da carga concluida sem gravar dados.")
      return
    }
    throw error
  }

  console.log("Carga de demonstracao concluida:", resultado)
}

executar()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
