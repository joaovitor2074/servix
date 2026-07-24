import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router'
import {
  buscarCliente,
  ClienteApiError,
} from '../../clients/services/clients.service'
import type { Cliente } from '../../clients/types/client.types'
import ClientSelector from '../../orders/components/ClientSelector'
import { orcamentoSchema } from '../schemas/budget.schema'
import {
  atualizarOrcamento,
  buscarOrcamento,
  criarOrcamento,
  OrcamentoApiError,
} from '../services/budgets.service'
import {
  TIPO_ITEM_ORCAMENTO_LABELS,
  TIPOS_ITEM_ORCAMENTO,
  type CriarOrcamentoInput,
  type Orcamento,
  type TipoItemOrcamento,
} from '../types/budget.types'
import { formatarMoeda } from '../utils/budget-formatters'
import './BudgetFormPage.css'

interface ItemRascunho {
  chave: string
  descricao: string
  quantidade: string
  valorUnitario: string
  tipo: TipoItemOrcamento
}

interface RascunhoOrcamento {
  equipamento: string
  descricaoProblema: string
  desconto: string
  validade: string
  observacoes: string
  itens: ItemRascunho[]
}

interface FalhaCliente {
  clienteId: number | null
  mensagem: string
  recuperavel: boolean
}

let sequenciaItem = 0

function novoItem(
  valores: Partial<Omit<ItemRascunho, 'chave'>> = {},
): ItemRascunho {
  sequenciaItem += 1
  return {
    chave: `item-${sequenciaItem}`,
    descricao: valores.descricao ?? '',
    quantidade: valores.quantidade ?? '1',
    valorUnitario: valores.valorUnitario ?? '',
    tipo: valores.tipo ?? 'SERVICO',
  }
}

