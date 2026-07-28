import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import servixLogo from '../../../assets/brand/servix-logo.svg'
import { AuthLayout } from '../../../shared/layouts/AuthLayout'
import { FORMA_PAGAMENTO_LABELS } from '../../../shared/types/ordem.types'
import BudgetStatusBadge from '../components/BudgetStatusBadge'
import {
  buscarOrcamentoPublico,
  OrcamentoApiError,
  responderOrcamentoPublico,
} from '../services/budgets.service'
import {
  TIPO_ITEM_ORCAMENTO_LABELS,
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
    valor: 'CARTAO_CREDITO',
    titulo: 'Cartão de crédito',
    descricao: 'Pagamento combinado e realizado diretamente com a assistência.',
  },
  {
    valor: 'CARTAO_DEBITO',
    titulo: 'Cartão de débito',
    descricao: 'Pagamento realizado na assistência, conforme a orientação da equipe.',
  },
  {
    valor: 'DINHEIRO',
    titulo: 'Dinheiro',
    descricao: 'A assistência registrará o recebimento manualmente.',
  },
  {
    valor: 'BOLETO',
    titulo: 'Boleto',
    descricao: 'A assistência fornecerá as instruções diretamente ao cliente.',
  },
  {
    valor: 'OUTRO',
    titulo: 'Outra forma',
    descricao: 'Combine outra forma de pagamento diretamente com a assistência.',
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
  const acaoEmAndamento = useRef(false)

  const orcamento = orcamentoCarregado?.token === tokenAtual
    ? orcamentoCarregado.dados
    : null
  const erroCarga = falhaCarga?.token === tokenAtual
    ? falhaCarga.mensagem
    : ''
  useEffect(() => {
    if (!tokenAtual) return

    const controller = new AbortController()
    void buscarOrcamentoPublico(tokenAtual, { signal: controller.signal })
      .then(resultado => {
        setOrcamentoCarregado({ token: tokenAtual, dados: resultado })
        setFormaPagamento(resultado.formaPagamentoEscolhida ?? '')
        setFalhaCarga(null)
        setErroAcao('')
        setConflito(false)
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

  function recarregarOrcamento() {
    setOrcamentoCarregado(null)
    setFalhaCarga(null)
    setErroAcao('')
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
                  <button type="button" className="public-budget-decision__approve" disabled={Boolean(processando)} onClick={() => void responder('aprovar')}><CheckIcon />{processando === 'aprovar' ? 'Aprovando...' : 'Aprovar orçamento'}</button>
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
                <RecordedPaymentMethod formaPagamento={orcamento.formaPagamentoEscolhida} />
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
  value,
  erro,
  disabled,
  onChange,
}: {
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
          <h2 id="public-budget-payment-method-title">Como será feito o pagamento?</h2>
          <p>Escolha uma opção para combinar com a assistência. Nenhum pagamento é processado neste link.</p>
        </div>
      </div>

      <fieldset disabled={disabled} aria-describedby={erro ? 'public-budget-payment-method-error' : undefined}>
        <legend className="sr-only">Forma de pagamento</legend>
        {FORMAS_PAGAMENTO.map(forma => (
            <label
              key={forma.valor}
              className={value === forma.valor ? 'is-selected' : ''}
            >
              <input
                type="radio"
                name="formaPagamento"
                value={forma.valor}
                checked={value === forma.valor}
                disabled={disabled}
                onChange={() => onChange(forma.valor)}
              />
              <span className="public-budget-payment-method__radio" aria-hidden="true" />
              <span className="public-budget-payment-method__copy">
                <strong>{forma.titulo}</strong>
                <span>{forma.descricao}</span>
              </span>
            </label>
        ))}
      </fieldset>

      {erro && <p className="public-budget-payment-method__error" id="public-budget-payment-method-error" role="alert"><WarningIcon />{erro}</p>}
    </section>
  )
}

function RecordedPaymentMethod({ formaPagamento }: { formaPagamento: FormaPagamentoPublica }) {
  const formaLegada = formaPagamento === 'PIX'

  return (
    <section className="public-budget-recorded-payment" role="status">
      <WalletIcon />
      <div><span>Pagamento combinado com a assistência</span><strong>{formaLegada ? 'Pagamento direto' : FORMA_PAGAMENTO_LABELS[formaPagamento]}</strong><p>A assistência confirmará as instruções e registrará o recebimento no atendimento.</p></div>
    </section>
  )
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

function Icon({ children }: { children: ReactNode }) { return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg> }
function WarningIcon() { return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon> }
function CheckIcon() { return <Icon><path d="m5 12 4 4L19 6" /></Icon> }
function ShieldIcon() { return <Icon><path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></Icon> }
function InfoIcon() { return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></Icon> }
function WalletIcon() { return <Icon><path d="M4 6.5h14a2 2 0 0 1 2 2V19H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12M16 12h4" /><circle cx="16" cy="12" r=".5" /></Icon> }
function TrackingIcon() { return <Icon><path d="M5 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7.5 14.5 16.5 9" /></Icon> }
function ArrowIcon() { return <Icon><path d="M5 12h14M14 7l5 5-5 5" /></Icon> }
