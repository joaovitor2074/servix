import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useParams } from 'react-router'
import servixLogo from '../../../assets/brand/servix-logo.svg'
import { AuthLayout } from '../../../shared/layouts/AuthLayout'
import { FORMA_PAGAMENTO_LABELS } from '../../../shared/types/ordem.types'
import BudgetStatusBadge from '../components/BudgetStatusBadge'
import {
  buscarCobrancaPublica,
  buscarOrcamentoPublico,
  criarCobrancaPublica,
  OrcamentoApiError,
  responderOrcamentoPublico,
} from '../services/budgets.service'
import {
  TIPO_ITEM_ORCAMENTO_LABELS,
  type CobrancaPublica,
  type FormaPagamentoPublica,
  type OrcamentoPublico,
} from '../types/budget.types'
import {
  formatarData,
  formatarMoeda,
  formatarNumeroOrcamento,
} from '../utils/budget-formatters'
import './PublicBudgetPage.css'

const FORMAS_PAGAMENTO: Array<{
  valor: FormaPagamentoPublica
  titulo: string
  descricao: string
}> = [
  {
    valor: 'PIX',
    titulo: 'Pix',
    descricao: 'Gere o código copia e cola logo após aprovar.',
  },
  {
    valor: 'CARTAO_CREDITO',
    titulo: 'Cartão de crédito',
    descricao: 'Combine o recebimento do cartão diretamente com a empresa.',
  },
  {
    valor: 'CARTAO_DEBITO',
    titulo: 'Cartão de débito',
    descricao: 'Pague no atendimento conforme a orientação da empresa.',
  },
  {
    valor: 'DINHEIRO',
    titulo: 'Dinheiro',
    descricao: 'A empresa registrará o recebimento manualmente.',
  },
  {
    valor: 'BOLETO',
    titulo: 'Boleto',
    descricao: 'A empresa entrará em contato com as instruções de pagamento.',
  },
  {
    valor: 'OUTRO',
    titulo: 'Outra forma',
    descricao: 'Combine outra forma de pagamento diretamente com a empresa.',
  },
]

