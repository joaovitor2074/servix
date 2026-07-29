import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { QRCodeSVG } from 'qrcode.react'
import BudgetStatusBadge from '../components/BudgetStatusBadge'
import {
  alterarStatusOrcamento,
  buscarOrcamento,
  OrcamentoApiError,
  transformarOrcamentoEmOrdem,
} from '../services/budgets.service'
import {
  STATUS_ORCAMENTO_LABELS,
  TIPO_ITEM_ORCAMENTO_LABELS,
  type Orcamento,
  type StatusOrcamento,
} from '../types/budget.types'
import {
  formatarData,
  formatarDataHora,
  formatarMoeda,
  formatarNumeroOrcamento,
  formatarTelefone,
} from '../utils/budget-formatters'
import './BudgetDetailsPage.css'

export default function BudgetDetailsPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const orcamentoId = Number(id)
  const idValido = Number.isInteger(orcamentoId) && orcamentoId > 0
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null)
  const [erroCarga, setErroCarga] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [processando, setProcessando] = useState('')
  const [erroAcao, setErroAcao] = useState('')
  const [exigeRecarregamento, setExigeRecarregamento] = useState(false)
  const [mensagem, setMensagem] = useState(() => lerMensagem(location.state))
  const [mostrarOrientacaoEnvio, setMostrarOrientacaoEnvio] = useState(() =>
    deveOrientarEnvio(location.state),
  )
  const [ocultarConviteOrdem, setOcultarConviteOrdem] = useState(false)
  const acaoEmAndamento = useRef(false)

  useEffect(() => {
    if (!idValido) return
    const controller = new AbortController()

    void buscarOrcamento(orcamentoId, { signal: controller.signal })
      .then(resultado => {
        setOrcamento(resultado)
        setErroCarga('')
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErroCarga(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o orçamento',
        )
      })

    return () => controller.abort()
  }, [idValido, orcamentoId, tentativa])

  function recarregar() {
    setOrcamento(null)
    setErroCarga('')
    setErroAcao('')
    setExigeRecarregamento(false)
    setTentativa(valor => valor + 1)
  }

  async function alterarStatus(status: StatusOrcamento) {
    if (!orcamento || acaoEmAndamento.current) return
    if (
      status === 'CANCELADO' &&
      !window.confirm('Cancelar este orçamento? Esta ação encerra a proposta.')
    ) return

    acaoEmAndamento.current = true
    setProcessando(status)
    setErroAcao('')

    try {
      const atualizado = await alterarStatusOrcamento(orcamento.id, {
        statusEsperado: orcamento.status,
        versaoEsperada: orcamento.versao,
        status,
      })
      setOrcamento(atualizado)
      if (status === 'CANCELADO') setMostrarOrientacaoEnvio(false)
      setMensagem(
        status === 'ENVIADO'
          ? 'Orçamento marcado como enviado. O link já pode ser compartilhado.'
          : status === 'RASCUNHO'
            ? 'Orçamento reaberto como rascunho.'
            : 'Orçamento cancelado.',
      )
    } catch (error) {
      tratarErroAcao(error)
    } finally {
      acaoEmAndamento.current = false
      setProcessando('')
    }
  }

  async function transformarEmOrdem() {
    if (!orcamento || acaoEmAndamento.current) return
    acaoEmAndamento.current = true
    setProcessando('CONVERTENDO')
    setErroAcao('')

    try {
      const resultado = await transformarOrcamentoEmOrdem(
        orcamento.id,
        orcamento.versao,
      )
      navigate(`/ordens/${resultado.ordem.id}`, {
        replace: true,
        state: {
          mensagem: resultado.jaExistente
            ? `Este orçamento já havia gerado a ordem #${resultado.ordem.numero}.`
            : `Ordem #${resultado.ordem.numero} criada a partir do orçamento.`,
        },
      })
    } catch (error) {
      tratarErroAcao(error)
    } finally {
      acaoEmAndamento.current = false
      setProcessando('')
    }
  }

  async function copiarLink() {
    if (!orcamento) return
    const link = montarLinkPublico(orcamento.tokenPublico)

    try {
      await navigator.clipboard.writeText(link)
      setMensagem('Link de aprovação copiado.')
      setErroAcao('')
    } catch {
      setErroAcao('Não foi possível copiar automaticamente. Selecione o link abaixo.')
    }
  }

  function tratarErroAcao(error: unknown) {
    const conflito = error instanceof OrcamentoApiError && error.status === 409
    setExigeRecarregamento(conflito)
    setErroAcao(
      conflito
        ? 'Este orçamento mudou em outra tela. Recarregue os dados antes de continuar.'
        : error instanceof Error
          ? error.message
          : 'Não foi possível concluir a ação.',
    )
  }

  if (!idValido) {
    return <BudgetDetailsFeedback title="Orçamento inválido" message="O endereço não possui um identificador válido." />
  }
  if (!orcamento && !erroCarga) return <BudgetDetailsSkeleton />
  if (erroCarga) {
    return <BudgetDetailsFeedback title="Não foi possível carregar o orçamento" message={erroCarga} onRetry={recarregar} />
  }
  if (!orcamento) return null

  const podeEditar = orcamento.status === 'RASCUNHO'
  const podeEnviar = orcamento.status === 'RASCUNHO'
  const podeReabrir =
    orcamento.status === 'REJEITADO' || orcamento.status === 'EXPIRADO'
  const podeCancelar = [
    'RASCUNHO',
    'ENVIADO',
    'APROVADO',
    'REJEITADO',
    'EXPIRADO',
  ].includes(orcamento.status)
  const podeConverter = orcamento.status === 'APROVADO' && !orcamento.ordem
  const linkPublico = montarLinkPublico(orcamento.tokenPublico)
  const exibirOrientacaoEnvio =
    mostrarOrientacaoEnvio &&
    (orcamento.status === 'RASCUNHO' || orcamento.status === 'ENVIADO')
  const exibirConviteOrdem = podeConverter && !ocultarConviteOrdem

  return (
    <div className="budget-details-page">
      <header className="budget-details-header">
        <div className="budget-details-header__main">
          <Link to="/orcamentos" aria-label="Voltar para orçamentos"><ArrowLeftIcon /></Link>
          <div>
            <span>Orçamentos</span>
            <h1>{formatarNumeroOrcamento(orcamento.numero)}</h1>
            <p>{orcamento.equipamento} · {orcamento.cliente.nome}</p>
          </div>
        </div>
        <div className="budget-details-header__actions">
          <BudgetStatusBadge status={orcamento.status} dot />
          <button className="budget-action budget-action--secondary" type="button" onClick={() => window.print()}><PrintIcon /> Imprimir orçamento</button>
          {podeEditar && <Link className="budget-action budget-action--secondary" to={`/orcamentos/${orcamento.id}/editar`}><PencilIcon /> Editar</Link>}
          {podeEnviar && <button className="budget-action budget-action--primary" type="button" disabled={Boolean(processando)} onClick={() => void alterarStatus('ENVIADO')}><SendIcon />{processando === 'ENVIADO' ? 'Enviando...' : 'Marcar como enviado'}</button>}
          {podeReabrir && <button className="budget-action budget-action--secondary" type="button" disabled={Boolean(processando)} onClick={() => void alterarStatus('RASCUNHO')}><RefreshIcon />{processando === 'RASCUNHO' ? 'Reabrindo...' : 'Reabrir rascunho'}</button>}
          {podeConverter && <button className="budget-action budget-action--primary" type="button" disabled={Boolean(processando)} onClick={() => void transformarEmOrdem()}><ToolIcon />{processando === 'CONVERTENDO' ? 'Gerando ordem...' : 'Gerar ordem de serviço'}</button>}
          {orcamento.ordem && <Link className="budget-action budget-action--primary" to={`/ordens/${orcamento.ordem.id}`}><ToolIcon /> Ver ordem #{orcamento.ordem.numero}</Link>}
        </div>
      </header>

      {mensagem && <div className="budget-details-success" role="status"><CheckIcon /><span>{mensagem}</span><button type="button" aria-label="Fechar mensagem" onClick={() => setMensagem('')}>×</button></div>}
      {erroAcao && <div className="budget-details-alert" role="alert"><WarningIcon /><span>{erroAcao}</span>{exigeRecarregamento && <button type="button" onClick={recarregar}>Recarregar dados</button>}</div>}

      {exibirConviteOrdem && (
        <section
          className="budget-next-order"
          aria-labelledby="budget-next-order-title"
        >
          <div className="budget-next-order__icon"><ToolIcon /></div>
          <div className="budget-next-order__content">
            <span>Orçamento aprovado</span>
            <h2 id="budget-next-order-title">Criar ordem de serviço agora?</h2>
            <p>
              Os dados deste orçamento serão aproveitados e o atendimento já
              poderá seguir para execução.
            </p>
          </div>
          <div className="budget-next-order__actions">
            <button
              className="budget-next-order__primary"
              type="button"
              disabled={Boolean(processando)}
              onClick={() => void transformarEmOrdem()}
            >
              {processando === 'CONVERTENDO' ? 'Criando ordem...' : 'Sim, criar ordem'}
            </button>
            <button
              className="budget-next-order__secondary"
              type="button"
              disabled={Boolean(processando)}
              onClick={() => setOcultarConviteOrdem(true)}
            >
              Agora não
            </button>
          </div>
        </section>
      )}

      <section className="budget-details-summary" aria-label="Resumo do orçamento">
        <Summary icon={<CalendarIcon />} label="Criado em" value={formatarDataHora(orcamento.criadoEm)} />
        <Summary icon={<ClockIcon />} label="Validade" value={formatarData(orcamento.validade)} />
        <Summary icon={<ItemsIcon />} label="Itens" value={String(orcamento.itens.length)} />
        <Summary icon={<WalletIcon />} label="Total aprovado" value={formatarMoeda(orcamento.total)} accent />
      </section>

      <div className="budget-details-layout">
        <main className="budget-details-layout__main">
          <DetailsCard icon={<DeviceIcon />} title="Dados da proposta" description="Equipamento e necessidade informados pelo cliente.">
            <dl className="budget-details-fields">
              <Detail label="Equipamento" value={orcamento.equipamento} />
              <Detail label="Problema relatado" value={orcamento.descricaoProblema} wide />
              {orcamento.observacoes && <Detail label="Observações" value={orcamento.observacoes} wide />}
            </dl>
          </DetailsCard>

          <DetailsCard icon={<ItemsIcon />} title="Itens e valores" description="Composição calculada e validada pelo sistema." variant="violet">
            <div className="budget-details-items">
              {orcamento.itens.map(item => (
                <article key={item.id}>
                  <div><span>{TIPO_ITEM_ORCAMENTO_LABELS[item.tipo]}</span><strong>{item.descricao}</strong></div>
                  <div><small>{item.quantidade} × {formatarMoeda(item.valorUnitario)}</small><strong>{formatarMoeda(item.valorTotal)}</strong></div>
                </article>
              ))}
            </div>
            <dl className="budget-details-totals">
              <div><dt>Subtotal</dt><dd>{formatarMoeda(orcamento.subtotal)}</dd></div>
              <div><dt>Desconto</dt><dd>− {formatarMoeda(orcamento.desconto)}</dd></div>
              <div><dt>Total</dt><dd>{formatarMoeda(orcamento.total)}</dd></div>
            </dl>
          </DetailsCard>

        </main>

        <aside className="budget-details-layout__aside">
          <DetailsCard icon={<UserIcon />} title="Cliente" description="Contato vinculado à proposta." compact>
            <div className="budget-details-client">
              <span aria-hidden="true">{obterIniciais(orcamento.cliente.nome)}</span>
              <div><strong>{orcamento.cliente.nome}</strong><a href={`tel:${orcamento.cliente.telefone}`}>{formatarTelefone(orcamento.cliente.telefone)}</a>{orcamento.cliente.email && <a href={`mailto:${orcamento.cliente.email}`}>{orcamento.cliente.email}</a>}</div>
            </div>
          </DetailsCard>

          <DetailsCard icon={<LinkIcon />} title="Aprovação do cliente" description="Link individual desta proposta." variant="green" compact>
            {orcamento.status === 'RASCUNHO' ? (
              <p className="budget-details-link-note">Marque o orçamento como enviado antes de compartilhar o link.</p>
            ) : (
              <div className="budget-details-public-link"><input readOnly value={linkPublico} aria-label="Link público do orçamento" /><button type="button" onClick={() => void copiarLink()}><CopyIcon /> Copiar link</button></div>
            )}
          </DetailsCard>

          {podeCancelar && <button className="budget-details-cancel" type="button" disabled={Boolean(processando)} onClick={() => void alterarStatus('CANCELADO')}>Cancelar orçamento</button>}
        </aside>
      </div>

      {exibirOrientacaoEnvio && (
        <GuidedDialog
          title={
            orcamento.status === 'RASCUNHO'
              ? 'Envie o orçamento para aprovação'
              : 'Compartilhe o link com o cliente'
          }
          description={
            orcamento.status === 'RASCUNHO'
              ? 'A ordem de serviço só poderá ser criada depois que o cliente aprovar este orçamento.'
              : 'O orçamento está pronto. Envie este link para o cliente revisar e aprovar a proposta.'
          }
          onClose={() => setMostrarOrientacaoEnvio(false)}
        >
          {orcamento.status === 'ENVIADO' && (
            <div className="budget-guided-dialog__link">
              <label htmlFor="guided-public-budget-link">Link de aprovação</label>
              <input
                id="guided-public-budget-link"
                readOnly
                value={linkPublico}
                onFocus={event => event.currentTarget.select()}
              />
            </div>
          )}

          {erroAcao && (
            <div className="budget-guided-dialog__alert" role="alert">
              <WarningIcon />
              <span>{erroAcao}</span>
              {exigeRecarregamento && (
                <button type="button" onClick={recarregar}>Recarregar dados</button>
              )}
            </div>
          )}

          <div className="budget-guided-dialog__actions">
            {orcamento.status === 'RASCUNHO' ? (
              <button
                className="budget-guided-dialog__primary"
                type="button"
                autoFocus
                disabled={Boolean(processando)}
                onClick={() => void alterarStatus('ENVIADO')}
              >
                <SendIcon />
                {processando === 'ENVIADO'
                  ? 'Preparando link...'
                  : 'Marcar como enviado'}
              </button>
            ) : (
              <button
                className="budget-guided-dialog__primary"
                type="button"
                autoFocus
                disabled={Boolean(processando)}
                onClick={() => void copiarLink()}
              >
                <CopyIcon /> Copiar link para o cliente
              </button>
            )}
            <button
              className="budget-guided-dialog__secondary"
              type="button"
              disabled={Boolean(processando)}
              onClick={() => setMostrarOrientacaoEnvio(false)}
            >
              Agora não
            </button>
          </div>
        </GuidedDialog>
      )}
      <BudgetDocument orcamento={orcamento} linkPublico={linkPublico} />
    </div>
  )
}

