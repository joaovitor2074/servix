import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { AuthLayout } from '../../../shared/layouts/AuthLayout'
import servixLogo from '../../../assets/brand/servix-logo.svg'
import BudgetStatusBadge from '../components/BudgetStatusBadge'
import {
  buscarOrcamentoPublico,
  OrcamentoApiError,
  responderOrcamentoPublico,
} from '../services/budgets.service'
import {
  TIPO_ITEM_ORCAMENTO_LABELS,
  type OrcamentoPublico,
} from '../types/budget.types'
import {
  formatarData,
  formatarMoeda,
  formatarNumeroOrcamento,
} from '../utils/budget-formatters'
import './PublicBudgetPage.css'

export default function PublicBudgetPage() {
  const { token = '' } = useParams()
  const [orcamento, setOrcamento] = useState<OrcamentoPublico | null>(null)
  const [erroCarga, setErroCarga] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [processando, setProcessando] = useState<'aprovar' | 'rejeitar' | null>(null)
  const [erroAcao, setErroAcao] = useState('')
  const [conflito, setConflito] = useState(false)
  const acaoEmAndamento = useRef(false)

  useEffect(() => {
    if (!token.trim()) return

    const controller = new AbortController()
    void buscarOrcamentoPublico(token, { signal: controller.signal })
      .then(resultado => {
        setOrcamento(resultado)
        setErroCarga('')
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErroCarga(
          error instanceof OrcamentoApiError && error.status === 404
            ? 'Este orçamento não foi encontrado ou o link não está mais disponível.'
            : error instanceof Error
              ? error.message
              : 'Não foi possível carregar o orçamento.',
        )
      })

    return () => controller.abort()
  }, [tentativa, token])

  async function responder(acao: 'aprovar' | 'rejeitar') {
    if (!orcamento || acaoEmAndamento.current) return
    const confirmacao = acao === 'aprovar'
      ? 'Aprovar este orçamento e autorizar a geração da ordem de serviço?'
      : 'Rejeitar este orçamento?'
    if (!window.confirm(confirmacao)) return

    acaoEmAndamento.current = true
    setProcessando(acao)
    setErroAcao('')
    setConflito(false)

    try {
      const atualizado = await responderOrcamentoPublico(
        token,
        acao,
        orcamento.versao,
      )
      setOrcamento(atualizado)
    } catch (error) {
      const houveConflito =
        error instanceof OrcamentoApiError && error.status === 409
      setConflito(houveConflito)
      setErroAcao(
        houveConflito
          ? 'Este orçamento foi atualizado. Recarregue para conferir a versão mais recente.'
          : error instanceof Error
            ? error.message
            : 'Não foi possível registrar sua resposta.',
      )
    } finally {
      acaoEmAndamento.current = false
      setProcessando(null)
    }
  }

  return (
    <AuthLayout>
      <div className="public-budget-page">
        <header className="public-budget-brand">
          <img src={servixLogo} alt="Servix" />
          {orcamento && <span>Proposta de {orcamento.empresa.nome}</span>}
        </header>

        {!token.trim() && (
          <section className="public-budget-feedback" role="alert">
            <div><WarningIcon /></div>
            <h1>Link inválido</h1>
            <p>O endereço informado não possui um token de orçamento válido.</p>
          </section>
        )}

        {token.trim() && !orcamento && !erroCarga && <PublicBudgetSkeleton />}

        {erroCarga && (
          <section className="public-budget-feedback" role="alert">
            <div><WarningIcon /></div>
            <h1>Não foi possível abrir a proposta</h1>
            <p>{erroCarga}</p>
            <button type="button" onClick={() => {
              setErroCarga('')
              setTentativa(valor => valor + 1)
            }}>Tentar novamente</button>
          </section>
        )}

        {orcamento && (
          <main className="public-budget-card">
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
                {orcamento.itens.map(item => (
                  <article key={item.id}>
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

            {erroAcao && <div className="public-budget-alert" role="alert"><WarningIcon /><span>{erroAcao}</span>{conflito && <button type="button" onClick={() => { setOrcamento(null); setErroAcao(''); setTentativa(valor => valor + 1) }}>Recarregar</button>}</div>}

            {orcamento.status === 'ENVIADO' && (
              <section className="public-budget-decision">
                <div><ShieldIcon /><span><strong>Registre sua decisão</strong><p>A aprovação autoriza a empresa a transformar esta proposta em ordem de serviço.</p></span></div>
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

            <footer className="public-budget-contact">
              <strong>{orcamento.empresa.nome}</strong>
              <span>
                {[
                  orcamento.empresa.telefone,
                  orcamento.empresa.email,
                ].filter(Boolean).join(' · ') || 'Entre em contato diretamente com a empresa em caso de dúvidas.'}
              </span>
            </footer>
          </main>
        )}
      </div>
    </AuthLayout>
  )
}

function DecisionResult({ tone, title, message }: { tone: 'success' | 'danger' | 'warning'; title: string; message: string }) {
  return <section className={`public-budget-result public-budget-result--${tone}`} role="status">{tone === 'success' ? <CheckIcon /> : <InfoIcon />}<div><strong>{title}</strong><p>{message}</p></div></section>
}
function PublicBudgetSkeleton() { return <div className="public-budget-skeleton" aria-busy="true"><span className="sr-only">Carregando proposta</span><div /><div /><div /></div> }
function obterPrimeiroNome(nome: string) { return nome.trim().split(/\s+/)[0] || 'cliente' }
function Icon({ children }: { children: ReactNode }) { return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg> }
function WarningIcon() { return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon> }
function CheckIcon() { return <Icon><path d="m5 12 4 4L19 6" /></Icon> }
function ShieldIcon() { return <Icon><path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z" /><path d="m9 12 2 2 4-5" /></Icon> }
function InfoIcon() { return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></Icon> }