export default function PublicBudgetPage() {
  const { token = '' } = useParams()
  const tokenAtual = token.trim()
  const [orcamentoCarregado, setOrcamentoCarregado] = useState<{
    token: string
    dados: OrcamentoPublico
  } | null>(null)
  const [falhaCarga, setFalhaCarga] = useState<{
    token: string
    mensagem: string
  } | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [processando, setProcessando] = useState<'aprovar' | 'rejeitar' | null>(null)
  const [erroAcao, setErroAcao] = useState('')
  const [conflito, setConflito] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoPublica | ''>('')
  const [erroFormaPagamento, setErroFormaPagamento] = useState('')
  const [cobrancaCarregada, setCobrancaCarregada] = useState<{
    token: string
    dados: CobrancaPublica | null
  } | null>(null)
  const [carregandoCobranca, setCarregandoCobranca] = useState(true)
  const [gerandoCobranca, setGerandoCobranca] = useState(false)
  const [verificandoCobranca, setVerificandoCobranca] = useState(false)
  const [erroCobranca, setErroCobranca] = useState('')
  const [codigoCopiado, setCodigoCopiado] = useState(false)
  const acaoEmAndamento = useRef(false)
  const geracaoEmAndamento = useRef(false)
  const chaveIdempotencia = useRef<string | null>(null)
  const consultaCobrancaAtual = useRef(0)
  const consultaCobrancaManualAtual = useRef(0)
  const verificacaoManualEmAndamento = useRef(false)

  const orcamento = orcamentoCarregado?.token === tokenAtual
    ? orcamentoCarregado.dados
    : null
  const erroCarga = falhaCarga?.token === tokenAtual
    ? falhaCarga.mensagem
    : ''
  const cobranca = cobrancaCarregada?.token === tokenAtual
    ? cobrancaCarregada.dados
    : null

  useEffect(() => {
    if (!tokenAtual) return

    const controller = new AbortController()
    void buscarOrcamentoPublico(tokenAtual, { signal: controller.signal })
      .then(resultado => {
        setOrcamentoCarregado({ token: tokenAtual, dados: resultado })
        setFormaPagamento(resultado.formaPagamentoEscolhida ?? '')
        setCarregandoCobranca(
          resultado.formaPagamentoEscolhida === 'PIX' &&
          (resultado.status === 'APROVADO' || resultado.status === 'CONVERTIDO'),
        )
        setFalhaCarga(null)
        setErroAcao('')
        setErroCobranca('')
        setConflito(false)
        setCobrancaCarregada(null)
        chaveIdempotencia.current = null
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setFalhaCarga({
          token: tokenAtual,
          mensagem: error instanceof OrcamentoApiError && error.status === 404
            ? 'Este orçamento não foi encontrado ou o link não está mais disponível.'
            : obterMensagemErroPublico(error, 'Não foi possível carregar o orçamento.'),
        })
      })

    return () => controller.abort()
  }, [tentativa, tokenAtual])

  const rotaAcompanhamento = orcamento
    ? obterRotaAcompanhamento(orcamento)
    : null

  useEffect(() => {
    if (
      !orcamento ||
      orcamento.status !== 'APROVADO' ||
      rotaAcompanhamento
    ) return

    const controller = new AbortController()
    const intervalo = window.setInterval(() => {
      if (document.hidden) return

      void buscarOrcamentoPublico(tokenAtual, { signal: controller.signal })
        .then(resultado => {
          setOrcamentoCarregado({ token: tokenAtual, dados: resultado })
          setFormaPagamento(resultado.formaPagamentoEscolhida ?? '')
        })
        .catch(error => {
          if (error instanceof Error && error.name === 'AbortError') return
          // A página continua útil com os últimos dados; a próxima consulta
          // tenta detectar novamente se a ordem de serviço já foi criada.
        })
    }, 30_000)

    return () => {
      window.clearInterval(intervalo)
      controller.abort()
    }
  }, [orcamento, rotaAcompanhamento, tokenAtual])

  const consultarCobranca = useCallback(async (
    signal?: AbortSignal,
    silenciosa = false,
  ) => {
    if (silenciosa && verificacaoManualEmAndamento.current) return
    if (!silenciosa && verificacaoManualEmAndamento.current) return

    const numeroConsultaManual = !silenciosa
      ? ++consultaCobrancaManualAtual.current
      : null

    if (!silenciosa) verificacaoManualEmAndamento.current = true
    const numeroConsulta = ++consultaCobrancaAtual.current
    if (!silenciosa) setVerificandoCobranca(true)

    try {
      const resultado = await buscarCobrancaPublica(tokenAtual, { signal })
      if (numeroConsulta !== consultaCobrancaAtual.current) return
      setCobrancaCarregada({ token: tokenAtual, dados: resultado })
      setErroCobranca('')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      if (numeroConsulta !== consultaCobrancaAtual.current) return

      if (!silenciosa) {
        setErroCobranca(obterMensagemErroPublico(
          error,
          'Não foi possível atualizar a situação do pagamento.',
        ))
      }
    } finally {
      if (
        numeroConsultaManual !== null &&
        numeroConsultaManual === consultaCobrancaManualAtual.current
      ) {
        verificacaoManualEmAndamento.current = false
        setVerificandoCobranca(false)
      }
    }
  }, [tokenAtual])

  const deveConsultarCobranca =
    orcamento?.formaPagamentoEscolhida === 'PIX' &&
    (orcamento.status === 'APROVADO' || orcamento.status === 'CONVERTIDO')

  useEffect(() => {
    if (!deveConsultarCobranca) return

    const controller = new AbortController()
    const numeroConsulta = ++consultaCobrancaAtual.current
    void buscarCobrancaPublica(tokenAtual, { signal: controller.signal })
      .then(resultado => {
        if (numeroConsulta !== consultaCobrancaAtual.current) return
        setCobrancaCarregada({ token: tokenAtual, dados: resultado })
        if (resultado) setErroCobranca('')
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        if (numeroConsulta !== consultaCobrancaAtual.current) return
        setErroCobranca(obterMensagemErroPublico(
          error,
          'Não foi possível consultar a cobrança.',
        ))
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregandoCobranca(false)
      })

    return () => controller.abort()
  }, [deveConsultarCobranca, tokenAtual])

  useEffect(() => {
    if (cobranca?.status !== 'PENDENTE') return

    const controller = new AbortController()
    const intervalo = window.setInterval(() => {
      if (!document.hidden) {
        void consultarCobranca(controller.signal, true)
      }
    }, 8_000)

    return () => {
      window.clearInterval(intervalo)
      controller.abort()
    }
  }, [cobranca?.status, consultarCobranca])

  async function responder(acao: 'aprovar' | 'rejeitar') {
    if (!orcamento || acaoEmAndamento.current) return

    if (acao === 'aprovar' && !formaPagamento) {
      setErroFormaPagamento('Escolha como deseja pagar antes de aprovar o orçamento.')
      document.getElementById('public-budget-payment-method')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }

    const confirmacao = acao === 'aprovar'
      ? `Aprovar este orçamento com pagamento por ${FORMA_PAGAMENTO_LABELS[formaPagamento as FormaPagamentoPublica]}?`
      : 'Rejeitar este orçamento?'
    if (!window.confirm(confirmacao)) return

    acaoEmAndamento.current = true
    setProcessando(acao)
    setErroAcao('')
    setConflito(false)

    try {
      const atualizado = await responderOrcamentoPublico(
        tokenAtual,
        acao,
        orcamento.versao,
        acao === 'aprovar' ? formaPagamento || undefined : undefined,
      )
      if (acao === 'aprovar' && formaPagamento === 'PIX') {
        await gerarCobranca()
      }

      setOrcamentoCarregado({ token: tokenAtual, dados: atualizado })
      setFormaPagamento(atualizado.formaPagamentoEscolhida ?? formaPagamento)
    } catch (error) {
      const houveConflito =
        error instanceof OrcamentoApiError && error.status === 409
      setConflito(houveConflito)
      setErroAcao(
        houveConflito
          ? 'Este orçamento foi atualizado. Recarregue para conferir a versão mais recente.'
          : obterMensagemErroPublico(error, 'Não foi possível registrar sua resposta.'),
      )
    } finally {
      acaoEmAndamento.current = false
      setProcessando(null)
    }
  }

  async function gerarCobranca(novaChave = false) {
    if (geracaoEmAndamento.current) return
    if (novaChave) chaveIdempotencia.current = null
    chaveIdempotencia.current ??= criarChaveIdempotencia()

    geracaoEmAndamento.current = true
    setGerandoCobranca(true)
    setErroCobranca('')
    const numeroConsulta = ++consultaCobrancaAtual.current

    try {
      const resultado = await criarCobrancaPublica(
        tokenAtual,
        chaveIdempotencia.current,
      )
      if (numeroConsulta === consultaCobrancaAtual.current) {
        setCobrancaCarregada({ token: tokenAtual, dados: resultado })
        setCodigoCopiado(false)
      }
    } catch (error) {
      const houveConflito =
        error instanceof OrcamentoApiError && error.status === 409

      setErroCobranca(
        houveConflito
          ? 'A cobrança mudou enquanto esta página estava aberta. Atualizamos os dados abaixo.'
          : obterMensagemErroPublico(error, 'Não foi possível gerar a cobrança Pix.'),
      )

      if (houveConflito) {
        await consultarCobranca(undefined, true)
        setErroCobranca('A cobrança mudou enquanto esta página estava aberta. Os dados abaixo já foram atualizados.')
      }
    } finally {
      geracaoEmAndamento.current = false
      setGerandoCobranca(false)
    }
  }

  async function copiarCodigoPix() {
    if (!cobranca?.codigoPix) return

    try {
      await navigator.clipboard.writeText(cobranca.codigoPix)
      setCodigoCopiado(true)
      setErroCobranca('')
    } catch {
      setCodigoCopiado(false)
      setErroCobranca('Não foi possível copiar automaticamente. Selecione o código e copie manualmente.')
    }
  }

  function recarregarOrcamento() {
    setOrcamentoCarregado(null)
    setCobrancaCarregada(null)
    setFalhaCarga(null)
    setCarregandoCobranca(true)
    setErroAcao('')
    setErroCobranca('')
    setTentativa(valor => valor + 1)
  }

  return (
    <AuthLayout>
      <div className="public-budget-page">
        <header className="public-budget-brand">
          <img src={servixLogo} alt="Servix" />
          {orcamento && <span>Proposta de {orcamento.empresa.nome}</span>}
        </header>

        {!tokenAtual && (
          <section className="public-budget-feedback" role="alert">
            <div><WarningIcon /></div>
            <h1>Link inválido</h1>
            <p>O endereço informado não possui um token de orçamento válido.</p>
          </section>
        )}

        {tokenAtual && !orcamento && !erroCarga && <PublicBudgetSkeleton />}

        {erroCarga && (
          <section className="public-budget-feedback" role="alert">
            <div><WarningIcon /></div>
            <h1>Não foi possível abrir a proposta</h1>
            <p>{erroCarga}</p>
            <button type="button" onClick={() => {
              setFalhaCarga(null)
              setTentativa(valor => valor + 1)
            }}>Tentar novamente</button>
          </section>
        )}

        {orcamento && (
          <article className="public-budget-card">
            <header className="public-budget-card__header">
              <div>
                <span>Orçamento {formatarNumeroOrcamento(orcamento.numero)}</span>
                <h1>Olá, {obterPrimeiroNome(orcamento.cliente.nome)}</h1>
                <p>Confira os serviços e valores apresentados por {orcamento.empresa.nome}.</p>
              </div>
              <BudgetStatusBadge status={orcamento.status} dot />
            </header>

            <section className="public-budget-overview">
              <div><small>Equipamento</small><strong>{orcamento.equipamento}</strong></div>
              <div><small>Validade</small><strong>{formatarData(orcamento.validade)}</strong></div>
              <div className="public-budget-overview__problem"><small>Problema relatado</small><p>{orcamento.descricaoProblema}</p></div>
            </section>

            <section className="public-budget-items" aria-labelledby="public-budget-items-title">
              <h2 id="public-budget-items-title">Itens da proposta</h2>
              <div>
              {orcamento.itens.map((item, indice) => (
                <article key={`${item.tipo}-${item.descricao}-${indice}`}>
                    <div><span>{TIPO_ITEM_ORCAMENTO_LABELS[item.tipo]}</span><strong>{item.descricao}</strong><small>{item.quantidade} × {formatarMoeda(item.valorUnitario)}</small></div>
                    <strong>{formatarMoeda(item.valorTotal)}</strong>
                  </article>
                ))}
              </div>
            </section>

            {orcamento.observacoes && (
              <section className="public-budget-observations"><h2>Observações</h2><p>{orcamento.observacoes}</p></section>
            )}

            <section className="public-budget-totals" aria-label="Totais do orçamento">
              <div><span>Subtotal</span><strong>{formatarMoeda(orcamento.subtotal)}</strong></div>
              <div><span>Desconto</span><strong>− {formatarMoeda(orcamento.desconto)}</strong></div>
              <div><span>Total</span><strong>{formatarMoeda(orcamento.total)}</strong></div>
            </section>

            {orcamento.status === 'ENVIADO' && (
              <PaymentMethodChoice
                pixDisponivel={orcamento.pixDisponivel}
                value={formaPagamento}
                erro={erroFormaPagamento}
                disabled={Boolean(processando)}
                onChange={valor => {
                  setFormaPagamento(valor)
                  setErroFormaPagamento('')
                }}
              />
            )}

            {erroAcao && <div className="public-budget-alert" role="alert"><WarningIcon /><span>{erroAcao}</span>{conflito && <button type="button" onClick={recarregarOrcamento}>Recarregar</button>}</div>}

            {orcamento.status === 'ENVIADO' && (
              <section className="public-budget-decision">
                <div><ShieldIcon /><span><strong>Registre sua decisão</strong><p>A aprovação registra a forma de pagamento e autoriza a empresa a transformar esta proposta em ordem de serviço.</p></span></div>
                <div className="public-budget-decision__actions">
                  <button type="button" className="public-budget-decision__reject" disabled={Boolean(processando)} onClick={() => void responder('rejeitar')}>{processando === 'rejeitar' ? 'Registrando...' : 'Rejeitar proposta'}</button>
                  <button type="button" className="public-budget-decision__approve" disabled={Boolean(processando)} onClick={() => void responder('aprovar')}><CheckIcon />{processando === 'aprovar' ? (formaPagamento === 'PIX' ? 'Aprovando e gerando Pix...' : 'Aprovando...') : 'Aprovar orçamento'}</button>
                </div>
              </section>
            )}

            {orcamento.status === 'APROVADO' && <DecisionResult tone="success" title="Orçamento aprovado" message="Sua aprovação foi registrada. A empresa já pode gerar a ordem de serviço." />}
            {orcamento.status === 'REJEITADO' && <DecisionResult tone="danger" title="Orçamento rejeitado" message="Sua decisão foi registrada. Entre em contato com a empresa caso queira conversar sobre a proposta." />}
            {orcamento.status === 'EXPIRADO' && <DecisionResult tone="warning" title="Orçamento expirado" message="A validade desta proposta terminou. Solicite uma atualização à empresa." />}
            {orcamento.status === 'CONVERTIDO' && <DecisionResult tone="success" title="Ordem de serviço criada" message="Esta proposta foi aprovada e já está sendo atendida pela empresa." />}
            {orcamento.status === 'CANCELADO' && <DecisionResult tone="danger" title="Orçamento cancelado" message="Esta proposta foi encerrada pela empresa." />}
            {orcamento.status === 'RASCUNHO' && <DecisionResult tone="warning" title="Proposta em preparação" message="A empresa ainda não liberou este orçamento para aprovação." />}

            {orcamento.formaPagamentoEscolhida &&
              (orcamento.status === 'APROVADO' || orcamento.status === 'CONVERTIDO') && (
                orcamento.formaPagamentoEscolhida === 'PIX'
                  ? <PixChargePanel
                      cobranca={cobranca}
                      carregando={carregandoCobranca}
                      gerando={gerandoCobranca}
                      verificando={verificandoCobranca}
                      erro={erroCobranca}
                      codigoCopiado={codigoCopiado}
                      onCopiar={() => void copiarCodigoPix()}
                      onGerar={novaChave => void gerarCobranca(novaChave)}
                      onVerificar={() => void consultarCobranca(undefined, false)}
                    />
                  : <RecordedPaymentMethod formaPagamento={orcamento.formaPagamentoEscolhida} />
              )}

            {rotaAcompanhamento && (
              <section className="public-budget-tracking" aria-labelledby="public-budget-tracking-title">
                <span><TrackingIcon /></span>
                <div>
                  <h2 id="public-budget-tracking-title">Acompanhe seu serviço</h2>
                  <p>Veja o status, a previsão de entrega e as atualizações compartilhadas pela empresa.</p>
                </div>
                <a href={rotaAcompanhamento}>Acompanhar agora <ArrowIcon /></a>
              </section>
            )}

            <footer className="public-budget-contact">
              <strong>{orcamento.empresa.nome}</strong>
              <span>
                {[
                  orcamento.empresa.telefone,
                  orcamento.empresa.email,
                ].filter(Boolean).join(' · ') || 'Entre em contato diretamente com a empresa em caso de dúvidas.'}
              </span>
            </footer>
          </article>
        )}
      </div>
    </AuthLayout>
  )
}

