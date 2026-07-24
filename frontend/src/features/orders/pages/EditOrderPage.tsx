import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useBeforeUnload, useNavigate, useParams } from 'react-router'
import {
  STATUS_ORDEM_LABELS,
  TRANSICOES_STATUS_ORDEM,
  type AtualizarOrdemInput,
  type OrdemServico,
  type StatusOrdem,
} from '../../../shared/types/ordem.types'
import {
  editarOrdemSchema,
  type EditarOrdemFormData,
} from '../schemas/edit-order.schema'
import {
  atualizarOrdem,
  buscarOrdem,
  OrdemApiError,
} from '../services/orders.service'
import './EditOrderPage.css'

interface OrdemCarregada {
  ordemId: number
  ordem: OrdemServico
}

interface FalhaCarregamento {
  ordemId: number
  mensagem: string
  naoEncontrado: boolean
}

export default function EditOrderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ordemId = Number(id)
  const idValido = Number.isInteger(ordemId) && ordemId > 0

  const [ordemCarregada, setOrdemCarregada] =
    useState<OrdemCarregada | null>(null)
  const [falha, setFalha] = useState<FalhaCarregamento | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [formularioAlterado, setFormularioAlterado] = useState(false)
  const [erroApi, setErroApi] = useState('')
  const [exigeRecarregamento, setExigeRecarregamento] = useState(false)
  const [statusSelecionado, setStatusSelecionado] =
    useState<StatusOrdem | null>(null)
  const [errosCampos, setErrosCampos] = useState<
    Record<string, string[] | undefined>
  >({})
  const envioEmAndamento = useRef(false)
  const camposAlterados = useRef(new Set<string>())
  const requisicaoDeAtualizacao = useRef<AbortController | null>(null)
  const componenteMontado = useRef(false)

  useEffect(() => {
    componenteMontado.current = true

    return () => {
      // Se o funcionário sair durante o PATCH, a resposta não deve atualizar
      // um componente desmontado nem puxá-lo de volta para a ordem anterior.
      componenteMontado.current = false
      requisicaoDeAtualizacao.current?.abort()
    }
  }, [])

  useBeforeUnload(
    useCallback(
      event => {
        if (!formularioAlterado && !salvando) return

        // O navegador exibe sua mensagem padrão ao recarregar ou fechar a aba.
        // Definir returnValue mantém compatibilidade com navegadores mais antigos.
        event.preventDefault()
        event.returnValue = ''
      },
      [formularioAlterado, salvando],
    ),
  )

  useEffect(() => {
    if (!formularioAlterado && !salvando) return

    function confirmarSaidaPorLink(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      ) {
        return
      }

      const link = event.target.closest<HTMLAnchorElement>('a[href]')
      if (!link) return

      const destino = new URL(link.href, window.location.href)
      if (destino.href === window.location.href) return

      const mensagem = salvando
        ? 'A atualização ainda está sendo salva. Deseja sair mesmo assim?'
        : 'Existem alterações que ainda não foram salvas. Deseja sair desta página?'

      if (!window.confirm(mensagem)) {
        // A captura acontece antes dos Links do menu e do cabeçalho, protegendo
        // todo o layout sem acoplar este formulário ao componente da sidebar.
        event.preventDefault()
        event.stopPropagation()
      }
    }

    document.addEventListener('click', confirmarSaidaPorLink, true)
    return () =>
      document.removeEventListener('click', confirmarSaidaPorLink, true)
  }, [formularioAlterado, salvando])

  useEffect(() => {
    // A edição sempre começa pelo status, mesmo quando a navegação veio de uma
    // página de detalhes que estava rolada até o histórico.
    window.scrollTo(0, 0)
  }, [ordemId])

  useEffect(() => {
    if (!idValido) return

    const controller = new AbortController()

    void buscarOrdem(ordemId, { signal: controller.signal })
      .then(ordem => {
        // Uma troca de ID monta uma ficha nova sem reaproveitar campos tocados
        // ou avisos que pertenciam à ordem anterior.
        camposAlterados.current.clear()
        setFormularioAlterado(false)
        setErroApi('')
        setExigeRecarregamento(false)
        setErrosCampos({})
        setStatusSelecionado(ordem.status)
        setOrdemCarregada({ ordemId, ordem })
        setFalha(null)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return

        setFalha({
          ordemId,
          mensagem:
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar a ordem',
          naoEncontrado:
            error instanceof OrdemApiError && error.status === 404,
        })
      })

    return () => controller.abort()
  }, [idValido, ordemId, tentativa])

  const ordemAtual =
    ordemCarregada?.ordemId === ordemId ? ordemCarregada.ordem : null
  const falhaAtual = falha?.ordemId === ordemId ? falha : null

  function recarregarOrdem() {
    // Desmontar o formulário é importante porque seus valores iniciais são
    // preenchidos com defaultValue. A nova resposta monta uma ficha limpa.
    setOrdemCarregada(null)
    setFalha(null)
    setErroApi('')
    setExigeRecarregamento(false)
    setErrosCampos({})
    setStatusSelecionado(null)
    setFormularioAlterado(false)
    camposAlterados.current.clear()
    setTentativa(valor => valor + 1)
  }

  function limparErroCampo(campo: string) {
    setErrosCampos(errosAtuais => {
      if (!errosAtuais[campo]) return errosAtuais

      const proximosErros = { ...errosAtuais }
      delete proximosErros[campo]
      return proximosErros
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!ordemAtual || envioEmAndamento.current) return

    setErroApi('')
    setExigeRecarregamento(false)
    const formulario = event.currentTarget
    const formData = new FormData(formulario)

    const validacao = editarOrdemSchema.safeParse({
      diagnostico: formData.get('diagnostico'),
      servicoRealizado: formData.get('servicoRealizado'),
      pecasUtilizadas: formData.get('pecasUtilizadas'),
      tecnicoResponsavel: formData.get('tecnicoResponsavel'),
      previsaoDeEntrega: formData.get('previsaoDeEntrega'),
      status: formData.get('status'),
      mensagemPublica: formData.get('mensagemPublica'),
    })

    if (!validacao.success) {
      setErrosCampos(validacao.error.flatten().fieldErrors)

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

    // A lista do select já restringe as opções. Esta segunda barreira protege
    // o fluxo caso o HTML seja alterado manualmente no navegador.
    const statusPermitidos = new Set<StatusOrdem>([
      ordemAtual.status,
      ...TRANSICOES_STATUS_ORDEM[ordemAtual.status].filter(
        status =>
          status !== 'ENTREGUE' ||
          ordemAtual.pagamentoResumo?.status === 'PAGO',
      ),
    ])

    if (!statusPermitidos.has(validacao.data.status)) {
      setErrosCampos({
        status: ['Escolha um próximo status permitido para esta ordem'],
      })
      document.getElementById('status')?.focus()
      return
    }

    setErrosCampos({})
    const alteracoes = montarAlteracoes(
      ordemAtual,
      validacao.data,
      camposAlterados.current,
    )

    if (!alteracoes) {
      setFormularioAlterado(false)
      camposAlterados.current.clear()
      setErroApi('Nenhuma alteração foi feita na ordem.')
      return
    }

    envioEmAndamento.current = true
    setSalvando(true)
    const controller = new AbortController()
    requisicaoDeAtualizacao.current = controller

    try {
      const ordemAtualizada = await atualizarOrdem(ordemId, alteracoes, {
        signal: controller.signal,
      })

      if (!componenteMontado.current) return

      camposAlterados.current.clear()
      setFormularioAlterado(false)

      // Ao voltar, a página de detalhes consulta novamente a ordem e o
      // histórico. Uma mudança de status já aparecerá na linha do tempo.
      navigate(`/ordens/${ordemAtualizada.id}`, {
        replace: true,
        state: {
          mensagem: `Ordem #${ordemAtualizada.numero} atualizada com sucesso.`,
        },
      })
    } catch (error) {
      if (
        !componenteMontado.current ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return
      }

      const conflitoOuAusencia =
        error instanceof OrdemApiError &&
        (error.status === 409 || error.status === 404)

      setExigeRecarregamento(conflitoOuAusencia)
      setErroApi(
        error instanceof OrdemApiError && error.status === 409
          ? `${error.message} Recarregue os dados antes de continuar.`
          : error instanceof Error
            ? error.message
            : 'Ocorreu um erro inesperado ao atualizar a ordem.',
      )
    } finally {
      envioEmAndamento.current = false
      if (requisicaoDeAtualizacao.current === controller) {
        requisicaoDeAtualizacao.current = null
      }
      if (componenteMontado.current) setSalvando(false)
    }
  }

  if (!idValido) {
    return (
      <OrderEditFeedback
        title="Ordem inválida"
        message="O endereço informado não possui um identificador de ordem válido."
      />
    )
  }

  if (!ordemAtual && !falhaAtual) {
    return <OrderEditSkeleton />
  }

  if (falhaAtual) {
    return (
      <OrderEditFeedback
        title={
          falhaAtual.naoEncontrado
            ? 'Ordem não encontrada'
            : 'Não foi possível carregar a ordem'
        }
        message={falhaAtual.mensagem}
        onRetry={falhaAtual.naoEncontrado ? undefined : recarregarOrdem}
      />
    )
  }

  if (!ordemAtual) return null

  const entregaBloqueada =
    ordemAtual.status === 'PRONTO' &&
    ordemAtual.pagamentoResumo?.status !== 'PAGO'
  const statusDisponiveis = [
    ordemAtual.status,
    ...TRANSICOES_STATUS_ORDEM[ordemAtual.status].filter(
      status => status !== 'ENTREGUE' || !entregaBloqueada,
    ),
  ]
  const statusFinal = statusDisponiveis.length === 1
  const statusFoiAlterado =
    statusSelecionado !== null && statusSelecionado !== ordemAtual.status

  return (
    <div className="edit-order-page">
      <header className="edit-order-header">
        <Link
          className="edit-order-header__back"
          to={`/ordens/${ordemAtual.id}`}
          aria-label="Voltar para os detalhes da ordem"
        >
          <ArrowLeftIcon />
        </Link>
        <div className="edit-order-header__content">
          <span>Atualização do atendimento</span>
          <h1>Atualizar ordem #{ordemAtual.numero}</h1>
          <p>
            {ordemAtual.cliente.nome} · {ordemAtual.equipamento}
          </p>
        </div>
        <div className="edit-order-header__client" aria-label="Cliente da ordem">
          <span aria-hidden="true">{obterIniciais(ordemAtual.cliente.nome)}</span>
          <div>
            <small>Cliente</small>
            <strong>{ordemAtual.cliente.nome}</strong>
          </div>
        </div>
      </header>

      <form
        key={ordemAtual.atualizadoEm}
        className="edit-order-form"
        onSubmit={handleSubmit}
        onChange={event => {
          // Além de habilitar o botão, guardar o nome impede que campos apenas
          // formatados para exibição (como a data) sejam enviados sem intenção.
          const campo = event.target.getAttribute('name') ?? ''
          if (campo) camposAlterados.current.add(campo)

          setFormularioAlterado(true)
          setErroApi('')
          setExigeRecarregamento(false)
        }}
        noValidate
      >
        <section className="edit-order-section edit-order-section--progress">
          <SectionHeader
            icon={<WorkflowIcon />}
            eyebrow="Prioridade do atendimento"
            title="Andamento da ordem"
            description="Atualize o status e registre o trabalho realizado pela equipe."
          />

          <div className="edit-order-section__body edit-order-grid">
            <FormField
              id="status"
              label="Status"
              required
              hint={
                entregaBloqueada
                  ? 'Quite o saldo nos detalhes da ordem para liberar a entrega.'
                  : statusFinal
                  ? 'Esta ordem está em um status final.'
                  : 'São exibidas somente as próximas etapas permitidas.'
              }
              error={errosCampos.status?.[0]}
            >
              <select
                id="status"
                name="status"
                defaultValue={ordemAtual.status}
                required
                aria-required="true"
                onChange={event => {
                  limparErroCampo('status')
                  setStatusSelecionado(event.target.value as StatusOrdem)
                }}
                aria-invalid={Boolean(errosCampos.status?.[0])}
                aria-describedby={campoDescribedBy(
                  'status',
                  errosCampos.status?.[0],
                  true,
                )}
              >
                {statusDisponiveis.map(status => (
                  <option key={status} value={status}>
                    {status === ordemAtual.status ? 'Atual: ' : ''}
                    {STATUS_ORDEM_LABELS[status]}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="edit-order-status-guide">
              <span>Fluxo disponível</span>
              <strong>{STATUS_ORDEM_LABELS[ordemAtual.status]}</strong>
              <p>
                {entregaBloqueada
                  ? 'A entrega está bloqueada enquanto houver saldo pendente.'
                  : statusFinal
                  ? 'O status não pode mais avançar, mas os demais dados ainda podem ser corrigidos.'
                  : `${statusDisponiveis.length - 1} próximo(s) status disponível(is).`}
              </p>
            </div>

            <FormField
              id="mensagemPublica"
              label="Mensagem para o cliente (opcional)"
              hint={
                statusFoiAlterado
                  ? 'Aparecerá no acompanhamento público. Não inclua diagnóstico interno, custos ou dados sensíveis.'
                  : 'Escolha um novo status para adicionar uma mensagem ao acompanhamento do cliente.'
              }
              error={errosCampos.mensagemPublica?.[0]}
              wide
            >
              <textarea
                id="mensagemPublica"
                name="mensagemPublica"
                placeholder="Ex.: Seu equipamento está em análise pela nossa equipe."
                maxLength={500}
                rows={3}
                disabled={!statusFoiAlterado}
                onChange={() => limparErroCampo('mensagemPublica')}
                aria-invalid={Boolean(errosCampos.mensagemPublica?.[0])}
                aria-describedby={campoDescribedBy(
                  'mensagemPublica',
                  errosCampos.mensagemPublica?.[0],
                  true,
                )}
              />
            </FormField>

            <FormField
              id="diagnostico"
              label="Diagnóstico"
              hint="Resultado da análise técnica realizada no equipamento."
              error={errosCampos.diagnostico?.[0]}
              wide
            >
              <textarea
                id="diagnostico"
                name="diagnostico"
                defaultValue={ordemAtual.diagnostico ?? ''}
                placeholder="Descreva a causa identificada..."
                maxLength={4000}
                rows={4}
                onChange={() => limparErroCampo('diagnostico')}
                aria-invalid={Boolean(errosCampos.diagnostico?.[0])}
                aria-describedby={campoDescribedBy(
                  'diagnostico',
                  errosCampos.diagnostico?.[0],
                  true,
                )}
              />
            </FormField>

            <FormField
              id="servicoRealizado"
              label="Serviço realizado"
              hint="Informe os procedimentos concluídos pela equipe."
              error={errosCampos.servicoRealizado?.[0]}
              wide
            >
              <textarea
                id="servicoRealizado"
                name="servicoRealizado"
                defaultValue={ordemAtual.servicoRealizado ?? ''}
                placeholder="Ex.: limpeza interna e troca da pasta térmica..."
                maxLength={4000}
                rows={4}
                onChange={() => limparErroCampo('servicoRealizado')}
                aria-invalid={Boolean(errosCampos.servicoRealizado?.[0])}
                aria-describedby={campoDescribedBy(
                  'servicoRealizado',
                  errosCampos.servicoRealizado?.[0],
                  true,
                )}
              />
            </FormField>

            <FormField
              id="pecasUtilizadas"
              label="Peças utilizadas"
              hint="Registre peças, quantidades ou referências importantes."
              error={errosCampos.pecasUtilizadas?.[0]}
              wide
            >
              <textarea
                id="pecasUtilizadas"
                name="pecasUtilizadas"
                defaultValue={ordemAtual.pecasUtilizadas ?? ''}
                placeholder="Ex.: 1 SSD 480 GB — modelo XYZ..."
                maxLength={4000}
                rows={3}
                onChange={() => limparErroCampo('pecasUtilizadas')}
                aria-invalid={Boolean(errosCampos.pecasUtilizadas?.[0])}
                aria-describedby={campoDescribedBy(
                  'pecasUtilizadas',
                  errosCampos.pecasUtilizadas?.[0],
                  true,
                )}
              />
            </FormField>
          </div>
        </section>

        <section className="edit-order-section">
          <SectionHeader
            icon={<CalendarIcon />}
            title="Planejamento"
            description="Responsável e prazo combinados para a entrega."
            variant="violet"
          />

          <div className="edit-order-section__body edit-order-grid">
            <FormField
              id="tecnicoResponsavel"
              label="Técnico responsável"
              hint="O backend atual utiliza o nome livre do responsável."
              error={errosCampos.tecnicoResponsavel?.[0]}
            >
              <input
                id="tecnicoResponsavel"
                name="tecnicoResponsavel"
                type="text"
                defaultValue={ordemAtual.tecnicoResponsavel ?? ''}
                placeholder="Nome do técnico"
                maxLength={120}
                autoComplete="off"
                onChange={() => limparErroCampo('tecnicoResponsavel')}
                aria-invalid={Boolean(errosCampos.tecnicoResponsavel?.[0])}
                aria-describedby={campoDescribedBy(
                  'tecnicoResponsavel',
                  errosCampos.tecnicoResponsavel?.[0],
                  true,
                )}
              />
            </FormField>

            <FormField
              id="previsaoDeEntrega"
              label="Previsão de entrega"
              hint="Deixe vazio enquanto não houver uma previsão segura."
              error={errosCampos.previsaoDeEntrega?.[0]}
            >
              <input
                id="previsaoDeEntrega"
                name="previsaoDeEntrega"
                type="datetime-local"
                defaultValue={formatarDataParaInput(ordemAtual.previsaoDeEntrega)}
                onChange={() => limparErroCampo('previsaoDeEntrega')}
                aria-invalid={Boolean(errosCampos.previsaoDeEntrega?.[0])}
                aria-describedby={campoDescribedBy(
                  'previsaoDeEntrega',
                  errosCampos.previsaoDeEntrega?.[0],
                  true,
                )}
              />
            </FormField>
          </div>
        </section>

        <aside className="edit-order-note">
          <InfoIcon />
          <div>
            <strong>O orçamento aprovado fica preservado</strong>
            <p>
              Cliente, equipamento, problema e valor não mudam nesta tela.
              Pagamentos são registrados nos detalhes da ordem.
            </p>
          </div>
        </aside>

        {erroApi && (
          <div className="edit-order-api-error" role="alert">
            <WarningIcon />
            <span>{erroApi}</span>
            {exigeRecarregamento && (
              <button type="button" onClick={recarregarOrdem}>
                Recarregar dados
              </button>
            )}
          </div>
        )}

        <div className="edit-order-actions">
          <Link to={`/ordens/${ordemAtual.id}`}>Cancelar</Link>
          <button
            type="submit"
            disabled={salvando || !formularioAlterado}
            aria-busy={salvando}
          >
            <SaveIcon />
            {salvando ? 'Salvando alterações...' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}

function montarAlteracoes(
  ordem: OrdemServico,
  dados: EditarOrdemFormData,
  camposAlterados: ReadonlySet<string>,
): AtualizarOrdemInput | null {
  const alteracoes: Omit<
    AtualizarOrdemInput,
    'statusEsperado' | 'versaoEsperada'
  > = {}
  const previsaoIso = dados.previsaoDeEntrega
    ? new Date(dados.previsaoDeEntrega).toISOString()
    : null

  if (
    camposAlterados.has('diagnostico') &&
    dados.diagnostico !== ordem.diagnostico
  ) {
    alteracoes.diagnostico = dados.diagnostico
  }
  if (
    camposAlterados.has('servicoRealizado') &&
    dados.servicoRealizado !== ordem.servicoRealizado
  ) {
    alteracoes.servicoRealizado = dados.servicoRealizado
  }
  if (
    camposAlterados.has('pecasUtilizadas') &&
    dados.pecasUtilizadas !== ordem.pecasUtilizadas
  ) {
    alteracoes.pecasUtilizadas = dados.pecasUtilizadas
  }
  if (
    camposAlterados.has('tecnicoResponsavel') &&
    dados.tecnicoResponsavel !== ordem.tecnicoResponsavel
  ) {
    alteracoes.tecnicoResponsavel = dados.tecnicoResponsavel
  }
  if (
    camposAlterados.has('previsaoDeEntrega') &&
    !datasSaoIguais(previsaoIso, ordem.previsaoDeEntrega)
  ) {
    alteracoes.previsaoDeEntrega = previsaoIso
  }
  if (camposAlterados.has('status') && dados.status !== ordem.status) {
    alteracoes.status = dados.status
    if (dados.mensagemPublica) {
      alteracoes.mensagemPublica = dados.mensagemPublica
    }
  }

  if (Object.keys(alteracoes).length === 0) return null

  return {
    statusEsperado: ordem.status,
    versaoEsperada: ordem.versao,
    ...alteracoes,
  }
}

function datasSaoIguais(primeira: string | null, segunda: string | null) {
  if (primeira === null || segunda === null) return primeira === segunda
  return new Date(primeira).getTime() === new Date(segunda).getTime()
}

function formatarDataParaInput(valor: string | null) {
  if (!valor) return ''

  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''

  // datetime-local não possui fuso. O deslocamento apresenta a mesma data e
  // hora local que o funcionário vê no restante do sistema.
  const dataLocal = new Date(data.getTime() - data.getTimezoneOffset() * 60_000)
  return dataLocal.toISOString().slice(0, 16)
}

function obterIniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(parte => parte[0]?.toUpperCase() ?? '')
    .join('')
}

interface SectionHeaderProps {
  icon: ReactNode
  title: string
  description: string
  eyebrow?: string
  variant?: 'violet' | 'green'
}

function SectionHeader({
  icon,
  title,
  description,
  eyebrow,
  variant,
}: SectionHeaderProps) {
  return (
    <header className="edit-order-section__header">
      <div
        className={[
          'edit-order-section__icon',
          variant ? `edit-order-section__icon--${variant}` : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {icon}
      </div>
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  )
}

interface FormFieldProps {
  id: string
  label: string
  children: ReactNode
  required?: boolean
  hint?: string
  error?: string
  wide?: boolean
}

function FormField({
  id,
  label,
  children,
  required = false,
  hint,
  error,
  wide = false,
}: FormFieldProps) {
  return (
    <div className={`edit-order-field${wide ? ' edit-order-field--wide' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? (
        <small id={`${id}-error`} className="edit-order-field__error">
          {error}
        </small>
      ) : (
        hint && <small id={`${id}-hint`}>{hint}</small>
      )}
    </div>
  )
}

function campoDescribedBy(id: string, error?: string, hasHint = false) {
  if (error) return `${id}-error`
  return hasHint ? `${id}-hint` : undefined
}

function OrderEditFeedback({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry?: () => void
}) {
  return (
    <section className="edit-order-feedback" role="alert">
      <div className="edit-order-feedback__icon">
        <WarningIcon />
      </div>
      <h1>{title}</h1>
      <p>{message}</p>
      <div>
        <Link to="/ordens">Voltar para ordens</Link>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        )}
      </div>
    </section>
  )
}

function OrderEditSkeleton() {
  return (
    <div className="edit-order-skeleton" aria-busy="true">
      <span className="sr-only">Carregando formulário da ordem</span>
      <div className="edit-order-skeleton__header" />
      <div className="edit-order-skeleton__section" />
      <div className="edit-order-skeleton__section edit-order-skeleton__section--small" />
    </div>
  )
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

function WorkflowIcon() {
  return <Icon><circle cx="6" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><path d="M8 6h4a3 3 0 0 1 3 3v6M12 18h4" /></Icon>
}

function CalendarIcon() {
  return <Icon><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Icon>
}

function InfoIcon() {
  return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></Icon>
}

function WarningIcon() {
  return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon>
}

function SaveIcon() {
  return <Icon><path d="M5 3h12l2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></Icon>
}
