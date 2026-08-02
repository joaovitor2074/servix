import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import servixSymbol from '../../../assets/brand/servix-symbol.svg'
import './DemoPage.css'

type DemoView =
  | 'dashboard'
  | 'kanban'
  | 'clientes'
  | 'orcamentos'
  | 'ordens'
  | 'estoque'
  | 'garantias'
  | 'whatsapp'
  | 'relatorios'
  | 'financeiro'
  | 'acompanhamento'

type OrderStatus =
  | 'Recebido'
  | 'Em análise'
  | 'Em execução'
  | 'Aguardando peça'
  | 'Pronto'

const navigation: Array<{
  id: DemoView
  label: string
  shortLabel: string
  description: string
}> = [
  {
    id: 'dashboard',
    label: 'Visão geral',
    shortLabel: '01',
    description: 'Conheça a nova operação completa do Servix em poucos minutos.',
  },
  {
    id: 'kanban',
    label: 'Kanban',
    shortLabel: '02',
    description: 'Visualize a oficina por etapa e mova cada serviço com clareza.',
  },
  {
    id: 'orcamentos',
    label: 'Orçamento online',
    shortLabel: '03',
    description: 'Envie uma proposta profissional e receba a decisão do cliente.',
  },
  {
    id: 'estoque',
    label: 'Estoque',
    shortLabel: '04',
    description: 'Controle peças, movimentações e alertas de estoque mínimo.',
  },
  {
    id: 'garantias',
    label: 'Garantias',
    shortLabel: '05',
    description: 'Emita certificados e acompanhe prazos sem planilhas.',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    shortLabel: '06',
    description: 'Prepare mensagens por etapa com links e histórico de envios.',
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    shortLabel: '07',
    description: 'Transforme a rotina da assistência em indicadores úteis.',
  },
  {
    id: 'clientes',
    label: 'Clientes',
    shortLabel: '08',
    description: 'Centralize contatos e o histórico de cada atendimento.',
  },
  {
    id: 'ordens',
    label: 'Ordens de serviço',
    shortLabel: '09',
    description: 'Acompanhe o reparo do recebimento até a entrega.',
  },
  {
    id: 'financeiro',
    label: 'Pagamentos',
    shortLabel: '10',
    description: 'Saiba o que foi pago e o que ainda falta receber.',
  },
  {
    id: 'acompanhamento',
    label: 'Visão do cliente',
    shortLabel: '11',
    description: 'Compartilhe transparência sem expor dados internos.',
  },
]

const orderFlow: OrderStatus[] = [
  'Recebido',
  'Em análise',
  'Em execução',
  'Aguardando peça',
  'Pronto',
]

const initialOrderStatus: OrderStatus = 'Em execução'