function PaymentMethodChoice({
  pixDisponivel,
  value,
  erro,
  disabled,
  onChange,
}: {
  pixDisponivel: boolean
  value: FormaPagamentoPublica | ''
  erro: string
  disabled: boolean
  onChange: (valor: FormaPagamentoPublica) => void
}) {
  return (
    <section
      className={`public-budget-payment-method${erro ? ' public-budget-payment-method--error' : ''}`}
      id="public-budget-payment-method"
      aria-labelledby="public-budget-payment-method-title"
    >
      <div className="public-budget-payment-method__header">
        <span><WalletIcon /></span>
        <div>
          <h2 id="public-budget-payment-method-title">Como você prefere pagar?</h2>
          <p>Escolha uma opção para concluir a aprovação. Nenhum valor é cobrado antes da sua confirmação.</p>
        </div>
      </div>

      <fieldset disabled={disabled} aria-describedby={erro ? 'public-budget-payment-method-error' : undefined}>
        <legend className="sr-only">Forma de pagamento</legend>
        {FORMAS_PAGAMENTO.map(forma => {
          const indisponivel = forma.valor === 'PIX' && !pixDisponivel
          return (
            <label
              key={forma.valor}
              className={`${value === forma.valor ? 'is-selected' : ''}${indisponivel ? ' is-disabled' : ''}`}
            >
              <input
                type="radio"
                name="formaPagamento"
                value={forma.valor}
                checked={value === forma.valor}
                disabled={disabled || indisponivel}
                onChange={() => onChange(forma.valor)}
              />
              <span className="public-budget-payment-method__radio" aria-hidden="true" />
              <span className="public-budget-payment-method__copy">
                <strong>{forma.titulo}{forma.valor === 'PIX' && pixDisponivel && <small> Online</small>}</strong>
                <span>{indisponivel ? 'Pix temporariamente indisponível nesta empresa.' : forma.descricao}</span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {erro && <p className="public-budget-payment-method__error" id="public-budget-payment-method-error" role="alert"><WarningIcon />{erro}</p>}
    </section>
  )
}

function PixChargePanel({
  cobranca,
  carregando,
  gerando,
  verificando,
  erro,
  codigoCopiado,
  onCopiar,
  onGerar,
  onVerificar,
}: {
  cobranca: CobrancaPublica | null
  carregando: boolean
  gerando: boolean
  verificando: boolean
  erro: string
  codigoCopiado: boolean
  onCopiar: () => void
  onGerar: (novaChave: boolean) => void
  onVerificar: () => void
}) {
  return (
    <section className="public-budget-charge" aria-labelledby="public-budget-charge-title">
      <header>
        <div>
          <span className="public-budget-charge__icon"><PixIcon /></span>
          <div><h2 id="public-budget-charge-title">Pagamento por Pix</h2><p>A situação é atualizada automaticamente enquanto esta página estiver aberta.</p></div>
        </div>
        {cobranca && <ChargeStatus status={cobranca.status} />}
      </header>

      {erro && <div className="public-budget-charge__alert" role="alert"><WarningIcon /><span>{erro}</span></div>}

      {carregando && !cobranca && (
        <div className="public-budget-charge__loading" aria-busy="true"><span className="sr-only">Consultando cobrança</span><i /><i /></div>
      )}

      {!carregando && !cobranca && (
        <div className="public-budget-charge__empty">
          <div><strong>Seu código Pix ainda não foi gerado</strong><p>Use o botão abaixo. Repetir uma tentativa não cria cobranças duplicadas.</p></div>
          <button type="button" disabled={gerando} onClick={() => onGerar(false)}>{gerando ? 'Gerando...' : 'Gerar código Pix'}</button>
        </div>
      )}

      {cobranca?.status === 'PENDENTE' && (
        <div className="public-budget-charge__content">
          <div className="public-budget-charge__summary">
            <span><small>Valor</small><strong>{formatarMoeda(cobranca.valor)}</strong></span>
            <span><small>Vencimento</small><strong>{formatarDataHora(cobranca.expiraEm)}</strong></span>
          </div>

          {cobranca.codigoPix ? (
            <div className="public-budget-charge__code">
              <label htmlFor="public-budget-pix-code">Pix copia e cola</label>
              <textarea id="public-budget-pix-code" readOnly value={cobranca.codigoPix} onFocus={event => event.currentTarget.select()} />
              <button type="button" onClick={onCopiar}><CopyIcon />{codigoCopiado ? 'Código copiado' : 'Copiar código Pix'}</button>
            </div>
          ) : (
            <div className="public-budget-charge__waiting">
              <p>O provedor ainda não concluiu o código Pix. Você pode retomar a mesma cobrança com segurança.</p>
              <button
                type="button"
                disabled={gerando}
                onClick={() => onGerar(false)}
              >
                {gerando ? 'Tentando novamente...' : 'Tentar gerar novamente'}
              </button>
            </div>
          )}

          <div className="public-budget-charge__refresh">
            <span><PulseIcon /> Aguardando confirmação do pagamento</span>
            <button type="button" disabled={verificando} onClick={onVerificar}>{verificando ? 'Verificando...' : 'Verificar agora'}</button>
          </div>
        </div>
      )}

      {cobranca?.status === 'PAGA' && (
        <div className="public-budget-charge__result public-budget-charge__result--paid" role="status">
          <CheckIcon />
          <div><strong>Pagamento confirmado</strong><p>Recebemos {formatarMoeda(cobranca.valor)}{cobranca.pagaEm ? ` em ${formatarDataHora(cobranca.pagaEm)}` : ''}. Você não precisa fazer mais nada.</p></div>
        </div>
      )}

      {cobranca?.status === 'EXPIRADA' && (
        <div className="public-budget-charge__result public-budget-charge__result--expired" role="status">
          <ClockIcon />
          <div><strong>Este código Pix expirou</strong><p>Gere um novo código para tentar o pagamento novamente.</p></div>
          <button type="button" disabled={gerando} onClick={() => onGerar(true)}>{gerando ? 'Gerando...' : 'Gerar novo Pix'}</button>
        </div>
      )}

      {(cobranca?.status === 'CANCELADA' || cobranca?.status === 'ESTORNADA') && (
        <div className="public-budget-charge__result public-budget-charge__result--expired" role="status">
          <InfoIcon />
          <div><strong>{cobranca.status === 'CANCELADA' ? 'Cobrança cancelada' : 'Pagamento estornado'}</strong><p>Entre em contato com a empresa para combinar uma nova forma de pagamento.</p></div>
        </div>
      )}
    </section>
  )
}

function RecordedPaymentMethod({ formaPagamento }: { formaPagamento: FormaPagamentoPublica }) {
  return (
    <section className="public-budget-recorded-payment" role="status">
      <WalletIcon />
      <div><span>Forma de pagamento escolhida</span><strong>{FORMA_PAGAMENTO_LABELS[formaPagamento]}</strong><p>A empresa confirmará as instruções e registrará o recebimento no atendimento.</p></div>
    </section>
  )
}

function ChargeStatus({ status }: { status: CobrancaPublica['status'] }) {
  const labels: Record<CobrancaPublica['status'], string> = {
    PENDENTE: 'Pendente',
    PAGA: 'Paga',
    EXPIRADA: 'Expirada',
    CANCELADA: 'Cancelada',
    ESTORNADA: 'Estornada',
  }
  return <span className={`public-budget-charge-status public-budget-charge-status--${status.toLowerCase()}`}><i aria-hidden="true" />{labels[status]}</span>
}

function DecisionResult({ tone, title, message }: { tone: 'success' | 'danger' | 'warning'; title: string; message: string }) {
  return <section className={`public-budget-result public-budget-result--${tone}`} role="status">{tone === 'success' ? <CheckIcon /> : <InfoIcon />}<div><strong>{title}</strong><p>{message}</p></div></section>
}

function PublicBudgetSkeleton() { return <div className="public-budget-skeleton" aria-busy="true"><span className="sr-only">Carregando proposta</span><div /><div /><div /></div> }

function obterPrimeiroNome(nome: string) { return nome.trim().split(/\s+/)[0] || 'cliente' }

function obterRotaAcompanhamento(orcamento: OrcamentoPublico) {
  if (orcamento.tokenAcompanhamento?.trim()) {
    return `/acompanhar/${encodeURIComponent(orcamento.tokenAcompanhamento.trim())}`
  }

  const rota = orcamento.rotaAcompanhamento?.trim()
  return rota && /^\/acompanhar\/[^/?#]+$/.test(rota) ? rota : null
}

function criarChaveIdempotencia() {
  if (typeof crypto.randomUUID === 'function') {
    return `servix-publico-${crypto.randomUUID()}`
  }

  return `servix-publico-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function obterMensagemErroPublico(error: unknown, mensagemPadrao: string) {
  if (!(error instanceof OrcamentoApiError)) {
    return error instanceof Error ? error.message : mensagemPadrao
  }

  if (error.status === 429) {
    return error.retryAfterSegundos
      ? `Muitas tentativas em pouco tempo. Aguarde ${error.retryAfterSegundos} segundos e tente novamente.`
      : 'Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.'
  }

  return error.message || mensagemPadrao
}

function formatarDataHora(valor: string | null) {
  if (!valor) return 'Não informado'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'Não informado'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data)
}

function Icon({ children }: { children: ReactNode }) { return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg> }
function WarningIcon() { return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon> }
function CheckIcon() { return <Icon><path d="m5 12 4 4L19 6" /></Icon> }
function ShieldIcon() { return <Icon><path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></Icon> }
function InfoIcon() { return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></Icon> }
function WalletIcon() { return <Icon><path d="M4 6.5h14a2 2 0 0 1 2 2V19H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12M16 12h4" /><circle cx="16" cy="12" r=".5" /></Icon> }
function PixIcon() { return <Icon><path d="m8.2 5.2 2.4-2.4a2 2 0 0 1 2.8 0l2.4 2.4a2 2 0 0 0 1.4.6h1.3M5.5 18.2h1.3a2 2 0 0 0 1.4-.6l2.4-2.4a2 2 0 0 1 2.8 0l2.4 2.4a2 2 0 0 0 1.4.6h1.3M3 12l7.6-7.6a2 2 0 0 1 2.8 0L21 12l-7.6 7.6a2 2 0 0 1-2.8 0L3 12Z" /></Icon> }
function CopyIcon() { return <Icon><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></Icon> }
function PulseIcon() { return <Icon><path d="M3 12h4l2-5 4 10 2-5h6" /></Icon> }
function ClockIcon() { return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon> }
function TrackingIcon() { return <Icon><path d="M5 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7.5 14.5 16.5 9" /></Icon> }
function ArrowIcon() { return <Icon><path d="M5 12h14M14 7l5 5-5 5" /></Icon> }
