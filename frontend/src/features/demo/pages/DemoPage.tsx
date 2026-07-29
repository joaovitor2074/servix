import { useMemo, useState, type ReactNode } from 'react'
import servixSymbol from '../../../assets/brand/servix-symbol.svg'
import './DemoPage.css'

type DemoView =
  | 'dashboard'
  | 'clientes'
  | 'orcamentos'
  | 'ordens'
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
    description: 'Enxergue prioridades e próximos passos em poucos segundos.',
  },
  {
    id: 'clientes',
    label: 'Clientes',
    shortLabel: '02',
    description: 'Centralize contatos e o histórico de cada atendimento.',
  },
  {
    id: 'orcamentos',
    label: 'Orçamentos',
    shortLabel: '03',
    description: 'Monte propostas claras e receba a decisão do cliente.',
  },
  {
    id: 'ordens',
    label: 'Ordens de serviço',
    shortLabel: '04',
    description: 'Acompanhe o reparo do recebimento até a entrega.',
  },
  {
    id: 'financeiro',
    label: 'Pagamentos',
    shortLabel: '05',
    description: 'Saiba o que foi pago e o que ainda falta receber.',
  },
  {
    id: 'acompanhamento',
    label: 'Visão do cliente',
    shortLabel: '06',
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
  const [notice, setNotice] = useState('')

  const activeIndex = navigation.findIndex(item => item.id === activeView)
  const activeItem = navigation[activeIndex]

  const orderStatusIndex = useMemo(
    () => orderFlow.indexOf(orderStatus),
    [orderStatus],
  )

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

  function resetDemo() {
    setActiveView('dashboard')
    setBudgetApproved(false)
    setOrderStatus(initialOrderStatus)
    setPaymentRegistered(false)
    setCustomerAdded(false)
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

          <div className="demo-topbar__account">
            <div>
              <strong>Conecta Cell</strong>
              <span>Marina · Administradora</span>
            </div>
            <span aria-hidden="true">MC</span>
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
                onAdvance={advanceOrder}
                onOpenTracking={() => selectView('acompanhamento')}
              />
            )}
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

          <section className="demo-reset-card">
            <div>
              <span>Demonstração sem compromisso</span>
              <h2>Experimente quantas vezes quiser</h2>
              <p>
                Todas as informações desta página são fictícias e desaparecem
                ao atualizar ou reiniciar a experiência.
              </p>
            </div>
            <button type="button" onClick={resetDemo}>
              Reiniciar demonstração
            </button>
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
  onAdvance,
  onOpenTracking,
}: {
  status: OrderStatus
  statusIndex: number
  onAdvance: () => void
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
          <span>Recebido no período</span>
          <strong>{formatCurrency(received)}</strong>
          <small>Pagamentos confirmados</small>
        </article>
        <article>
          <span>A receber</span>
          <strong>{formatCurrency(pending)}</strong>
          <small>Ordens com saldo aberto</small>
        </article>
        <article>
          <span>Ticket médio</span>
          <strong>R$ 438,00</strong>
          <small>Por serviço entregue</small>
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
