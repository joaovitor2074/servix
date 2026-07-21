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
  useSearchParams,
} from 'react-router'
import {
  FORMAS_PAGAMENTO,
  FORMA_PAGAMENTO_LABELS,
  type CriarOrdemInput,
  type FormaPagamento,
} from '../../../shared/types/ordem.types'
import {
  buscarCliente,
  ClienteApiError,
} from '../../clients/services/clients.service'
import type { Cliente } from '../../clients/types/client.types'
import ClientSelector from '../components/ClientSelector'
import { novaOrdemSchema } from '../schemas/new-order.schema'
import { criarOrdem, OrdemApiError } from '../services/orders.service'
import './NewOrderPage.css'

interface RascunhoOrdem {
  equipamento: string
  problemaRelatado: string
  tecnicoResponsavel: string
  previsaoDeEntrega: string
  valor: string
  formaDePagamento: FormaPagamento
}

interface FalhaCliente {
  clienteId: number | null
  mensagem: string
  recuperavel: boolean
}

export default function NewOrderPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const clienteIdDaUrl = lerClienteId(searchParams.get('clienteId'))
  const parametroClienteInvalido = Boolean(
    searchParams.has('clienteId') && !clienteIdDaUrl,
  )
  const [rascunhoInicial] = useState(() =>
    lerRascunhoDaNavegacao(location.state),
  )

  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(
    null,
  )
  const [falhaCliente, setFalhaCliente] = useState<FalhaCliente | null>(null)
  const [tentativaCliente, setTentativaCliente] = useState(0)
  const [iniciouAtendimento, setIniciouAtendimento] = useState(
    Boolean(clienteIdDaUrl || rascunhoInicial),
  )
  const [salvando, setSalvando] = useState(false)
  const [erroApi, setErroApi] = useState('')
  const [errosCampos, setErrosCampos] = useState<
    Record<string, string[] | undefined>
  >({})
  const [mensagemSucesso, setMensagemSucesso] = useState(() =>
    lerMensagemDaNavegacao(location.state),
  )
  const [clienteIgnoradoDuranteTroca, setClienteIgnoradoDuranteTroca] =
    useState<number | null>(null)
  const formularioRef = useRef<HTMLFormElement | null>(null)
  const envioEmAndamento = useRef(false)

  const clienteSelecionadoId = clienteSelecionado?.id ?? null
  const falhaClienteAtual =
    falhaCliente && falhaCliente.clienteId === clienteIdDaUrl
      ? falhaCliente
      : null
  const carregandoCliente = Boolean(
    clienteIdDaUrl &&
      clienteSelecionadoId !== clienteIdDaUrl &&
      clienteIgnoradoDuranteTroca !== clienteIdDaUrl &&
      !falhaClienteAtual,
  )
  const clienteAtual =
    clienteIdDaUrl && clienteSelecionadoId !== clienteIdDaUrl
      ? null
      : clienteSelecionado

  useEffect(() => {
    if (!clienteIdDaUrl) {
      return
    }

    // Ao clicar em "Trocar", o React pode renderizar uma vez antes de a query
    // antiga sair da URL. A marca temporária impede restaurar o cliente velho.
    if (
      clienteSelecionadoId === clienteIdDaUrl ||
      clienteIgnoradoDuranteTroca === clienteIdDaUrl
    ) {
      return
    }

    const controller = new AbortController()

    // O ID na URL restaura a escolha ao voltar do cadastro de cliente e também
    // permite recarregar ou compartilhar a tela sem perder essa primeira etapa.
    void buscarCliente(clienteIdDaUrl, { signal: controller.signal })
      .then(cliente => {
        setClienteSelecionado(cliente)
        setIniciouAtendimento(true)
        setFalhaCliente(null)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return

        const clienteNaoEncontrado =
          error instanceof ClienteApiError && error.status === 404

        setFalhaCliente({
          clienteId: clienteIdDaUrl,
          mensagem: clienteNaoEncontrado
            ? 'O cliente informado não está disponível. Selecione outro cliente.'
            : error instanceof Error
              ? error.message
              : 'Não foi possível carregar o cliente selecionado',
          recuperavel: !clienteNaoEncontrado,
        })
      })

    return () => controller.abort()
  }, [
    clienteIdDaUrl,
    clienteIgnoradoDuranteTroca,
    clienteSelecionadoId,
    tentativaCliente,
  ])

  function selecionarCliente(cliente: Cliente) {
    setClienteIgnoradoDuranteTroca(null)
    setClienteSelecionado(cliente)
    setIniciouAtendimento(true)
    setFalhaCliente(null)

    // Manter o cliente na query torna o fluxo resistente a recarregamentos.
    const novosParametros = new URLSearchParams(searchParams)
    novosParametros.set('clienteId', String(cliente.id))
    setSearchParams(novosParametros, { replace: true })
  }

  function trocarCliente() {
    setClienteIgnoradoDuranteTroca(clienteSelecionado?.id ?? null)
    setClienteSelecionado(null)
    setFalhaCliente(null)

    // O formulário continua montado para preservar equipamento e problema caso
    // o funcionário apenas tenha escolhido o cliente errado.
    const novosParametros = new URLSearchParams(searchParams)
    novosParametros.delete('clienteId')
    setSearchParams(novosParametros, { replace: true })
  }

  function tentarCarregarClienteNovamente() {
    setClienteIgnoradoDuranteTroca(null)
    setFalhaCliente(null)
    setTentativaCliente(valor => valor + 1)
  }

  function abrirCadastroCliente() {
    // O rascunho via state existe somente durante esta navegação. Assim o
    // funcionário cadastra o cliente sem reescrever a ficha e sem persistir os
    // dados do atendimento no navegador.
    const rascunhoOrdem = formularioRef.current
      ? capturarRascunho(formularioRef.current)
      : undefined

    navigate('/clientes/novo?retorno=%2Fordens%2Fnova', {
      replace: true,
      state: { rascunhoOrdem },
    })
  }

  function limparErroCampo(campo: string) {
    // Assim que o funcionário corrige uma entrada, o aviso antigo deixa de
    // competir visualmente com o novo valor. Os demais erros permanecem.
    setErrosCampos(errosAtuais => {
      if (!errosAtuais[campo]) return errosAtuais

      const proximosErros = { ...errosAtuais }
      delete proximosErros[campo]
      return proximosErros
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    // O ref muda imediatamente e bloqueia um segundo POST mesmo antes de o
    // React redesenhar o botão desabilitado após um clique duplo muito rápido.
    if (envioEmAndamento.current) return

    setErroApi('')
    const formulario = event.currentTarget

    if (carregandoCliente) return

    if (!clienteAtual) {
      // Uma falha ligada ao ID da URL já explica por que não há cliente.
      // Preservá-la mantém a opção de tentar o carregamento novamente.
      if (!falhaClienteAtual) {
        setFalhaCliente({
          clienteId: clienteIdDaUrl,
          mensagem: 'Selecione o cliente antes de criar a ordem.',
          recuperavel: false,
        })
      }
      document.getElementById('client-selector-title')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }

    const formData = new FormData(formulario)
    const dadosRecebidos = {
      clienteId: clienteAtual.id,
      equipamento: formData.get('equipamento'),
      problemaRelatado: formData.get('problemaRelatado'),
      tecnicoResponsavel: formData.get('tecnicoResponsavel'),
      previsaoDeEntrega: formData.get('previsaoDeEntrega'),
      valor: formData.get('valor'),
      formaDePagamento: formData.get('formaDePagamento'),
    }

    // O safeParse valida e normaliza os dados sem apagar o que foi digitado.
    // Os erros retornam por campo para ficarem ao lado da entrada correspondente.
    const validacao = novaOrdemSchema.safeParse(dadosRecebidos)

    if (!validacao.success) {
      setErrosCampos(validacao.error.flatten().fieldErrors)

      // Depois do React apresentar os avisos, levamos o foco ao primeiro campo
      // inválido. Isso evita que o erro fique escondido acima do botão de envio.
      requestAnimationFrame(() => {
        const primeiroCampoInvalido =
          formulario.querySelector<HTMLElement>('[aria-invalid="true"]')
        primeiroCampoInvalido?.focus()
        primeiroCampoInvalido?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      })
      return
    }

    setErrosCampos({})
    envioEmAndamento.current = true
    setSalvando(true)

    // datetime-local não inclui fuso horário. A conversão gera o ISO com Z
    // exigido pela API, representando corretamente o horário local informado.
    const dadosParaApi: CriarOrdemInput = {
      ...validacao.data,
      previsaoDeEntrega: validacao.data.previsaoDeEntrega
        ? new Date(validacao.data.previsaoDeEntrega).toISOString()
        : null,
    }

    try {
      const ordemCriada = await criarOrdem(dadosParaApi)

      navigate('/ordens', {
        replace: true,
        state: {
          mensagem: `Ordem #${ordemCriada.id} criada com sucesso.`,
        },
      })
    } catch (error) {
      // Um 404 normalmente significa que o cliente foi removido entre a escolha
      // e o envio. Nesse caso pedimos uma nova seleção e mantemos o restante.
      if (error instanceof OrdemApiError && error.status === 404) {
        trocarCliente()
        setFalhaCliente({
          clienteId: null,
          mensagem:
            'O cliente selecionado não está mais disponível. Escolha outro cliente.',
          recuperavel: false,
        })
        return
      }

      setErroApi(
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro inesperado',
      )
    } finally {
      envioEmAndamento.current = false
      setSalvando(false)
    }
  }

  return (
    <div className="new-order-page">
      <header className="new-order-page__header">
        <Link to="/ordens" aria-label="Voltar para ordens de serviço">
          <ArrowLeftIcon />
        </Link>
        <div>
          <span className="new-order-page__eyebrow">Atendimentos</span>
          <h1>Nova ordem de serviço</h1>
          <p>Registre a entrada do equipamento com as informações iniciais.</p>
        </div>
      </header>

      {mensagemSucesso && (
        <div className="new-order-success" role="status">
          <CheckIcon />
          <span>{mensagemSucesso}</span>
          <button
            type="button"
            aria-label="Fechar mensagem"
            onClick={() => setMensagemSucesso('')}
          >
            ×
          </button>
        </div>
      )}

      {carregandoCliente ? (
        <div className="new-order-client-loading" aria-busy="true">
          <span className="sr-only">Carregando cliente selecionado</span>
          <div />
          <div />
        </div>
      ) : (
        <ClientSelector
          clienteSelecionado={clienteAtual}
          onSelecionar={selecionarCliente}
          onTrocar={trocarCliente}
          onCadastrarCliente={abrirCadastroCliente}
        />
      )}

      {(falhaClienteAtual || parametroClienteInvalido) && (
        <div className="new-order-client-error" role="alert">
          <WarningIcon />
          <span>
            {falhaClienteAtual?.mensagem ||
              'O identificador do cliente na URL não é válido. Selecione um cliente.'}
          </span>
          {falhaClienteAtual?.recuperavel &&
            clienteIdDaUrl &&
            !clienteAtual && (
              <button type="button" onClick={tentarCarregarClienteNovamente}>
                Tentar novamente
              </button>
            )}
        </div>
      )}

      {iniciouAtendimento ? (
        <form
          ref={formularioRef}
          className="new-order-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <section className="new-order-form__section">
            <div className="new-order-form__section-header">
              <div className="new-order-form__section-icon">
                <ToolIcon />
              </div>
              <div>
                <span>Etapa 2 de 2</span>
                <h2>Entrada do equipamento</h2>
                <p>Registre o que foi recebido e o relato do cliente.</p>
              </div>
            </div>

            <div className="new-order-form__grid new-order-form__grid--single">
              <FormField
                id="equipamento"
                label="Equipamento"
                required
                hint="Inclua marca, modelo ou acessórios entregues quando souber."
                error={errosCampos.equipamento?.[0]}
              >
                <input
                  id="equipamento"
                  name="equipamento"
                  type="text"
                  defaultValue={rascunhoInicial?.equipamento ?? ''}
                  placeholder="Ex.: Notebook Dell Inspiron com carregador"
                  maxLength={500}
                  required
                  onChange={() => limparErroCampo('equipamento')}
                  aria-invalid={Boolean(errosCampos.equipamento?.[0])}
                  aria-describedby={campoDescribedBy(
                    'equipamento',
                    errosCampos.equipamento?.[0],
                    true,
                  )}
                />
              </FormField>

              <FormField
                id="problemaRelatado"
                label="Problema relatado"
                required
                hint="Use as palavras do cliente; o diagnóstico será preenchido depois."
                error={errosCampos.problemaRelatado?.[0]}
              >
                <textarea
                  id="problemaRelatado"
                  name="problemaRelatado"
                  defaultValue={rascunhoInicial?.problemaRelatado ?? ''}
                  placeholder="Ex.: Não liga desde ontem e faz um ruído ao conectar o carregador."
                  maxLength={2000}
                  rows={5}
                  required
                  onChange={() => limparErroCampo('problemaRelatado')}
                  aria-invalid={Boolean(errosCampos.problemaRelatado?.[0])}
                  aria-describedby={campoDescribedBy(
                    'problemaRelatado',
                    errosCampos.problemaRelatado?.[0],
                    true,
                  )}
                />
              </FormField>
            </div>
          </section>

          <section className="new-order-form__section">
            <div className="new-order-form__section-header">
              <div className="new-order-form__section-icon new-order-form__section-icon--secondary">
                <CalendarIcon />
              </div>
              <div>
                <h2>Planejamento inicial</h2>
                <p>Opcional: preencha apenas o que já estiver combinado.</p>
              </div>
            </div>

            <div className="new-order-form__grid">
              <FormField
                id="tecnicoResponsavel"
                label="Técnico responsável"
                error={errosCampos.tecnicoResponsavel?.[0]}
              >
                <input
                  id="tecnicoResponsavel"
                  name="tecnicoResponsavel"
                  type="text"
                  defaultValue={rascunhoInicial?.tecnicoResponsavel ?? ''}
                  placeholder="Nome do técnico"
                  maxLength={120}
                  autoComplete="off"
                  onChange={() => limparErroCampo('tecnicoResponsavel')}
                  aria-invalid={Boolean(errosCampos.tecnicoResponsavel?.[0])}
                  aria-describedby={campoDescribedBy(
                    'tecnicoResponsavel',
                    errosCampos.tecnicoResponsavel?.[0],
                  )}
                />
              </FormField>

              <FormField
                id="previsaoDeEntrega"
                label="Previsão de entrega"
                hint="Pode ser definida ou alterada depois."
                error={errosCampos.previsaoDeEntrega?.[0]}
              >
                <input
                  id="previsaoDeEntrega"
                  name="previsaoDeEntrega"
                  type="datetime-local"
                  defaultValue={rascunhoInicial?.previsaoDeEntrega ?? ''}
                  onChange={() => limparErroCampo('previsaoDeEntrega')}
                  aria-invalid={Boolean(errosCampos.previsaoDeEntrega?.[0])}
                  aria-describedby={campoDescribedBy(
                    'previsaoDeEntrega',
                    errosCampos.previsaoDeEntrega?.[0],
                    true,
                  )}
                />
              </FormField>

              <FormField
                id="valor"
                label="Valor estimado"
                hint="Deixe zerado se ainda depender do diagnóstico."
                error={errosCampos.valor?.[0]}
              >
                <div className="new-order-form__money">
                  <span aria-hidden="true">R$</span>
                  <input
                    id="valor"
                    name="valor"
                    type="number"
                    defaultValue={rascunhoInicial?.valor ?? ''}
                    inputMode="decimal"
                    min="0"
                    max="99999999.99"
                    step="0.01"
                    placeholder="0,00"
                    onChange={() => limparErroCampo('valor')}
                    aria-invalid={Boolean(errosCampos.valor?.[0])}
                    aria-describedby={campoDescribedBy(
                      'valor',
                      errosCampos.valor?.[0],
                      true,
                    )}
                  />
                </div>
              </FormField>

              <FormField
                id="formaDePagamento"
                label="Forma de pagamento"
                error={errosCampos.formaDePagamento?.[0]}
              >
                <select
                  id="formaDePagamento"
                  name="formaDePagamento"
                  defaultValue={
                    rascunhoInicial?.formaDePagamento ?? 'NAO_INFORMADA'
                  }
                  onChange={() => limparErroCampo('formaDePagamento')}
                  aria-invalid={Boolean(errosCampos.formaDePagamento?.[0])}
                  aria-describedby={campoDescribedBy(
                    'formaDePagamento',
                    errosCampos.formaDePagamento?.[0],
                  )}
                >
                  {FORMAS_PAGAMENTO.map(forma => (
                    <option key={forma} value={forma}>
                      {FORMA_PAGAMENTO_LABELS[forma]}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </section>

          <aside className="new-order-form__status-note">
            <InfoIcon />
            <div>
              <strong>A ordem será aberta para análise</strong>
              <p>
                Diagnóstico, serviços e peças serão registrados durante o
                andamento do atendimento.
              </p>
            </div>
          </aside>

          {erroApi && (
            <div className="new-order-form__api-error" role="alert">
              <WarningIcon />
              <span>{erroApi}</span>
            </div>
          )}

          <div className="new-order-form__actions">
            <Link to="/ordens">Cancelar</Link>
            <button
              type="submit"
              disabled={salvando || carregandoCliente || !clienteAtual}
              aria-busy={salvando}
            >
              {salvando ? 'Criando ordem...' : 'Criar ordem de serviço'}
            </button>
          </div>
        </form>
      ) : (
        <div className="new-order-page__next-step">
          <ArrowUpIcon />
          <p>
            Selecione um cliente acima para liberar os dados do equipamento.
          </p>
        </div>
      )}
    </div>
  )
}

interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}

function FormField({
  id,
  label,
  required = false,
  hint,
  error,
  children,
}: FormFieldProps) {
  return (
    <div className="new-order-form__field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small
          className="new-order-form__field-error"
          id={`${id}-error`}
          role="alert"
        >
          {error}
        </small>
      )}
    </div>
  )
}

function campoDescribedBy(
  id: string,
  error?: string,
  hasHint = false,
) {
  if (error) return `${id}-error`
  return hasHint ? `${id}-hint` : undefined
}

function lerClienteId(valor: string | null) {
  const id = Number(valor)
  return Number.isInteger(id) && id > 0 ? id : null
}

function capturarRascunho(formulario: HTMLFormElement): RascunhoOrdem {
  const dados = new FormData(formulario)
  const formaRecebida = String(
    dados.get('formaDePagamento') ?? 'NAO_INFORMADA',
  )

  return {
    equipamento: String(dados.get('equipamento') ?? ''),
    problemaRelatado: String(dados.get('problemaRelatado') ?? ''),
    tecnicoResponsavel: String(dados.get('tecnicoResponsavel') ?? ''),
    previsaoDeEntrega: String(dados.get('previsaoDeEntrega') ?? ''),
    valor: String(dados.get('valor') ?? ''),
    formaDePagamento: formaPagamentoEhValida(formaRecebida)
      ? formaRecebida
      : 'NAO_INFORMADA',
  }
}

function lerRascunhoDaNavegacao(state: unknown): RascunhoOrdem | null {
  if (
    typeof state !== 'object' ||
    state === null ||
    !('rascunhoOrdem' in state) ||
    typeof state.rascunhoOrdem !== 'object' ||
    state.rascunhoOrdem === null
  ) {
    return null
  }

  const rascunho = state.rascunhoOrdem
  const formaRecebida =
    'formaDePagamento' in rascunho
      ? String(rascunho.formaDePagamento)
      : 'NAO_INFORMADA'

  // O history.state pode ser manipulado. Limitamos e validamos cada valor antes
  // de usá-lo como defaultValue para manter a restauração previsível.
  return {
    equipamento: lerTextoDoRascunho(rascunho, 'equipamento', 500),
    problemaRelatado: lerTextoDoRascunho(
      rascunho,
      'problemaRelatado',
      2000,
    ),
    tecnicoResponsavel: lerTextoDoRascunho(
      rascunho,
      'tecnicoResponsavel',
      120,
    ),
    previsaoDeEntrega: lerTextoDoRascunho(
      rascunho,
      'previsaoDeEntrega',
      30,
    ),
    valor: lerTextoDoRascunho(rascunho, 'valor', 30),
    formaDePagamento: formaPagamentoEhValida(formaRecebida)
      ? formaRecebida
      : 'NAO_INFORMADA',
  }
}

function lerTextoDoRascunho(
  rascunho: object,
  campo: string,
  limite: number,
) {
  if (!(campo in rascunho)) return ''
  const valor = (rascunho as Record<string, unknown>)[campo]
  return typeof valor === 'string' ? valor.slice(0, limite) : ''
}

function formaPagamentoEhValida(valor: string): valor is FormaPagamento {
  return FORMAS_PAGAMENTO.includes(valor as FormaPagamento)
}

function lerMensagemDaNavegacao(state: unknown) {
  if (
    typeof state === 'object' &&
    state !== null &&
    'mensagem' in state &&
    typeof state.mensagem === 'string'
  ) {
    return state.mensagem
  }

  return ''
}

interface IconProps {
  children: ReactNode
}

function Icon({ children }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function ArrowLeftIcon() {
  return <Icon><path d="m15 18-6-6 6-6" /></Icon>
}

function ArrowUpIcon() {
  return <Icon><path d="m6 10 6-6 6 6M12 4v16" /></Icon>
}

function ToolIcon() {
  return <Icon><path d="M14.5 6.5a4 4 0 0 0-5-5l2.1 2.1-3 3L6.5 4.5a4 4 0 0 0 5 5L19 17l2-2-6.5-8.5Z" /><path d="m5 14-3 3 3 3 3-3" /></Icon>
}

function CalendarIcon() {
  return <Icon><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Icon>
}

function InfoIcon() {
  return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></Icon>
}

function CheckIcon() {
  return <Icon><path d="m5 12 4 4L19 6" /></Icon>
}

function WarningIcon() {
  return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon>
}