function BudgetDocument({
  orcamento,
  linkPublico,
}: {
  orcamento: Orcamento
  linkPublico: string
}) {
  const enderecoEmpresa = [
    orcamento.empresa.endereco,
    orcamento.empresa.cidade,
    orcamento.empresa.estado,
  ].filter(Boolean).join(' - ')

  return (
    <article className="budget-document" aria-hidden="true">
      <header className="budget-document__header">
        <div>
          <strong>{orcamento.empresa.nome}</strong>
          {orcamento.empresa.cpfCnpj && <span>CPF/CNPJ: {orcamento.empresa.cpfCnpj}</span>}
          {enderecoEmpresa && <span>{enderecoEmpresa}</span>}
          <span>{[orcamento.empresa.telefone, orcamento.empresa.email].filter(Boolean).join(' - ')}</span>
        </div>
        <div>
          <span>ORÇAMENTO</span>
          <strong>{formatarNumeroOrcamento(orcamento.numero)}</strong>
          <time dateTime={orcamento.criadoEm}>{formatarDataHora(orcamento.criadoEm)}</time>
        </div>
      </header>

      <section className="budget-document__grid">
        <DocumentField label="Cliente" value={orcamento.cliente.nome} />
        <DocumentField label="Telefone" value={formatarTelefone(orcamento.cliente.telefone)} />
        <DocumentField label="Equipamento" value={orcamento.equipamento} wide />
        <DocumentField label="Problema informado" value={orcamento.descricaoProblema} wide />
        <DocumentField label="Validade da proposta" value={formatarData(orcamento.validade)} />
        <DocumentField label="Situação" value={STATUS_ORCAMENTO_LABELS[orcamento.status]} />
      </section>

      <section className="budget-document__items">
        <h2>Itens da proposta</h2>
        <table>
          <thead><tr><th>Descrição</th><th>Qtd.</th><th>Unitário</th><th>Total</th></tr></thead>
          <tbody>
            {orcamento.itens.map(item => (
              <tr key={item.id}>
                <td>{item.descricao}</td>
                <td>{item.quantidade}</td>
                <td>{formatarMoeda(item.valorUnitario)}</td>
                <td>{formatarMoeda(item.valorTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="budget-document__totals">
        <p><span>Subtotal</span><strong>{formatarMoeda(orcamento.subtotal)}</strong></p>
        <p><span>Desconto</span><strong>− {formatarMoeda(orcamento.desconto)}</strong></p>
        <p><span>Total estimado</span><strong>{formatarMoeda(orcamento.total)}</strong></p>
      </section>

      <section className="budget-document__analysis-note">
        <h2>Estimativa sujeita à análise técnica</h2>
        <p>
          Os valores correspondem aos itens e condições descritos com base na
          análise disponível na emissão. Se a análise técnica identificar uma
          necessidade diferente, a assistência apresentará um orçamento revisado.
          Nenhum serviço adicional ou alteração de preço será executado ou cobrado
          sem nova concordância do cliente.
        </p>
        <small>Após aprovado, o orçamento obriga as partes, ressalvada a livre negociação posterior, conforme o art. 40 do CDC.</small>
      </section>

      {orcamento.observacoes && (
        <section className="budget-document__observations">
          <h2>Observações</h2>
          <p>{orcamento.observacoes}</p>
        </section>
      )}

      <section className="budget-document__qr">
        <QRCodeSVG
          className="budget-document__qr-code"
          value={linkPublico}
          size={82}
          level="M"
          title="QR Code para revisar o orçamento"
        />
        <div>
          <strong>Revise e responda pelo celular</strong>
          <p>Aponte a câmera para o QR Code e abra o orçamento sem digitar o endereço.</p>
          <small>{linkPublico}</small>
        </div>
      </section>

      <section className="budget-document__signatures">
        <div><span>Cliente/responsável - aprovação e data</span></div>
        <div><span>Responsável pela assistência</span></div>
      </section>
    </article>
  )
}

function DocumentField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'budget-document__field budget-document__field--wide' : 'budget-document__field'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function GuidedDialog({
  title,
  description,
  children,
  onClose,
}: {
  title: string
  description: string
  children: ReactNode
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    dialog.showModal()

    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="budget-guided-dialog"
      aria-labelledby="budget-guided-dialog-title"
      aria-describedby="budget-guided-dialog-description"
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClick={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="budget-guided-dialog__body">
        <div className="budget-guided-dialog__icon"><SendIcon /></div>
        <span className="budget-guided-dialog__eyebrow">Próximo passo</span>
        <h2 id="budget-guided-dialog-title">{title}</h2>
        <p id="budget-guided-dialog-description">{description}</p>
        {children}
      </div>
    </dialog>
  )
}

function DetailsCard({ icon, title, description, children, variant, compact }: { icon: ReactNode; title: string; description: string; children: ReactNode; variant?: 'violet' | 'green'; compact?: boolean }) {
  return <section className={`budget-details-card${variant ? ` budget-details-card--${variant}` : ''}${compact ? ' budget-details-card--compact' : ''}`}><header><div>{icon}</div><span><h2>{title}</h2><p>{description}</p></span></header><div className="budget-details-card__body">{children}</div></section>
}
function Summary({ icon, label, value, accent }: { icon: ReactNode; label: string; value: string; accent?: boolean }) { return <div className={`budget-details-summary__item${accent ? ' budget-details-summary__item--accent' : ''}`}><div>{icon}</div><span><small>{label}</small><strong>{value}</strong></span></div> }
function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? 'budget-details-field--wide' : ''}><dt>{label}</dt><dd>{value}</dd></div> }

function BudgetDetailsFeedback({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) { return <section className="budget-details-feedback" role="alert"><div><WarningIcon /></div><h1>{title}</h1><p>{message}</p><nav><Link to="/orcamentos">Voltar para orçamentos</Link>{onRetry && <button type="button" onClick={onRetry}>Tentar novamente</button>}</nav></section> }
function BudgetDetailsSkeleton() { return <div className="budget-details-skeleton" aria-busy="true"><span className="sr-only">Carregando orçamento</span><div /><div /><section><div /><div /></section></div> }
function montarLinkPublico(token: string) { return `${window.location.origin}/orcamento/${encodeURIComponent(token)}` }
function obterIniciais(nome: string) { return nome.trim().split(/\s+/).slice(0, 2).map(parte => parte[0]?.toUpperCase() ?? '').join('') }
function lerMensagem(state: unknown) { return typeof state === 'object' && state !== null && 'mensagem' in state && typeof state.mensagem === 'string' ? state.mensagem : '' }
function deveOrientarEnvio(state: unknown) { return typeof state === 'object' && state !== null && 'orientarEnvio' in state && state.orientarEnvio === true }

function Icon({ children }: { children: ReactNode }) { return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg> }
function ArrowLeftIcon() { return <Icon><path d="m15 18-6-6 6-6" /></Icon> }
function PencilIcon() { return <Icon><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></Icon> }
function PrintIcon() { return <Icon><path d="M7 9V3h10v6M7 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3" /><path d="M7 14h10v7H7z" /></Icon> }
function SendIcon() { return <Icon><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Icon> }
function ToolIcon() { return <Icon><path d="M14.5 6.5a4 4 0 0 0-5-5l2.1 2.1-3 3L6.5 4.5a4 4 0 0 0 5 5L19 17l2-2-6.5-8.5Z" /></Icon> }
function CheckIcon() { return <Icon><path d="m5 12 4 4L19 6" /></Icon> }
function WarningIcon() { return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon> }
function CalendarIcon() { return <Icon><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Icon> }
function ClockIcon() { return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon> }
function ItemsIcon() { return <Icon><path d="M9 5h10M9 12h10M9 19h10" /><circle cx="5" cy="5" r="1.5" /><circle cx="5" cy="12" r="1.5" /><circle cx="5" cy="19" r="1.5" /></Icon> }
function WalletIcon() { return <Icon><path d="M3 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6Z" /><path d="M15 12h6v4h-6a2 2 0 0 1 0-4Z" /></Icon> }
function DeviceIcon() { return <Icon><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></Icon> }
function UserIcon() { return <Icon><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></Icon> }
function LinkIcon() { return <Icon><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1" /></Icon> }
function CopyIcon() { return <Icon><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></Icon> }
function RefreshIcon() { return <Icon><path d="M20 7v5h-5M4 17v-5h5" /><path d="M7.1 7A7 7 0 0 1 19 10M16.9 17A7 7 0 0 1 5 14" /></Icon> }