export default function DemoPage() {
  const [activeView, setActiveView] = useState<DemoView>('dashboard')
  const [budgetApproved, setBudgetApproved] = useState(false)
  const [orderStatus, setOrderStatus] = useState<OrderStatus>(initialOrderStatus)
  const [paymentRegistered, setPaymentRegistered] = useState(false)
  const [customerAdded, setCustomerAdded] = useState(false)
  const [deviceCredentialSaved, setDeviceCredentialSaved] = useState(false)
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false)
  const [kanbanAdvanced, setKanbanAdvanced] = useState(false)
  const [stockAdded, setStockAdded] = useState(false)
  const [whatsappPrepared, setWhatsappPrepared] = useState(false)
  const [notice, setNotice] = useState('')

  const activeIndex = navigation.findIndex(item => item.id === activeView)
  const activeItem = navigation[activeIndex]

  const orderStatusIndex = useMemo(
    () => orderFlow.indexOf(orderStatus),
    [orderStatus],
  )

  useEffect(() => {
    document.title = 'Demonstração | Servix'
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        'Conheça Kanban, orçamento online, estoque, garantias, WhatsApp, relatórios e toda a operação do Servix.',
      )
    document
      .querySelector('meta[name="robots"]')
      ?.setAttribute('content', 'index, follow')
  }, [])

  function selectView(view: DemoView) {
    setActiveView(view)
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function moveTour(direction: -1 | 1) {
    const nextIndex = Math.min(
      navigation.length - 1,
      Math.max(0, activeIndex + direction),
    )
    selectView(navigation[nextIndex].id)
  }

  function approveBudget() {
    setBudgetApproved(true)
    setNotice('Orçamento aprovado na demonstração. Nenhum dado foi enviado.')
  }

  function advanceOrder() {
    const nextIndex = Math.min(orderFlow.length - 1, orderStatusIndex + 1)
    setOrderStatus(orderFlow[nextIndex])
    setNotice(
      nextIndex === orderFlow.length - 1
        ? 'O reparo chegou à etapa Pronto.'
        : `A ordem avançou para ${orderFlow[nextIndex]}.`,
    )
  }

  function registerPayment() {
    setPaymentRegistered(true)
    setNotice('Pagamento demonstrativo registrado com sucesso.')
  }

  function addCustomer() {
    setCustomerAdded(true)
    setNotice('Cliente fictício adicionado somente nesta demonstração.')
  }

  function saveDeviceCredential() {
    setDeviceCredentialSaved(true)
    setNotice('PIN ficticio protegido. Ele nao aparece no recibo nem no link publico.')
  }

  function toggleDocumentPreview() {
    setDocumentPreviewOpen(current => !current)
    setNotice('Visualizacao demonstrativa da OS e do recibo atualizada.')
  }

  function resetDemo() {
    setActiveView('dashboard')
    setBudgetApproved(false)
    setOrderStatus(initialOrderStatus)
    setPaymentRegistered(false)
    setCustomerAdded(false)
    setDeviceCredentialSaved(false)
    setDocumentPreviewOpen(false)
    setKanbanAdvanced(false)
    setStockAdded(false)
    setWhatsappPrepared(false)
    setNotice('Demonstração reiniciada com os dados originais.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="demo-shell">
      <aside className="demo-sidebar" aria-label="Etapas da demonstração">
        <div className="demo-brand">
          <img src={servixSymbol} alt="" />
          <div>
            <strong>servix</strong>
            <span>Demonstração</span>
          </div>
        </div>

        <div className="demo-sidebar__intro">
          <span>Conheça o produto</span>
          <p>Explore como o Servix organiza a rotina de uma assistência técnica.</p>
        </div>

        <nav className="demo-navigation">
          {navigation.map(item => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeView ? 'is-active' : ''}
              onClick={() => selectView(item.id)}
            >
              <span aria-hidden="true">{item.shortLabel}</span>
              <strong>{item.label}</strong>
            </button>
          ))}
        </nav>

        <div className="demo-sidebar__footer">
          <span className="demo-sidebar__privacy-dot" />
          <div>
            <strong>Ambiente seguro</strong>
            <span>Nenhum dado é armazenado</span>
          </div>
        </div>
      </aside>

      <div className="demo-shell__body">
        <header className="demo-topbar">
          <div className="demo-topbar__mobile-brand">
            <img src={servixSymbol} alt="" />
            <strong>servix</strong>
          </div>

          <span className="demo-environment-badge">
            <i /> Ambiente demonstrativo
          </span>

          <div className="demo-topbar__actions">
            <Link to="/planos" className="demo-topbar__plans-link">
              Ver planos
            </Link>

            <div className="demo-topbar__account">
              <div>
                <strong>Conecta Cell</strong>
                <span>Marina · Administradora</span>
              </div>
              <span aria-hidden="true">MC</span>
            </div>
          </div>
        </header>

        <main className="demo-main">
          <section className="demo-tour" aria-labelledby="demo-tour-title">
            <div className="demo-tour__step">
              <span>{String(activeIndex + 1).padStart(2, '0')}</span>
              <i />
              <small>{String(navigation.length).padStart(2, '0')}</small>
            </div>

            <div className="demo-tour__copy">
              <span>Tour guiado</span>
              <h1 id="demo-tour-title">{activeItem.label}</h1>
              <p>{activeItem.description}</p>
            </div>

            <div className="demo-tour__actions">
              <button
                type="button"
                onClick={() => moveTour(-1)}
                disabled={activeIndex === 0}
              >
                Anterior
              </button>
              <button
                type="button"
                className="demo-button demo-button--primary"
                onClick={() => moveTour(1)}
                disabled={activeIndex === navigation.length - 1}
              >
                Próxima etapa
              </button>
            </div>
          </section>

          {notice && (
            <div className="demo-notice" role="status">
              <span aria-hidden="true">✓</span>
              <p>{notice}</p>
              <button type="button" onClick={() => setNotice('')}>
                Fechar
              </button>
            </div>
          )}

          <div className="demo-content">
            {activeView === 'dashboard' && (
              <DemoDashboard onNavigate={selectView} />
            )}
            {activeView === 'kanban' && (
              <DemoKanban
                advanced={kanbanAdvanced}
                onAdvance={() => {
                  setKanbanAdvanced(true)
                  setNotice('OS #1051 movida para Pronto nesta demonstração.')
                }}
              />
            )}
            {activeView === 'clientes' && (
              <DemoCustomers
                customerAdded={customerAdded}
                onAddCustomer={addCustomer}
              />
            )}
            {activeView === 'orcamentos' && (
              <DemoBudgets
                approved={budgetApproved}
                onApprove={approveBudget}
                onOpenOrders={() => selectView('ordens')}
              />
            )}
            {activeView === 'ordens' && (
              <DemoOrders
                status={orderStatus}
                statusIndex={orderStatusIndex}
                deviceCredentialSaved={deviceCredentialSaved}
                documentPreviewOpen={documentPreviewOpen}
                onAdvance={advanceOrder}
                onSaveDeviceCredential={saveDeviceCredential}
                onToggleDocumentPreview={toggleDocumentPreview}
                onOpenTracking={() => selectView('acompanhamento')}
              />
            )}
            {activeView === 'estoque' && (
              <DemoInventory
                stockAdded={stockAdded}
                onAddStock={() => {
                  setStockAdded(true)
                  setNotice('Entrada de 5 telas registrada nesta demonstração.')
                }}
              />
            )}
            {activeView === 'garantias' && (
              <DemoWarranties onIssue={() => setNotice('Certificado demonstrativo preparado para o cliente.')} />
            )}
            {activeView === 'whatsapp' && (
              <DemoWhatsApp
                prepared={whatsappPrepared}
                onPrepare={() => {
                  setWhatsappPrepared(true)
                  setNotice('Mensagem personalizada preparada. Nenhum envio real foi feito.')
                }}
              />
            )}
            {activeView === 'relatorios' && <DemoReports />}
            {activeView === 'financeiro' && (
              <DemoFinance
                paymentRegistered={paymentRegistered}
                onRegisterPayment={registerPayment}
              />
            )}
            {activeView === 'acompanhamento' && (
              <DemoTracking
                status={orderStatus}
                statusIndex={orderStatusIndex}
                paymentRegistered={paymentRegistered}
              />
            )}
          </div>

          <section className="demo-conversion-card" aria-labelledby="demo-conversion-title">
            <div>
              <span>Leve essa organização para a sua empresa</span>
              <h2 id="demo-conversion-title">Pronto para fazer parte do Servix?</h2>
              <p>
                Conheça os planos e escolha o próximo passo para organizar sua
                equipe, seus atendimentos e seus recebimentos.
              </p>
            </div>
            <div className="demo-conversion-card__actions">
              <Link to="/planos" className="demo-conversion-card__primary">
                Conhecer os planos
                <span aria-hidden="true">→</span>
              </Link>
              <button type="button" onClick={resetDemo}>
                Reiniciar demonstração
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

function DemoDashboard({
  onNavigate,
}: {
  onNavigate: (view: DemoView) => void
}) {
  const metrics = [
    { label: 'Serviços em aberto', value: '12', tone: 'blue' },
    { label: 'Aguardando peça', value: '03', tone: 'amber' },
    { label: 'Prontos para entrega', value: '04', tone: 'green' },
    { label: 'Orçamentos pendentes', value: '05', tone: 'purple' },
  ]

  return (
    <section className="demo-section" aria-labelledby="dashboard-title">
      <PageHeading
        id="dashboard-title"
        eyebrow="Central de operações"
        title="Tudo que precisa de atenção, em uma única tela"
        description="A equipe começa o dia sabendo quais serviços avançar, quais clientes responder e quais pagamentos acompanhar."
        action={
          <button
            className="demo-button demo-button--primary"
            type="button"
            onClick={() => onNavigate('orcamentos')}
          >
            Conhecer os orçamentos
          </button>
        }
      />

      <div className="demo-metrics">
        {metrics.map(metric => (
          <article
            className={`demo-metric demo-metric--${metric.tone}`}
            key={metric.label}
          >
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>Atualizado agora</small>
          </article>
        ))}
      </div>

      <section className="demo-feature-launchpad" aria-labelledby="demo-feature-launchpad-title">
        <header>
          <div>
            <span>Novidades do Servix</span>
            <h2 id="demo-feature-launchpad-title">Uma operação completa, do balcão ao pós-venda</h2>
          </div>
          <small>Clique para explorar</small>
        </header>
        <div>
          <FeatureLaunchButton icon="K" title="Kanban" detail="Oficina por etapas" onClick={() => onNavigate('kanban')} />
          <FeatureLaunchButton icon="O" title="Orçamento online" detail="Aprovação pelo cliente" onClick={() => onNavigate('orcamentos')} />
          <FeatureLaunchButton icon="E" title="Estoque" detail="Peças e alertas" onClick={() => onNavigate('estoque')} />
          <FeatureLaunchButton icon="G" title="Garantias" detail="Certificados e prazos" onClick={() => onNavigate('garantias')} />
          <FeatureLaunchButton icon="W" title="WhatsApp" detail="Mensagens prontas" onClick={() => onNavigate('whatsapp')} />
          <FeatureLaunchButton icon="R" title="Relatórios" detail="Indicadores da operação" onClick={() => onNavigate('relatorios')} />
        </div>
      </section>

      <div className="demo-dashboard-grid">
        <DemoCard
          eyebrow="Prioridades"
          title="O que sua equipe precisa resolver"
          description="O Servix transforma informações espalhadas em uma fila objetiva de trabalho."
        >
          <div className="demo-priority-list">
            <PriorityRow
              tone="amber"
              title="Peça pendente"
              subtitle="iPhone 13 · Carlos Almeida"
              detail="Tela OLED aguardando chegada"
              code="OS #1048"
            />
            <PriorityRow
              tone="red"
              title="Pagamento pendente"
              subtitle="Galaxy S22 · Juliana Costa"
              detail="Saldo de R$ 180,00"
              code="OS #1045"
            />
            <PriorityRow
              tone="green"
              title="Pronto para entrega"
              subtitle="Moto G84 · Rafael Lima"
              detail="Cliente já pode retirar"
              code="OS #1042"
            />
          </div>
        </DemoCard>

        <aside className="demo-benefit-card">
          <span>Como isso ajuda sua empresa</span>
          <h2>Menos tempo procurando informações</h2>
          <ul>
            <li>Prioridades visíveis para toda a equipe</li>
            <li>Histórico organizado por cliente e aparelho</li>
            <li>Próximo passo claro em cada atendimento</li>
          </ul>
          <button type="button" onClick={() => onNavigate('clientes')}>
            Ver gestão de clientes
          </button>
        </aside>
      </div>

      <DemoCard
        eyebrow="Andamento"
        title="Serviços recentes"
        description="Acompanhe as ordens movimentadas pela equipe sem depender de anotações ou conversas antigas."
      >
        <div className="demo-table-wrap">
          <table className="demo-table">
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Cliente</th>
                <th>Equipamento</th>
                <th>Status</th>
                <th>Previsão</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>#1051</strong></td>
                <td>Ana Souza</td>
                <td>iPhone 12</td>
                <td><StatusBadge tone="blue">Em análise</StatusBadge></td>
                <td>Hoje, 17h</td>
              </tr>
              <tr>
                <td><strong>#1049</strong></td>
                <td>Bruno Martins</td>
                <td>Galaxy A54</td>
                <td><StatusBadge tone="green">Pronto</StatusBadge></td>
                <td>Disponível</td>
              </tr>
              <tr>
                <td><strong>#1048</strong></td>
                <td>Carlos Almeida</td>
                <td>iPhone 13</td>
                <td><StatusBadge tone="amber">Aguardando peça</StatusBadge></td>
                <td>02 ago</td>
              </tr>
            </tbody>
          </table>
        </div>
      </DemoCard>
    </section>
  )
}

function DemoKanban({
  advanced,
  onAdvance,
}: {
  advanced: boolean
  onAdvance: () => void
}) {
  return (
    <section className="demo-section" aria-labelledby="kanban-title">
      <PageHeading
        id="kanban-title"
        eyebrow="Fluxo visual"
        title="A oficina inteira organizada em um Kanban"
        description="Cada cartão mostra cliente, equipamento, responsável e prazo. A equipe bate o olho e sabe exatamente o que deve avançar."
        action={
          <button className="demo-button demo-button--primary" type="button" onClick={onAdvance} disabled={advanced}>
            {advanced ? 'OS movida para Pronto' : 'Mover OS #1051 para Pronto'}
          </button>
        }
      />

      <div className="demo-kanban-summary">
        <article><span>Em andamento</span><strong>{advanced ? '7' : '8'}</strong><small>ordens ativas</small></article>
        <article><span>Aguardando peça</span><strong>3</strong><small>com pendência</small></article>
        <article><span>Prontos</span><strong>{advanced ? '5' : '4'}</strong><small>para retirada</small></article>
      </div>

      <div className="demo-kanban-board">
        <KanbanColumn title="Recebido" count={2} tone="slate">
          <KanbanCard code="#1054" customer="Paula Nunes" device="MacBook Air M1" owner="Lucas" due="Hoje" />
          <KanbanCard code="#1053" customer="André Lima" device="Galaxy A34" owner="Marina" due="Hoje" />
        </KanbanColumn>
        <KanbanColumn title="Em análise" count={2} tone="blue">
          <KanbanCard code="#1052" customer="Rita Campos" device="iPhone 11" owner="Marina" due="14h" />
          <KanbanCard code="#1050" customer="João Prado" device="Dell Inspiron" owner="Lucas" due="Amanhã" />
        </KanbanColumn>
        <KanbanColumn title="Em execução" count={advanced ? 1 : 2} tone="purple">
          {!advanced && <KanbanCard featured code="#1051" customer="Ana Souza" device="iPhone 12" owner="Lucas" due="Hoje, 17h" />}
          <KanbanCard code="#1047" customer="Nina Reis" device="Moto G84" owner="Marina" due="Amanhã" />
        </KanbanColumn>
        <KanbanColumn title="Pronto" count={advanced ? 3 : 2} tone="green">
          {advanced && <KanbanCard featured code="#1051" customer="Ana Souza" device="iPhone 12" owner="Lucas" due="Retirada" />}
          <KanbanCard code="#1049" customer="Bruno Martins" device="Galaxy A54" owner="Lucas" due="Retirada" />
          <KanbanCard code="#1042" customer="Rafael Lima" device="Moto G84" owner="Marina" due="Retirada" />
        </KanbanColumn>
      </div>
    </section>
  )
}

function DemoInventory({
  stockAdded,
  onAddStock,
}: {
  stockAdded: boolean
  onAddStock: () => void
}) {
  const oledStock = stockAdded ? 7 : 2
  return (
    <section className="demo-section" aria-labelledby="inventory-title">
      <PageHeading
        id="inventory-title"
        eyebrow="Peças e produtos"
        title="Estoque conectado à rotina da assistência"
        description="Acompanhe quantidades, custo, preço de venda e todas as movimentações sem depender de uma planilha separada."
        action={<button className="demo-button demo-button--primary" type="button" onClick={onAddStock} disabled={stockAdded}>{stockAdded ? 'Entrada registrada' : 'Simular entrada de 5 unidades'}</button>}
      />

      <div className="demo-inventory-overview">
        <article><span>Itens cadastrados</span><strong>48</strong><small>42 ativos</small></article>
        <article><span>Valor em estoque</span><strong>R$ 18.420</strong><small>pelo custo atual</small></article>
        <article className={stockAdded ? '' : 'is-alert'}><span>Abaixo do mínimo</span><strong>{stockAdded ? '2' : '3'}</strong><small>pedem reposição</small></article>
      </div>

      <div className="demo-inventory-grid">
        <DemoCard eyebrow="Saldo atual" title="Peças mais utilizadas" description="Alertas aparecem antes que a falta de uma peça pare a oficina.">
          <div className="demo-stock-list">
            <StockRow name="Tela OLED iPhone 12" sku="TEL-IP12-OLED" stock={oledStock} minimum={4} price="R$ 389,90" />
            <StockRow name="Conector USB-C Galaxy A54" sku="CON-A54-USBC" stock={8} minimum={3} price="R$ 79,90" />
            <StockRow name="Pasta térmica 5g" sku="PAS-TERM-5G" stock={16} minimum={5} price="R$ 24,90" />
            <StockRow name="Bateria Moto G84" sku="BAT-MG84" stock={1} minimum={2} price="R$ 159,90" />
          </div>
        </DemoCard>
        <aside className="demo-movement-card">
          <span>Rastreabilidade</span>
          <h2>Últimas movimentações</h2>
          <div>
            {stockAdded && <MovementRow signal="+" title="Entrada de 5 unidades" detail="Tela OLED iPhone 12 · agora" tone="green" />}
            <MovementRow signal="−" title="Usada na OS #1051" detail="Tela OLED iPhone 12 · há 18 min" tone="blue" />
            <MovementRow signal="+" title="Compra recebida" detail="Conector USB-C · ontem" tone="green" />
            <MovementRow signal="−" title="Usada na OS #1049" detail="Pasta térmica · ontem" tone="blue" />
          </div>
          <p>Cada entrada e saída fica registrada com data, ordem e responsável.</p>
        </aside>
      </div>
    </section>
  )
}

function DemoWarranties({ onIssue }: { onIssue: () => void }) {
  return (
    <section className="demo-section" aria-labelledby="warranties-title">
      <PageHeading
        id="warranties-title"
        eyebrow="Pós-venda"
        title="Garantias criadas automaticamente na entrega"
        description="O Servix registra a cobertura, calcula a validade e mantém o certificado ligado à ordem e ao cliente."
        action={<button className="demo-button demo-button--primary" type="button" onClick={onIssue}>Preparar certificado</button>}
      />

      <div className="demo-warranty-summary">
        <article><span>Garantias ativas</span><strong>23</strong><small>serviços protegidos</small></article>
        <article><span>Vencem em 15 dias</span><strong>4</strong><small>acompanhe o prazo</small></article>
        <article><span>Utilizadas no mês</span><strong>2</strong><small>com histórico completo</small></article>
      </div>

      <div className="demo-warranty-grid">
        <DemoCard eyebrow="Controle" title="Certificados recentes" description="Encontre a garantia pelo cliente, aparelho, ordem ou código.">
          <div className="demo-warranty-list">
            <WarrantyRow customer="Bruno Martins" device="Galaxy A54" order="#1049" expires="28 out 2026" status="Ativa" />
            <WarrantyRow customer="Rafael Lima" device="Moto G84" order="#1042" expires="19 out 2026" status="Ativa" />
            <WarrantyRow customer="Juliana Costa" device="Galaxy S22" order="#1038" expires="12 ago 2026" status="Vence em breve" />
          </div>
        </DemoCard>
        <aside className="demo-certificate-card">
          <header><img src={servixSymbol} alt="" /><div><strong>Certificado de garantia</strong><span>GRT-1049-2026</span></div></header>
          <div className="demo-certificate-card__customer"><span>Cliente</span><strong>Bruno Martins</strong><small>Galaxy A54 · OS #1049</small></div>
          <dl><div><dt>Início</dt><dd>30 jul 2026</dd></div><div><dt>Validade</dt><dd>28 out 2026</dd></div><div><dt>Prazo</dt><dd>90 dias</dd></div></dl>
          <p>Cobre o serviço e as peças descritas na ordem, conforme os termos registrados na entrega.</p>
          <button type="button" onClick={onIssue}>Enviar certificado ao cliente</button>
        </aside>
      </div>
    </section>
  )
}

function DemoWhatsApp({
  prepared,
  onPrepare,
}: {
  prepared: boolean
  onPrepare: () => void
}) {
  return (
    <section className="demo-section" aria-labelledby="whatsapp-title">
      <PageHeading
        id="whatsapp-title"
        eyebrow="Comunicação"
        title="WhatsApp organizado dentro do atendimento"
        description="Prepare mensagens com os dados certos, links seguros e textos configurados pela empresa. O envio continua sob controle da equipe."
        action={<button className="demo-button demo-button--whatsapp" type="button" onClick={onPrepare} disabled={prepared}>{prepared ? 'Mensagem preparada' : 'Preparar mensagem'}</button>}
      />

      <div className="demo-whatsapp-mode"><div><i /><span><strong>Envio manual seguro</strong><small>Modo ativo nesta demonstração</small></span></div><span className="demo-whatsapp-api-badge">API oficial disponível</span></div>

      <div className="demo-whatsapp-grid">
        <DemoCard eyebrow="Central do WhatsApp" title="Mensagens pendentes" description="Ordens, orçamentos e garantias ficam em filas fáceis de acompanhar.">
          <div className="demo-whatsapp-tabs"><button className="is-active" type="button">Ordens <span>6</span></button><button type="button">Orçamentos <span>2</span></button><button type="button">Garantias <span>3</span></button></div>
          <div className="demo-whatsapp-list">
            <WhatsAppQueueRow initials="FR" customer="Felipe Rocha" context="OS #1042 · Pronto" text="Seu equipamento está pronto para retirada." highlighted={prepared} />
            <WhatsAppQueueRow initials="AC" customer="Ana Costa" context="Orçamento #208" text="Orçamento disponível para aprovação." />
            <WhatsAppQueueRow initials="BM" customer="Bruno Martins" context="Garantia · 90 dias" text="Certificado de garantia disponível." />
          </div>
        </DemoCard>
        <aside className="demo-chat-card">
          <header><span>FR</span><div><strong>Felipe Rocha</strong><small>WhatsApp · OS #1042</small></div><i /></header>
          <div className="demo-chat-card__body">
            <span>Mensagem preparada pelo Servix</span>
            <blockquote>Olá, Felipe! Seu Moto G84 da ordem #1042 está pronto para retirada. Veja os detalhes no link seguro de acompanhamento — Conecta Cell</blockquote>
            <small>{prepared ? 'Pronta para conferir e abrir no WhatsApp' : 'Clique em “Preparar mensagem” para simular'}</small>
          </div>
          <footer><button type="button" onClick={onPrepare}>{prepared ? 'Abrir no WhatsApp' : 'Preparar agora'}</button></footer>
        </aside>
      </div>

      <div className="demo-whatsapp-benefits"><article><strong>8 modelos editáveis</strong><span>Um texto para cada etapa</span></article><article><strong>Links seguros</strong><span>Orçamento, status e garantia</span></article><article><strong>Histórico de envios</strong><span>Preparada, enviada ou falhou</span></article><article><strong>API oficial opcional</strong><span>Credenciais protegidas</span></article></div>
    </section>
  )
}

function DemoReports() {
  return (
    <section className="demo-section" aria-labelledby="reports-title">
      <PageHeading
        id="reports-title"
        eyebrow="Gestão por indicadores"
        title="Relatórios que mostram onde a operação pode melhorar"
        description="Filtre o período e acompanhe volume, conversão, prazo médio, faturamento e os serviços mais realizados."
        action={<button className="demo-button demo-button--primary" type="button">Exportar relatório</button>}
      />

      <div className="demo-report-filters"><button type="button">Últimos 30 dias</button><span>01 jul — 31 jul 2026</span><small>Dados atualizados agora</small></div>
      <div className="demo-report-metrics">
        <article><span>Ordens abertas</span><strong>48</strong><small>+12% no período</small></article>
        <article><span>Taxa de aprovação</span><strong>76%</strong><small>38 de 50 orçamentos</small></article>
        <article><span>Prazo médio</span><strong>3,2 dias</strong><small>−0,6 dia</small></article>
        <article><span>Faturamento</span><strong>R$ 24.680</strong><small>+18% no período</small></article>
      </div>

      <div className="demo-reports-grid">
        <DemoCard eyebrow="Desempenho" title="Ordens concluídas por semana" description="Uma leitura rápida da capacidade de entrega da equipe.">
          <div className="demo-bars" aria-label="Gráfico de ordens concluídas por semana">
            <ReportBar label="Semana 1" value={62} total="12" />
            <ReportBar label="Semana 2" value={78} total="15" />
            <ReportBar label="Semana 3" value={70} total="14" />
            <ReportBar label="Semana 4" value={92} total="18" />
          </div>
        </DemoCard>
        <DemoCard eyebrow="Serviços" title="Mais realizados" description="Entenda o que mais movimenta a assistência.">
          <ol className="demo-ranking">
            <li><span>01</span><div><strong>Troca de tela</strong><small>18 ordens</small></div><b>R$ 8.420</b></li>
            <li><span>02</span><div><strong>Troca de bateria</strong><small>11 ordens</small></div><b>R$ 3.260</b></li>
            <li><span>03</span><div><strong>Reparo em placa</strong><small>7 ordens</small></div><b>R$ 4.780</b></li>
            <li><span>04</span><div><strong>Limpeza preventiva</strong><small>6 ordens</small></div><b>R$ 1.140</b></li>
          </ol>
        </DemoCard>
      </div>
      <div className="demo-report-insight"><span>Leitura do Servix</span><p><strong>Seu melhor resultado foi na última semana.</strong> A fila de serviços aguardando peça caiu 22%, enquanto as entregas cresceram.</p></div>
    </section>
  )
}

function DemoCustomers({
  customerAdded,
  onAddCustomer,
}: {
  customerAdded: boolean
  onAddCustomer: () => void
}) {
  return (
    <section className="demo-section" aria-labelledby="customers-title">
      <PageHeading
        id="customers-title"
        eyebrow="Relacionamento"
        title="Clientes e atendimentos sempre organizados"
        description="Encontre rapidamente contatos, aparelhos e o histórico de serviços, mesmo quando o cliente retorna meses depois."
        action={
          <button
            type="button"
            className="demo-button demo-button--primary"
            onClick={onAddCustomer}
            disabled={customerAdded}
          >
            {customerAdded ? 'Cliente adicionado' : 'Simular novo cliente'}
          </button>
        }
      />

      <div className="demo-explainer-grid">
        <DemoCard
          eyebrow="Base de clientes"
          title="Informações prontas para o próximo atendimento"
          description="A busca reúne nome, telefone e documento em uma lista simples para a equipe."
        >
          <label className="demo-search">
            <span>Buscar cliente</span>
            <input
              type="search"
              placeholder="Nome, telefone ou CPF/CNPJ"
              readOnly
            />
          </label>

          <div className="demo-customer-list">
            {customerAdded && (
              <CustomerRow
                initials="FC"
                name="Fernanda Castro"
                phone="(11) 98877-6611"
                services="Novo cadastro demonstrativo"
              />
            )}
            <CustomerRow
              initials="CA"
              name="Carlos Almeida"
              phone="(11) 99981-4230"
              services="3 atendimentos · Último em 29 jul"
            />
            <CustomerRow
              initials="JC"
              name="Juliana Costa"
              phone="(11) 99642-1885"
              services="2 atendimentos · Último em 27 jul"
            />
            <CustomerRow
              initials="RL"
              name="Rafael Lima"
              phone="(11) 99120-7744"
              services="1 atendimento · Último em 25 jul"
            />
          </div>
        </DemoCard>

        <div className="demo-explainer-stack">
          <ExplainerCard
            number="01"
            title="Evite cadastros duplicados"
            description="O telefone identifica o cliente dentro da empresa e mantém o histórico no lugar certo."
          />
          <ExplainerCard
            number="02"
            title="Continue de onde parou"
            description="A equipe consulta serviços anteriores antes de iniciar um novo diagnóstico."
          />
          <ExplainerCard
            number="03"
            title="Ganhe agilidade no balcão"
            description="Com o cliente cadastrado, o próximo orçamento já começa com os dados preenchidos."
          />
        </div>
      </div>
    </section>
  )
}

function DemoBudgets({
  approved,
  onApprove,
  onOpenOrders,
}: {
  approved: boolean
  onApprove: () => void
  onOpenOrders: () => void
}) {
  return (
    <section className="demo-section" aria-labelledby="budgets-title">
      <PageHeading
        id="budgets-title"
        eyebrow="Venda com clareza"
        title="Do diagnóstico à aprovação, sem perder informações"
        description="Crie uma proposta detalhada, compartilhe o link e deixe o cliente decidir com segurança."
      />

      <div className="demo-budget-grid">
        <DemoCard
          eyebrow="Orçamento #2038"
          title="Troca de tela — iPhone 13"
          description="Cliente: Carlos Almeida · Válido até 05 de agosto"
        >
          <div className="demo-budget-items">
            <div>
              <span>Tela OLED premium</span>
              <strong>R$ 590,00</strong>
            </div>
            <div>
              <span>Serviço de substituição e testes</span>
              <strong>R$ 160,00</strong>
            </div>
            <div className="demo-budget-total">
              <span>Total do orçamento</span>
              <strong>R$ 750,00</strong>
            </div>
          </div>

          <div className="demo-budget-status">
            <StatusBadge tone={approved ? 'green' : 'blue'}>
              {approved ? 'Aprovado pelo cliente' : 'Aguardando cliente'}
            </StatusBadge>
            <span>
              {approved
                ? 'A decisão ficou registrada e o serviço já pode avançar.'
                : 'O cliente recebeu um link seguro para analisar a proposta.'}
            </span>
          </div>

          <div className="demo-budget-analysis-note">
            <strong>Valor baseado na análise atual</strong>
            <p>
              Se surgir uma necessidade diferente, a assistência envia um
              orçamento revisado. A alteração só avança após nova concordância
              do cliente.
            </p>
          </div>

          <div className="demo-card-actions">
            <button
              type="button"
              className="demo-button demo-button--primary"
              onClick={approved ? onOpenOrders : onApprove}
            >
              {approved ? 'Transformar em ordem' : 'Simular aprovação'}
            </button>
          </div>
        </DemoCard>

        <aside className="demo-public-preview">
          <div className="demo-public-preview__topbar">
            <div>
              <img src={servixSymbol} alt="" />
              <strong>Conecta Cell</strong>
            </div>
            <span>Orçamento online</span>
          </div>
          <div className="demo-public-preview__body">
            <span>Olá, Carlos</span>
            <h2>Seu orçamento está pronto</h2>
            <p>
              Confira os itens, o valor total e as observações da assistência
              antes de responder.
            </p>
            <div>
              <span>iPhone 13 · Tela sem imagem</span>
              <strong>R$ 750,00</strong>
            </div>
            <button type="button" onClick={onApprove} disabled={approved}>
              {approved ? 'Orçamento aprovado' : 'Aprovar orçamento'}
            </button>
            <small>Esta aprovação é apenas uma simulação.</small>
          </div>
        </aside>
      </div>

      <section className="demo-value-strip">
        <ValuePoint
          title="Mais confiança"
          description="O cliente entende exatamente o que será feito e quanto irá pagar."
        />
        <ValuePoint
          title="Menos retrabalho"
          description="Itens, desconto e total permanecem registrados no mesmo orçamento."
        />
        <ValuePoint
          title="Próximo passo automático"
          description="Depois da aprovação, a proposta pode virar uma ordem de serviço."
        />
      </section>
    </section>
  )
}

function DemoOrders({
  status,
  statusIndex,
  deviceCredentialSaved,
  documentPreviewOpen,
  onAdvance,
  onSaveDeviceCredential,
  onToggleDocumentPreview,
  onOpenTracking,
}: {
  status: OrderStatus
  statusIndex: number
  deviceCredentialSaved: boolean
  documentPreviewOpen: boolean
  onAdvance: () => void
  onSaveDeviceCredential: () => void
  onToggleDocumentPreview: () => void
  onOpenTracking: () => void
}) {
  return (
    <section className="demo-section" aria-labelledby="orders-title">
      <PageHeading
        id="orders-title"
        eyebrow="Execução organizada"
        title="Cada aparelho no lugar certo, em cada etapa"
        description="A ordem de serviço reúne diagnóstico, valores, previsão e histórico para que a equipe trabalhe com segurança."
        action={
          <button
            type="button"
            className="demo-button demo-button--primary"
            onClick={onAdvance}
            disabled={statusIndex === orderFlow.length - 1}
          >
            {statusIndex === orderFlow.length - 1
              ? 'Serviço pronto'
              : 'Avançar etapa'}
          </button>
        }
      />

      <div className="demo-order-overview">
        <div>
          <span>OS #1048</span>
          <h2>iPhone 13 · Carlos Almeida</h2>
          <p>Troca de tela OLED e testes completos do aparelho.</p>
        </div>
        <StatusBadge tone={statusTone(status)}>{status}</StatusBadge>
      </div>

      <DemoCard
        eyebrow="Fluxo do serviço"
        title="Acompanhe o reparo de ponta a ponta"
        description="Cada mudança fica registrada e informa claramente o próximo passo."
      >
        <ol className="demo-order-timeline">
          {orderFlow.map((step, index) => {
            const state =
              index < statusIndex
                ? 'is-complete'
                : index === statusIndex
                  ? 'is-current'
                  : ''

            return (
              <li className={state} key={step}>
                <span>{index < statusIndex ? '✓' : index + 1}</span>
                <div>
                  <strong>{step}</strong>
                  <small>{orderStepDescription(step)}</small>
                </div>
              </li>
            )
          })}
        </ol>
      </DemoCard>

      <div className="demo-order-details">
        <DemoCard
          eyebrow="Detalhes técnicos"
          title="Informações para a equipe"
          description="Dados internos ficam protegidos e separados da visualização pública."
        >
          <dl className="demo-detail-list">
            <div><dt>Defeito relatado</dt><dd>Tela sem imagem após queda</dd></div>
            <div><dt>Diagnóstico</dt><dd>Display danificado; demais funções testadas</dd></div>
            <div><dt>Técnico responsável</dt><dd>Lucas Ferreira</dd></div>
            <div><dt>Previsão</dt><dd>02 de agosto, às 17h</dd></div>
          </dl>
        </DemoCard>

        <aside className="demo-message-card">
          <span>Comunicação com o cliente</span>
          <h2>Atualize sem responder a mesma pergunta várias vezes</h2>
          <p>
            Ao mudar o status, a assistência pode incluir uma mensagem clara
            para aparecer no acompanhamento público.
          </p>
          <blockquote>
            “Seu aparelho está em reparo. Assim que finalizarmos os testes,
            avisaremos por aqui.”
          </blockquote>
          <button type="button" onClick={onOpenTracking}>
            Ver página do cliente
          </button>
        </aside>
      </div>

      <section className="demo-order-tools" aria-label="Seguranca e documentos da ordem">
        <article className="demo-security-card">
          <span>Credencial do aparelho</span>
          <h2>PIN ou senha guardado com prote&ccedil;&atilde;o</h2>
          <p>
            A equipe autorizada pode registrar a credencial necess&aacute;ria
            para os testes. O dado fica criptografado, &eacute; ocultado
            automaticamente e nunca aparece no recibo ou no link do cliente.
          </p>
          <div className="demo-credential-box">
            <div>
              <small>PIN demonstrativo</small>
              <strong>{deviceCredentialSaved ? '••••' : 'Nao informado'}</strong>
            </div>
            <button
              type="button"
              onClick={onSaveDeviceCredential}
              disabled={deviceCredentialSaved}
            >
              {deviceCredentialSaved ? 'PIN protegido' : 'Simular cadastro'}
            </button>
          </div>
        </article>

        <article className="demo-document-card">
          <span>OS e recibo para impress&atilde;o</span>
          <h2>Entregue um comprovante claro ao cliente presencial</h2>
          <p>
            O documento re&uacute;ne cliente, aparelho, defeito informado,
            acess&oacute;rios, previs&atilde;o, valores e assinaturas. Quando houver
            pagamento confirmado, tamb&eacute;m registra o recebimento.
          </p>
          <button type="button" onClick={onToggleDocumentPreview}>
            {documentPreviewOpen ? 'Fechar exemplo' : 'Ver exemplo do documento'}
          </button>
        </article>
      </section>

      {documentPreviewOpen && (
        <section className="demo-document-preview" aria-label="Exemplo de ordem de servico para impressao">
          <header>
            <div>
              <span>Conecta Cell</span>
              <strong>ORDEM DE SERVI&Ccedil;O / RECIBO #1048</strong>
            </div>
            <small>Documento demonstrativo</small>
          </header>
          <div className="demo-document-grid">
            <p><span>Cliente</span><strong>Carlos Almeida</strong></p>
            <p><span>Aparelho</span><strong>iPhone 13</strong></p>
            <p><span>Defeito informado</span><strong>Tela sem imagem ap&oacute;s queda</strong></p>
            <p><span>Acess&oacute;rios recebidos</span><strong>Nenhum</strong></p>
            <p><span>Previs&atilde;o</span><strong>02 de agosto, &agrave;s 17h</strong></p>
            <p><span>Total autorizado</span><strong>R$ 750,00</strong></p>
          </div>
          <div className="demo-document-signatures">
            <span>Assinatura do cliente</span>
            <span>Respons&aacute;vel pela assist&ecirc;ncia</span>
          </div>
          <div className="demo-legal-note">
            <strong>Informa&ccedil;&atilde;o ao consumidor</strong>
            <p>
              O prazo de at&eacute; 30 dias do art. 18, &sect; 1&ordm;, do CDC trata do
              saneamento de v&iacute;cio do produto nas situa&ccedil;&otilde;es em que se
              aplica. A previs&atilde;o espec&iacute;fica do reparo permanece registrada
              nesta OS, sem ren&uacute;ncia aos direitos do consumidor.
            </p>
            <small>
              Este comprovante da assist&ecirc;ncia n&atilde;o substitui nota fiscal ou
              NFS-e quando sua emiss&atilde;o for obrigat&oacute;ria.
            </small>
          </div>
        </section>
      )}
    </section>
  )
}

function DemoFinance({
  paymentRegistered,
  onRegisterPayment,
}: {
  paymentRegistered: boolean
  onRegisterPayment: () => void
}) {
  const received = paymentRegistered ? 12480 : 11730
  const pending = paymentRegistered ? 1620 : 2370

  return (
    <section className="demo-section" aria-labelledby="finance-title">
      <PageHeading
        id="finance-title"
        eyebrow="Controle de recebimentos"
        title="Saiba o que entrou e o que ainda falta receber"
        description="Registre pagamentos ligados à ordem de serviço e evite entregar um aparelho com saldo pendente."
        action={
          <button
            type="button"
            className="demo-button demo-button--primary"
            onClick={onRegisterPayment}
            disabled={paymentRegistered}
          >
            {paymentRegistered ? 'Pagamento registrado' : 'Simular pagamento'}
          </button>
        }
      />

      <div className="demo-finance-summary">
        <article>
          <span>Valor dos serviços</span>
          <strong>R$ 14.100,00</strong>
          <small>32 ordens não canceladas</small>
        </article>
        <article>
          <span>Entrou hoje</span>
          <strong>R$ 750,00</strong>
          <small>Pagamentos confirmados</small>
        </article>
        <article>
          <span>Recebido no mês</span>
          <strong>{formatCurrency(received)}</strong>
          <small>Pagamentos confirmados</small>
        </article>
        <article>
          <span>A receber</span>
          <strong>{formatCurrency(pending)}</strong>
          <small>Ordens com saldo aberto</small>
        </article>
      </div>

      <div className="demo-finance-grid">
        <DemoCard
          eyebrow="Recebimentos"
          title="Pagamentos ligados ao atendimento"
          description="A equipe consulta o valor aprovado, o total pago e o saldo da ordem."
        >
          <div className="demo-payment-list">
            <PaymentRow
              code="#1049"
              customer="Bruno Martins"
              value="R$ 420,00"
              status="Pago"
              tone="green"
            />
            <PaymentRow
              code="#1048"
              customer="Carlos Almeida"
              value="R$ 750,00"
              status={paymentRegistered ? 'Pago' : 'Pendente'}
              tone={paymentRegistered ? 'green' : 'amber'}
            />
            <PaymentRow
              code="#1045"
              customer="Juliana Costa"
              value="R$ 360,00"
              status="Parcial"
              tone="blue"
            />
          </div>
        </DemoCard>

        <aside className="demo-benefit-card demo-benefit-card--finance">
          <span>Proteção para sua operação</span>
          <h2>Entregue com mais segurança</h2>
          <p>
            O Servix apresenta o saldo da ordem e ajuda a equipe a confirmar o
            pagamento antes de concluir a entrega.
          </p>
          <div className="demo-balance-box">
            <span>Saldo da OS #1048</span>
            <strong>{paymentRegistered ? 'R$ 0,00' : 'R$ 750,00'}</strong>
            <small>{paymentRegistered ? 'Pagamento confirmado' : 'Aguardando recebimento'}</small>
          </div>
          <div className="demo-receipt-note">
            <strong>Recibo pronto para imprimir</strong>
            <p>
              Pagamentos confirmados podem constar no comprovante da OS. A
              emiss&atilde;o fiscal continua seguindo as regras aplic&aacute;veis &agrave;
              empresa e ao munic&iacute;pio.
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}

function DemoTracking({
  status,
  statusIndex,
  paymentRegistered,
}: {
  status: OrderStatus
  statusIndex: number
  paymentRegistered: boolean
}) {
  return (
    <section className="demo-section" aria-labelledby="tracking-title">
      <PageHeading
        id="tracking-title"
        eyebrow="Experiência do cliente"
        title="Transparência sem expor informações internas"
        description="Cada ordem recebe um link exclusivo com status, previsão, valores e mensagens escolhidas pela assistência."
      />

      <div className="demo-tracking-layout">
        <aside className="demo-tracking-copy">
          <span>O cliente acompanha pelo celular</span>
          <h2>Menos mensagens perguntando “já ficou pronto?”</h2>
          <p>
            O link público apresenta apenas o que o cliente precisa saber. O
            diagnóstico interno, os responsáveis e outras informações da
            empresa continuam protegidos.
          </p>
          <ul>
            <li>Status atualizado do serviço</li>
            <li>Previsão e valor aprovado</li>
            <li>Resumo do pagamento</li>
            <li>Histórico de mensagens públicas</li>
            <li>QR Code impresso abre o acompanhamento direto</li>
            <li>PIN ou senha do aparelho nunca aparece</li>
          </ul>
          <div className="demo-tracking-link">
            <span>Link demonstrativo</span>
            <strong>servix.app/acompanhar/os-1048</strong>
          </div>
        </aside>

        <div className="demo-phone-frame">
          <div className="demo-phone-frame__speaker" />
          <div className="demo-phone-page">
            <header>
              <div>
                <img src={servixSymbol} alt="" />
                <strong>Conecta Cell</strong>
              </div>
              <span>OS #1048</span>
            </header>

            <main>
              <span>Acompanhamento do serviço</span>
              <h2>iPhone 13</h2>
              <StatusBadge tone={statusTone(status)}>{status}</StatusBadge>

              <div className="demo-phone-summary">
                <div><span>Previsão</span><strong>02 ago, 17h</strong></div>
                <div><span>Valor</span><strong>R$ 750,00</strong></div>
                <div>
                  <span>Pagamento</span>
                  <strong>{paymentRegistered ? 'Pago' : 'Pendente'}</strong>
                </div>
              </div>

              <section>
                <h3>Andamento</h3>
                <ol>
                  {orderFlow.map((step, index) => (
                    <li
                      key={step}
                      className={
                        index < statusIndex
                          ? 'is-complete'
                          : index === statusIndex
                            ? 'is-current'
                            : ''
                      }
                    >
                      <i>{index < statusIndex ? '✓' : ''}</i>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <blockquote>
                <strong>Atualização da assistência</strong>
                <p>{publicMessageForStatus(status)}</p>
              </blockquote>
            </main>
          </div>
        </div>
      </div>
    </section>
  )
}

function FeatureLaunchButton({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: string
  title: string
  detail: string
  onClick: () => void
}) {
  return <button type="button" onClick={onClick}><span>{icon}</span><div><strong>{title}</strong><small>{detail}</small></div><i aria-hidden="true">→</i></button>
}

function KanbanColumn({
  title,
  count,
  tone,
  children,
}: {
  title: string
  count: number
  tone: string
  children: ReactNode
}) {
  return <section className={`demo-kanban-column demo-kanban-column--${tone}`}><header><div><i /><strong>{title}</strong></div><span>{count}</span></header><div>{children}</div></section>
}

function KanbanCard({
  code,
  customer,
  device,
  owner,
  due,
  featured = false,
}: {
  code: string
  customer: string
  device: string
  owner: string
  due: string
  featured?: boolean
}) {
  return <article className={featured ? 'is-featured' : ''}><header><strong>{code}</strong><span>•••</span></header><h3>{device}</h3><p>{customer}</p><footer><span>{owner.slice(0, 1)}</span><small>{owner}</small><time>{due}</time></footer></article>
}

function StockRow({
  name,
  sku,
  stock,
  minimum,
  price,
}: {
  name: string
  sku: string
  stock: number
  minimum: number
  price: string
}) {
  const low = stock <= minimum
  return <article><div><strong>{name}</strong><small>{sku}</small></div><span className={low ? 'is-low' : ''}>{stock} un.</span><div><b>{price}</b><small>Mínimo: {minimum}</small></div></article>
}

function MovementRow({ signal, title, detail, tone }: { signal: string; title: string; detail: string; tone: string }) {
  return <article><span className={`is-${tone}`}>{signal}</span><div><strong>{title}</strong><small>{detail}</small></div></article>
}

function WarrantyRow({
  customer,
  device,
  order,
  expires,
  status,
}: {
  customer: string
  device: string
  order: string
  expires: string
  status: string
}) {
  return <article><span>{customer.slice(0, 1)}</span><div><strong>{customer}</strong><small>{device} · OS {order}</small></div><div><b>{expires}</b><small className={status === 'Ativa' ? 'is-active' : 'is-warning'}>{status}</small></div></article>
}

function WhatsAppQueueRow({
  initials,
  customer,
  context,
  text,
  highlighted = false,
}: {
  initials: string
  customer: string
  context: string
  text: string
  highlighted?: boolean
}) {
  return <article className={highlighted ? 'is-highlighted' : ''}><span>{initials}</span><div><header><strong>{customer}</strong><small>{context}</small></header><p>{text}</p></div><i aria-hidden="true">›</i></article>
}

function ReportBar({ label, value, total }: { label: string; value: number; total: string }) {
  return <div><span>{label}</span><div><i style={{ width: `${value}%` }} /></div><strong>{total}</strong></div>
}

function PageHeading({
  id,
  eyebrow,
  title,
  description,
  action,
}: {
  id: string
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="demo-page-heading">
      <div>
        <span>{eyebrow}</span>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </header>
  )
}

function DemoCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <article className="demo-card">
      <header>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <div className="demo-card__body">{children}</div>
    </article>
  )
}

function PriorityRow({
  tone,
  title,
  subtitle,
  detail,
  code,
}: {
  tone: 'amber' | 'red' | 'green'
  title: string
  subtitle: string
  detail: string
  code: string
}) {
  return (
    <div className="demo-priority-row">
      <i className={`demo-priority-row__marker demo-priority-row__marker--${tone}`} />
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
        <small>{detail}</small>
      </div>
      <span>{code}</span>
    </div>
  )
}

function CustomerRow({
  initials,
  name,
  phone,
  services,
}: {
  initials: string
  name: string
  phone: string
  services: string
}) {
  return (
    <div className="demo-customer-row">
      <span aria-hidden="true">{initials}</span>
      <div>
        <strong>{name}</strong>
        <small>{phone}</small>
      </div>
      <p>{services}</p>
      <span className="demo-customer-row__history">Histórico disponível</span>
    </div>
  )
}

function ExplainerCard({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <article className="demo-explainer-card">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </article>
  )
}

function ValuePoint({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <article>
      <span aria-hidden="true">✓</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </article>
  )
}

function PaymentRow({
  code,
  customer,
  value,
  status,
  tone,
}: {
  code: string
  customer: string
  value: string
  status: string
  tone: 'green' | 'amber' | 'blue'
}) {
  return (
    <div className="demo-payment-row">
      <strong>{code}</strong>
      <span>{customer}</span>
      <b>{value}</b>
      <StatusBadge tone={tone}>{status}</StatusBadge>
    </div>
  )
}

function StatusBadge({
  tone,
  children,
}: {
  tone: 'blue' | 'green' | 'amber' | 'red' | 'purple'
  children: ReactNode
}) {
  return <span className={`demo-status demo-status--${tone}`}>{children}</span>
}

function statusTone(status: OrderStatus) {
  if (status === 'Pronto') return 'green' as const
  if (status === 'Aguardando peça') return 'amber' as const
  return 'blue' as const
}

function orderStepDescription(status: OrderStatus) {
  const descriptions: Record<OrderStatus, string> = {
    Recebido: 'Aparelho registrado',
    'Em análise': 'Diagnóstico técnico',
    'Em execução': 'Reparo autorizado',
    'Aguardando peça': 'Compra ou chegada',
    Pronto: 'Testado e liberado',
  }
  return descriptions[status]
}

function publicMessageForStatus(status: OrderStatus) {
  const messages: Record<OrderStatus, string> = {
    Recebido: 'Recebemos seu aparelho e ele entrará na fila de análise.',
    'Em análise': 'Nossa equipe está realizando o diagnóstico técnico.',
    'Em execução': 'O reparo foi iniciado e está seguindo conforme o orçamento aprovado.',
    'Aguardando peça': 'Estamos aguardando a chegada da peça necessária para continuar.',
    Pronto: 'O reparo e os testes foram concluídos. Seu aparelho está pronto para retirada.',
  }
  return messages[status]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