export default function BudgetFormPage() {
  const { id: idParam } = useParams()
  const editando = idParam !== undefined
  const orcamentoId = Number(idParam)
  const idValido = Number.isInteger(orcamentoId) && orcamentoId > 0
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const clienteIdDaUrl = lerIdPositivo(searchParams.get('clienteId'))
  const [rascunhoInicial] = useState(() =>
    lerRascunhoDaNavegacao(location.state),
  )
  const formularioRef = useRef<HTMLFormElement | null>(null)
  const envioEmAndamento = useRef(false)

  const [orcamento, setOrcamento] = useState<Orcamento | null>(null)
  const [carregandoOrcamento, setCarregandoOrcamento] = useState(editando)
  const [erroOrcamento, setErroOrcamento] = useState('')
  const [tentativaOrcamento, setTentativaOrcamento] = useState(0)
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null)
  const [falhaCliente, setFalhaCliente] = useState<FalhaCliente | null>(null)
  const [tentativaCliente, setTentativaCliente] = useState(0)
  const [clienteIgnorado, setClienteIgnorado] = useState<number | null>(null)
  const [itens, setItens] = useState<ItemRascunho[]>(() =>
    rascunhoInicial?.itens.length
      ? rascunhoInicial.itens
      : [novoItem()],
  )
  const [desconto, setDesconto] = useState(
    () => rascunhoInicial?.desconto ?? '0',
  )
  const [salvando, setSalvando] = useState(false)
  const [erroApi, setErroApi] = useState('')
  const [exigeRecarregamento, setExigeRecarregamento] = useState(false)
  const [errosCampos, setErrosCampos] = useState<
    Record<string, string[] | undefined>
  >({})

  useEffect(() => {
    if (!editando || !idValido) return

    const controller = new AbortController()
    void buscarOrcamento(orcamentoId, { signal: controller.signal })
      .then(resultado => {
        setOrcamento(resultado)
        setItens(
          resultado.itens.map(item =>
            novoItem({
              descricao: item.descricao,
              quantidade: String(item.quantidade),
              valorUnitario: item.valorUnitario,
              tipo: item.tipo,
            }),
          ),
        )
        setDesconto(resultado.desconto)
        setErroOrcamento('')
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErroOrcamento(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o orçamento',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregandoOrcamento(false)
      })

    return () => controller.abort()
  }, [editando, idValido, orcamentoId, tentativaOrcamento])

  const clienteIdNecessario =
    clienteIdDaUrl ?? (editando ? orcamento?.clienteId ?? null : null)
  const clienteSelecionadoId = clienteSelecionado?.id ?? null
  const falhaClienteAtual =
    falhaCliente?.clienteId === clienteIdNecessario ? falhaCliente : null

  useEffect(() => {
    if (!clienteIdNecessario) return
    if (
      clienteSelecionadoId === clienteIdNecessario ||
      clienteIgnorado === clienteIdNecessario
    ) {
      return
    }

    const controller = new AbortController()

    void buscarCliente(clienteIdNecessario, { signal: controller.signal })
      .then(cliente => {
        setClienteSelecionado(cliente)
        setFalhaCliente(null)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return

        const naoEncontrado =
          error instanceof ClienteApiError && error.status === 404
        setFalhaCliente({
          clienteId: clienteIdNecessario,
          mensagem: naoEncontrado
            ? 'O cliente não está mais disponível. Selecione outro cliente.'
            : error instanceof Error
              ? error.message
              : 'Não foi possível carregar o cliente',
          recuperavel: !naoEncontrado,
        })
      })

    return () => controller.abort()
  }, [
    clienteIdNecessario,
    clienteIgnorado,
    clienteSelecionadoId,
    tentativaCliente,
  ])

  const carregandoCliente = Boolean(
    clienteIdNecessario &&
    clienteSelecionadoId !== clienteIdNecessario &&
    clienteIgnorado !== clienteIdNecessario &&
    !falhaClienteAtual,
  )

  function selecionarCliente(cliente: Cliente) {
    setClienteSelecionado(cliente)
    setClienteIgnorado(null)
    setFalhaCliente(null)
    const novosParametros = new URLSearchParams(searchParams)
    novosParametros.set('clienteId', String(cliente.id))
    setSearchParams(novosParametros, { replace: true })
  }

  function trocarCliente() {
    setClienteIgnorado(clienteSelecionado?.id ?? null)
    setClienteSelecionado(null)
    setFalhaCliente(null)
    const novosParametros = new URLSearchParams(searchParams)
    novosParametros.delete('clienteId')
    setSearchParams(novosParametros, { replace: true })
  }

  function abrirCadastroCliente() {
    const rascunhoOrcamento = formularioRef.current
      ? capturarRascunho(formularioRef.current, itens)
      : { ...rascunhoInicial, itens }

    navigate('/clientes/novo?retorno=%2Forcamentos%2Fnovo', {
      replace: true,
      state: { rascunhoOrcamento },
    })
  }

  function atualizarItem(
    chave: string,
    campo: keyof Omit<ItemRascunho, 'chave'>,
    valor: string,
  ) {
    setItens(atuais =>
      atuais.map(item =>
        item.chave === chave ? { ...item, [campo]: valor } : item,
      ),
    )
    limparErroCampo('itens')
  }

  function removerItem(chave: string) {
    setItens(atuais =>
      atuais.length === 1 ? atuais : atuais.filter(item => item.chave !== chave),
    )
    limparErroCampo('itens')
  }

  function limparErroCampo(campo: string) {
    setErrosCampos(atuais => {
      if (!atuais[campo]) return atuais
      const proximos = { ...atuais }
      delete proximos[campo]
      return proximos
    })
    setErroApi('')
    setExigeRecarregamento(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (envioEmAndamento.current || carregandoCliente) return

    const formulario = event.currentTarget
    const cliente = clienteSelecionado
    setErroApi('')

    if (!cliente) {
      setFalhaCliente({
        clienteId: clienteIdNecessario,
        mensagem: 'Selecione o cliente antes de salvar o orçamento.',
        recuperavel: false,
      })
      document.getElementById('client-selector-title')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }

    const dados = new FormData(formulario)
    const validacao = orcamentoSchema.safeParse({
      clienteId: cliente.id,
      equipamento: dados.get('equipamento'),
      descricaoProblema: dados.get('descricaoProblema'),
      desconto: dados.get('desconto'),
      validade: dados.get('validade'),
      observacoes: dados.get('observacoes'),
      itens: itens.map(item => ({
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnitario: item.valorUnitario,
        tipo: item.tipo,
      })),
    })

    if (!validacao.success) {
      setErrosCampos(validacao.error.flatten().fieldErrors)
      requestAnimationFrame(() => {
        const primeiroInvalido =
          formulario.querySelector<HTMLElement>('[aria-invalid="true"]')
        primeiroInvalido?.focus()
        primeiroInvalido?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }

    const dadosParaApi: CriarOrcamentoInput = {
      ...validacao.data,
      validade: validacao.data.validade
        ? new Date(`${validacao.data.validade}T23:59:59.999`).toISOString()
        : null,
    }

    envioEmAndamento.current = true
    setSalvando(true)

    try {
      const salvo = editando && orcamento
        ? await atualizarOrcamento(orcamento.id, {
            ...dadosParaApi,
            statusEsperado: 'RASCUNHO',
            versaoEsperada: orcamento.versao,
          })
        : await criarOrcamento(dadosParaApi)

      navigate(`/orcamentos/${salvo.id}`, {
        replace: true,
        state: {
          mensagem: editando
            ? 'Orçamento atualizado com sucesso.'
            : 'Orçamento criado como rascunho.',
          orientarEnvio: !editando,
        },
      })
    } catch (error) {
      if (error instanceof OrcamentoApiError && error.status === 409) {
        setExigeRecarregamento(editando)
        setErroApi(
          'Este orçamento foi alterado em outra tela. Recarregue os dados antes de continuar.',
        )
      } else if (error instanceof OrcamentoApiError && error.status === 404) {
        setErroApi(error.message)
      } else {
        setErroApi(
          error instanceof Error
            ? error.message
            : 'Ocorreu um erro inesperado ao salvar o orçamento.',
        )
      }
    } finally {
      envioEmAndamento.current = false
      setSalvando(false)
    }
  }

  if (editando && !idValido) {
    return <BudgetFormFeedback title="Orçamento inválido" message="O endereço não possui um identificador válido." />
  }

  if (carregandoOrcamento) return <BudgetFormSkeleton />

  if (editando && erroOrcamento) {
    return (
      <BudgetFormFeedback
        title="Não foi possível carregar o orçamento"
        message={erroOrcamento}
        onRetry={() => {
          setErroOrcamento('')
          setCarregandoOrcamento(true)
          setTentativaOrcamento(valor => valor + 1)
        }}
      />
    )
  }

  if (editando && orcamento?.status !== 'RASCUNHO') {
    return (
      <BudgetFormFeedback
        title="Orçamento não editável"
        message="Somente orçamentos em rascunho podem ter seus dados e itens alterados."
        budgetId={orcamento?.id}
      />
    )
  }

  const valoresIniciais = obterValoresIniciais(orcamento, rascunhoInicial)
  const subtotal = calcularSubtotal(itens)
  const descontoAtual = lerNumeroMonetario(desconto)
  const total = Math.max(0, subtotal - descontoAtual)

  return (
    <div className="budget-form-page">
      <header className="budget-form-page__header">
        <Link to={editando && orcamento ? `/orcamentos/${orcamento.id}` : '/orcamentos'} aria-label="Voltar">
          <ArrowLeftIcon />
        </Link>
        <div>
          <span>Orçamentos</span>
          <h1>{editando ? 'Editar orçamento' : 'Novo orçamento'}</h1>
          <p>Defina o serviço e os valores antes de abrir uma ordem.</p>
        </div>
      </header>

      {carregandoCliente ? (
        <div className="budget-form-client-loading" aria-busy="true">
          <span className="sr-only">Carregando cliente</span><div /><div />
        </div>
      ) : (
        <ClientSelector
          clienteSelecionado={clienteSelecionado}
          onSelecionar={selecionarCliente}
          onTrocar={trocarCliente}
          onCadastrarCliente={editando ? undefined : abrirCadastroCliente}
          stepLabel="Etapa 1 de 3"
        />
      )}

      {falhaClienteAtual && (
        <div className="budget-form-alert" role="alert">
          <WarningIcon />
          <span>{falhaClienteAtual.mensagem}</span>
          {falhaClienteAtual.recuperavel && (
            <button
              type="button"
              onClick={() => {
                setFalhaCliente(null)
                setTentativaCliente(valor => valor + 1)
              }}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      <form
        key={orcamento?.atualizadoEm ?? 'novo'}
        ref={formularioRef}
        className="budget-form"
        onSubmit={handleSubmit}
        onChange={event => {
          const nome = event.target.getAttribute('name')
          if (nome) limparErroCampo(nome)
        }}
        noValidate
      >
        <section className="budget-form__section">
          <SectionHeader icon={<DeviceIcon />} step="Etapa 2 de 3" title="Dados do atendimento" description="Identifique o equipamento e registre o relato do cliente." />
          <div className="budget-form__grid budget-form__grid--single">
            <FormField id="equipamento" label="Equipamento" required error={errosCampos.equipamento?.[0]} hint="Inclua marca, modelo e acessórios quando souber.">
              <input id="equipamento" name="equipamento" type="text" defaultValue={valoresIniciais.equipamento} maxLength={500} placeholder="Ex.: Notebook Dell Inspiron com carregador" aria-invalid={Boolean(errosCampos.equipamento?.[0])} aria-describedby={campoDescribedBy('equipamento', errosCampos.equipamento?.[0], true)} />
            </FormField>
            <FormField id="descricaoProblema" label="Problema relatado" required error={errosCampos.descricaoProblema?.[0]} hint="Use as palavras do cliente; o diagnóstico virá na ordem.">
              <textarea id="descricaoProblema" name="descricaoProblema" defaultValue={valoresIniciais.descricaoProblema} maxLength={2000} rows={5} placeholder="Descreva o problema informado..." aria-invalid={Boolean(errosCampos.descricaoProblema?.[0])} aria-describedby={campoDescribedBy('descricaoProblema', errosCampos.descricaoProblema?.[0], true)} />
            </FormField>
          </div>
        </section>

        <section className="budget-form__section">
          <SectionHeader icon={<ItemsIcon />} step="Etapa 3 de 3" title="Itens do orçamento" description="O total é calculado pelo backend a partir destes itens." variant="violet" />
          <div className="budget-items">
            {itens.map((item, index) => (
              <article className="budget-item" key={item.chave}>
                <header>
                  <strong>Item {index + 1}</strong>
                  <button type="button" disabled={itens.length === 1} onClick={() => removerItem(item.chave)} aria-label={`Remover item ${index + 1}`}>
                    <TrashIcon /> Remover
                  </button>
                </header>
                <div className="budget-item__grid">
                  <label className="budget-item__description">
                    <span>Descrição *</span>
                    <input type="text" value={item.descricao} maxLength={500} placeholder="Ex.: Troca do conector de carga" onChange={event => atualizarItem(item.chave, 'descricao', event.target.value)} aria-invalid={Boolean(errosCampos.itens?.[0]) && !item.descricao.trim()} />
                  </label>
                  <label>
                    <span>Tipo *</span>
                    <select value={item.tipo} onChange={event => atualizarItem(item.chave, 'tipo', event.target.value)}>
                      {TIPOS_ITEM_ORCAMENTO.map(tipo => <option key={tipo} value={tipo}>{TIPO_ITEM_ORCAMENTO_LABELS[tipo]}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Quantidade *</span>
                    <input type="number" min="1" max="1000000" step="1" inputMode="numeric" value={item.quantidade} onChange={event => atualizarItem(item.chave, 'quantidade', event.target.value)} aria-invalid={Boolean(errosCampos.itens?.[0]) && Number(item.quantidade) < 1} />
                  </label>
                  <label>
                    <span>Valor unitário *</span>
                    <div className="budget-money-input"><span>R$</span><input type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" value={item.valorUnitario} placeholder="0,00" onChange={event => atualizarItem(item.chave, 'valorUnitario', event.target.value)} /></div>
                  </label>
                  <div className="budget-item__total"><span>Total do item</span><strong>{formatarMoeda(calcularTotalItem(item))}</strong></div>
                </div>
              </article>
            ))}
            {errosCampos.itens?.[0] && <p className="budget-items__error" role="alert">{errosCampos.itens[0]}</p>}
            <button className="budget-items__add" type="button" onClick={() => setItens(atuais => [...atuais, novoItem()])}>
              <PlusIcon /> Adicionar item
            </button>
          </div>
        </section>

        <section className="budget-form__section">
          <SectionHeader icon={<CalendarIcon />} title="Condições da proposta" description="Defina validade, desconto e observações para o cliente." variant="green" />
          <div className="budget-form__grid">
            <FormField id="validade" label="Validade" error={errosCampos.validade?.[0]} hint="Opcional.">
              <input id="validade" name="validade" type="date" defaultValue={valoresIniciais.validade} aria-invalid={Boolean(errosCampos.validade?.[0])} aria-describedby={campoDescribedBy('validade', errosCampos.validade?.[0], true)} />
            </FormField>
            <FormField id="desconto" label="Desconto" error={errosCampos.desconto?.[0]} hint="Não pode superar o subtotal.">
              <div className="budget-money-input"><span>R$</span><input id="desconto" name="desconto" type="number" value={desconto} min="0" max="9999999999.99" step="0.01" inputMode="decimal" onChange={event => setDesconto(event.target.value)} aria-invalid={Boolean(errosCampos.desconto?.[0])} aria-describedby={campoDescribedBy('desconto', errosCampos.desconto?.[0], true)} /></div>
            </FormField>
            <FormField id="observacoes" label="Observações" error={errosCampos.observacoes?.[0]} wide>
              <textarea id="observacoes" name="observacoes" defaultValue={valoresIniciais.observacoes} maxLength={4000} rows={4} placeholder="Condições, garantias ou informações importantes..." aria-invalid={Boolean(errosCampos.observacoes?.[0])} aria-describedby={campoDescribedBy('observacoes', errosCampos.observacoes?.[0])} />
            </FormField>
          </div>
          <aside className="budget-totals" aria-live="polite">
            <div><span>Subtotal</span><strong>{formatarMoeda(subtotal)}</strong></div>
            <div><span>Desconto</span><strong>− {formatarMoeda(descontoAtual)}</strong></div>
            <div className="budget-totals__grand"><span>Total previsto</span><strong>{formatarMoeda(total)}</strong></div>
            <p>O backend recalculará e validará estes valores ao salvar.</p>
          </aside>
        </section>

        {erroApi && (
          <div className="budget-form-alert" role="alert">
            <WarningIcon /><span>{erroApi}</span>
            {exigeRecarregamento && <button type="button" onClick={() => window.location.reload()}>Recarregar</button>}
          </div>
        )}

        <div className="budget-form__actions">
          <Link to={editando && orcamento ? `/orcamentos/${orcamento.id}` : '/orcamentos'}>Cancelar</Link>
          <button type="submit" disabled={salvando || carregandoCliente || !clienteSelecionado} aria-busy={salvando}>
            <SaveIcon /> {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Salvar rascunho'}
          </button>
        </div>
      </form>
    </div>
  )
}

function obterValoresIniciais(
  orcamento: Orcamento | null,
  rascunho: RascunhoOrcamento | null,
) {
  return {
    equipamento: orcamento?.equipamento ?? rascunho?.equipamento ?? '',
    descricaoProblema:
      orcamento?.descricaoProblema ?? rascunho?.descricaoProblema ?? '',
    desconto: orcamento?.desconto ?? rascunho?.desconto ?? '0',
    validade: orcamento?.validade
      ? formatarValidadeParaInput(orcamento.validade)
      : rascunho?.validade ?? '',
    observacoes: orcamento?.observacoes ?? rascunho?.observacoes ?? '',
  }
}

function formatarValidadeParaInput(valor: string) {
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''

  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function capturarRascunho(
  formulario: HTMLFormElement,
  itens: ItemRascunho[],
): RascunhoOrcamento {
  const dados = new FormData(formulario)
  return {
    equipamento: String(dados.get('equipamento') ?? '').slice(0, 500),
    descricaoProblema: String(dados.get('descricaoProblema') ?? '').slice(0, 2000),
    desconto: String(dados.get('desconto') ?? '').slice(0, 20),
    validade: String(dados.get('validade') ?? '').slice(0, 10),
    observacoes: String(dados.get('observacoes') ?? '').slice(0, 4000),
    itens,
  }
}

function lerRascunhoDaNavegacao(state: unknown): RascunhoOrcamento | null {
  if (
    typeof state !== 'object' ||
    state === null ||
    !('rascunhoOrcamento' in state) ||
    typeof state.rascunhoOrcamento !== 'object' ||
    state.rascunhoOrcamento === null
  ) return null

  const recebido = state.rascunhoOrcamento
  const itensRecebidos = 'itens' in recebido && Array.isArray(recebido.itens)
    ? recebido.itens.slice(0, 100)
    : []

  const itens = itensRecebidos.flatMap(item => {
    if (typeof item !== 'object' || item === null) return []
    const tipo = 'tipo' in item && TIPOS_ITEM_ORCAMENTO.includes(item.tipo as TipoItemOrcamento)
      ? item.tipo as TipoItemOrcamento
      : 'SERVICO'
    return [novoItem({
      descricao: 'descricao' in item ? String(item.descricao).slice(0, 500) : '',
      quantidade: 'quantidade' in item ? String(item.quantidade).slice(0, 10) : '1',
      valorUnitario: 'valorUnitario' in item ? String(item.valorUnitario).slice(0, 20) : '',
      tipo,
    })]
  })

  const lerTexto = (campo: string, limite: number) =>
    campo in recebido ? String(recebido[campo as keyof typeof recebido]).slice(0, limite) : ''

  return {
    equipamento: lerTexto('equipamento', 500),
    descricaoProblema: lerTexto('descricaoProblema', 2000),
    desconto: lerTexto('desconto', 20),
    validade: lerTexto('validade', 10),
    observacoes: lerTexto('observacoes', 4000),
    itens: itens.length ? itens : [novoItem()],
  }
}

function calcularSubtotal(itens: ItemRascunho[]) {
  return itens.reduce((soma, item) => soma + calcularTotalItem(item), 0)
}

function calcularTotalItem(item: ItemRascunho) {
  const quantidade = Number(item.quantidade)
  const valor = lerNumeroMonetario(item.valorUnitario)
  return Number.isFinite(quantidade) && quantidade > 0 ? quantidade * valor : 0
}

function lerNumeroMonetario(valor: string) {
  const numero = Number(valor.replace(',', '.'))
  return Number.isFinite(numero) && numero > 0 ? numero : 0
}

function lerIdPositivo(valor: string | null) {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero > 0 ? numero : null
}

function SectionHeader({ icon, step, title, description, variant }: { icon: ReactNode; step?: string; title: string; description: string; variant?: 'violet' | 'green' }) {
  return <header className="budget-form__section-header"><div className={`budget-form__section-icon${variant ? ` budget-form__section-icon--${variant}` : ''}`}>{icon}</div><div>{step && <span>{step}</span>}<h2>{title}</h2><p>{description}</p></div></header>
}

function FormField({ id, label, children, required, hint, error, wide }: { id: string; label: string; children: ReactNode; required?: boolean; hint?: string; error?: string; wide?: boolean }) {
  return <div className={`budget-form__field${wide ? ' budget-form__field--wide' : ''}`}><label htmlFor={id}>{label}{required && <span aria-hidden="true"> *</span>}</label>{children}{error ? <small id={`${id}-error`} className="budget-form__field-error">{error}</small> : hint && <small id={`${id}-hint`}>{hint}</small>}</div>
}

function campoDescribedBy(id: string, error?: string, hint = false) { return error ? `${id}-error` : hint ? `${id}-hint` : undefined }

function BudgetFormFeedback({ title, message, onRetry, budgetId }: { title: string; message: string; onRetry?: () => void; budgetId?: number }) {
  return <section className="budget-form-feedback" role="alert"><div><WarningIcon /></div><h1>{title}</h1><p>{message}</p><nav><Link to={budgetId ? `/orcamentos/${budgetId}` : '/orcamentos'}>Voltar</Link>{onRetry && <button type="button" onClick={onRetry}>Tentar novamente</button>}</nav></section>
}

function BudgetFormSkeleton() {
  return <div className="budget-form-skeleton" aria-busy="true"><span className="sr-only">Carregando orçamento</span><div /><div /><div /></div>
}

function Icon({ children }: { children: ReactNode }) { return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg> }
function ArrowLeftIcon() { return <Icon><path d="m15 18-6-6 6-6" /></Icon> }
function DeviceIcon() { return <Icon><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></Icon> }
function ItemsIcon() { return <Icon><path d="M9 5h10M9 12h10M9 19h10" /><circle cx="5" cy="5" r="1.5" /><circle cx="5" cy="12" r="1.5" /><circle cx="5" cy="19" r="1.5" /></Icon> }
function CalendarIcon() { return <Icon><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Icon> }
function TrashIcon() { return <Icon><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></Icon> }
function PlusIcon() { return <Icon><path d="M12 5v14M5 12h14" /></Icon> }
function SaveIcon() { return <Icon><path d="M5 3h12l2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></Icon> }
function WarningIcon() { return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon> }
