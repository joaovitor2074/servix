import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { QRCodeSVG } from 'qrcode.react'
import PaymentPanel from '../../payments/components/PaymentPanel'
import {
  STATUS_ORDEM_LABELS,
  type HistoricoStatusOrdem,
  type OrdemServico,
  type StatusOrdem,
} from '../../../shared/types/ordem.types'
import {
  buscarCredencialAcessoOrdem,
  buscarOrdem,
  listarHistoricoOrdem,
  OrdemApiError,
} from '../services/orders.service'
import './OrderDetailsPage.css'

interface OrdemCarregada {
  ordemId: number
  ordem: OrdemServico
}

interface HistoricoCarregado {
  ordemId: number
  historico: HistoricoStatusOrdem[]
}

interface FalhaCarregamento {
  ordemId: number
  mensagem: string
  naoEncontrado?: boolean
}

export default function OrderDetailsPage() {
  const { id } = useParams()
  const location = useLocation()
  const ordemId = Number(id)
  const idValido = Number.isInteger(ordemId) && ordemId > 0

  const [ordemCarregada, setOrdemCarregada] =
    useState<OrdemCarregada | null>(null)
  const [historicoCarregado, setHistoricoCarregado] =
    useState<HistoricoCarregado | null>(null)
  const [falhaOrdem, setFalhaOrdem] = useState<FalhaCarregamento | null>(null)
  const [falhaHistorico, setFalhaHistorico] =
    useState<FalhaCarregamento | null>(null)
  const [tentativaOrdem, setTentativaOrdem] = useState(0)
  const [tentativaHistorico, setTentativaHistorico] = useState(0)
  const [estadoCopia, setEstadoCopia] = useState<
    'ocioso' | 'copiado' | 'erro'
  >('ocioso')
  const [mensagemSucesso, setMensagemSucesso] = useState(() =>
    lerMensagemDaNavegacao(location.state),
  )
  const [credencialAcesso, setCredencialAcesso] = useState<string | null>(null)
  const [carregandoCredencial, setCarregandoCredencial] = useState(false)
  const [erroCredencial, setErroCredencial] = useState('')

  useEffect(() => {
    // A listagem pode estar rolada no celular quando o funcionário toca em
    // "ver detalhes". A nova tela sempre começa pelo cabeçalho da ordem.
    window.scrollTo(0, 0)
  }, [ordemId])

  useEffect(() => {
    if (!credencialAcesso) return

    const timeout = window.setTimeout(() => setCredencialAcesso(null), 30_000)
    return () => window.clearTimeout(timeout)
  }, [credencialAcesso])

  useEffect(() => {
    if (!idValido) return

    const controller = new AbortController()

    // A ordem e o histórico possuem estados independentes. Assim um problema
    // apenas na timeline não esconde os demais dados do atendimento.
    void buscarOrdem(ordemId, { signal: controller.signal })
      .then(ordem => {
        setEstadoCopia('ocioso')
        setCredencialAcesso(null)
        setErroCredencial('')
        setOrdemCarregada({ ordemId, ordem })
        setFalhaOrdem(null)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return

        setFalhaOrdem({
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
  }, [idValido, ordemId, tentativaOrdem])

  useEffect(() => {
    if (!idValido) return

    const controller = new AbortController()

    void listarHistoricoOrdem(ordemId, { signal: controller.signal })
      .then(historico => {
        setHistoricoCarregado({ ordemId, historico })
        setFalhaHistorico(null)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return

        setFalhaHistorico({
          ordemId,
          mensagem:
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o histórico',
        })
      })

    return () => controller.abort()
  }, [idValido, ordemId, tentativaHistorico])

  const ordemAtual =
    ordemCarregada?.ordemId === ordemId ? ordemCarregada.ordem : null
  const historicoAtual =
    historicoCarregado?.ordemId === ordemId
      ? historicoCarregado.historico
      : null
  const falhaOrdemAtual =
    falhaOrdem?.ordemId === ordemId ? falhaOrdem : null
  const falhaHistoricoAtual =
    falhaHistorico?.ordemId === ordemId ? falhaHistorico : null

  function tentarCarregarOrdemNovamente() {
    setFalhaOrdem(null)
    setTentativaOrdem(valor => valor + 1)
  }

  function tentarCarregarHistoricoNovamente() {
    setFalhaHistorico(null)
    setTentativaHistorico(valor => valor + 1)
  }

  async function copiarLinkAcompanhamento(link: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
      } else {
        const campoTemporario = document.createElement('textarea')
        campoTemporario.value = link
        campoTemporario.setAttribute('readonly', '')
        campoTemporario.style.position = 'fixed'
        campoTemporario.style.opacity = '0'
        document.body.appendChild(campoTemporario)
        try {
          campoTemporario.select()
          if (!document.execCommand('copy')) {
            throw new Error('Cópia não suportada')
          }
        } finally {
          campoTemporario.remove()
        }
      }

      setEstadoCopia('copiado')
    } catch {
      setEstadoCopia('erro')
    }
  }

  async function revelarCredencial() {
    if (carregandoCredencial) return

    setCarregandoCredencial(true)
    setErroCredencial('')

    try {
      const resultado = await buscarCredencialAcessoOrdem(ordemId)
      setCredencialAcesso(resultado.credencial)
    } catch (error) {
      setErroCredencial(
        error instanceof Error
          ? error.message
          : 'N\u00e3o foi poss\u00edvel acessar a credencial.',
      )
    } finally {
      setCarregandoCredencial(false)
    }
  }

  if (!idValido) {
    return (
      <OrderDetailsFeedback
        title="Ordem inválida"
        message="O endereço informado não possui um identificador de ordem válido."
      />
    )
  }

  if (!ordemAtual && !falhaOrdemAtual) {
    return <OrderDetailsSkeleton />
  }

  if (falhaOrdemAtual) {
    return (
      <OrderDetailsFeedback
        title={
          falhaOrdemAtual.naoEncontrado
            ? 'Ordem não encontrada'
            : 'Não foi possível carregar a ordem'
        }
        message={falhaOrdemAtual.mensagem}
        onRetry={
          falhaOrdemAtual.naoEncontrado
            ? undefined
            : tentarCarregarOrdemNovamente
        }
      />
    )
  }

  if (!ordemAtual) return null

  const linkAcompanhamento = ordemAtual.tokenAcompanhamento
    ? `${window.location.origin}/acompanhar/${encodeURIComponent(
        ordemAtual.tokenAcompanhamento,
      )}`
    : null

  return (
    <div className="order-details-page">
      <header className="order-details-header">
        <div className="order-details-header__main">
          <Link
            className="order-details-header__back"
            to="/ordens"
            aria-label="Voltar para ordens de serviço"
          >
            <ArrowLeftIcon />
          </Link>

          <div className="order-details-header__title">
            <span>Ordens de serviço</span>
            <h1>Ordem #{ordemAtual.numero}</h1>
            <p>
              {ordemAtual.equipamento} · {ordemAtual.cliente.nome}
            </p>
          </div>
        </div>

        <div className="order-details-header__actions">
          <OrderStatusBadge status={ordemAtual.status} />
          <button
            className="order-details-header__print"
            type="button"
            onClick={() => window.print()}
          >
            <PrintIcon />
            Imprimir OS / recibo
          </button>
          <Link
            className="order-details-header__edit"
            to={`/ordens/${ordemAtual.id}/editar`}
          >
            <PencilIcon />
            Atualizar ordem
          </Link>
        </div>
      </header>

      {mensagemSucesso && (
        <div className="order-details-success" role="status">
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

      <section
        className="order-details-summary"
        aria-label="Resumo operacional da ordem"
      >
        <SummaryItem
          icon={<CalendarIcon />}
          label="Entrada"
          value={formatarDataHora(ordemAtual.criadoEm)}
        />
        <SummaryItem
          icon={<RefreshIcon />}
          label="Última atualização"
          value={formatarDataHora(ordemAtual.atualizadoEm)}
        />
        <SummaryItem
          icon={<ClockIcon />}
          label="Previsão de entrega"
          value={
            ordemAtual.previsaoDeEntrega
              ? formatarDataHora(ordemAtual.previsaoDeEntrega)
              : 'Sem previsão'
          }
        />
        <SummaryItem
          icon={<UserCheckIcon />}
          label="Responsável"
          value={ordemAtual.tecnicoResponsavel ?? 'Não atribuído'}
        />
      </section>

      <div className="order-details-layout">
        <div className="order-details-layout__main">
          <DetailsCard
            icon={<DeviceIcon />}
            title="Dados do atendimento"
            description="Equipamento recebido e relato inicial do cliente."
          >
            <dl className="order-details-fields">
              <DetailItem label="Equipamento" value={ordemAtual.equipamento} />
              <DetailItem
                label="Problema relatado"
                value={ordemAtual.problemaRelatado}
                wide
                emphasized
              />
            </dl>
          </DetailsCard>

          <DetailsCard
            icon={<LockIcon />}
            title="Acesso ao aparelho"
            description="Dado sigiloso fornecido para testes autorizados."
            compact
          >
            <div className="order-device-credential">
              {!ordemAtual.possuiCredencialAcesso ? (
                <p>Nenhuma credencial foi cadastrada.</p>
              ) : credencialAcesso ? (
                <>
                  <code>{credencialAcesso}</code>
                  <button type="button" onClick={() => setCredencialAcesso(null)}>
                    Ocultar agora
                  </button>
                  <small>Oculta&ccedil;&atilde;o autom&aacute;tica em 30 segundos.</small>
                </>
              ) : (
                <>
                  <span aria-label="Credencial oculta">••••••••</span>
                  {ordemAtual.podeRevelarCredencial ? (
                    <button
                      type="button"
                      disabled={carregandoCredencial}
                      onClick={() => void revelarCredencial()}
                    >
                      {carregandoCredencial ? 'Acessando...' : 'Mostrar credencial'}
                    </button>
                  ) : (
                    <small>Somente administradores e t&eacute;cnicos podem revelar.</small>
                  )}
                </>
              )}
              {erroCredencial && <p role="alert">{erroCredencial}</p>}
              <small>Nunca &eacute; exibida na impress&atilde;o ou no link do cliente.</small>
            </div>
          </DetailsCard>

          {linkAcompanhamento && (
            <DetailsCard
              icon={<LinkIcon />}
              title="Acompanhamento público"
              description="Link seguro para compartilhar com o cliente."
              variant="violet"
              compact
            >
              <div className="order-details-tracking">
                <label htmlFor="link-acompanhamento">Link do cliente</label>
                <input
                  id="link-acompanhamento"
                  type="text"
                  value={linkAcompanhamento}
                  readOnly
                  onFocus={event => event.currentTarget.select()}
                />
                <div className="order-details-tracking__actions">
                  <a
                    href={linkAcompanhamento}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLinkIcon />
                    Abrir página
                  </a>
                  <button
                    type="button"
                    onClick={() => void copiarLinkAcompanhamento(linkAcompanhamento)}
                  >
                    <CopyIcon />
                    {estadoCopia === 'copiado' ? 'Link copiado' : 'Copiar link'}
                  </button>
                </div>
                <p>
                  Compartilhe apenas com o cliente desta ordem. Quem tiver o
                  link poderá acompanhar o serviço.
                </p>
                {estadoCopia !== 'ocioso' && (
                  <span
                    className={`order-details-tracking__feedback order-details-tracking__feedback--${estadoCopia}`}
                    role="status"
                  >
                    {estadoCopia === 'copiado'
                      ? 'Link copiado para a área de transferência.'
                      : 'Não foi possível copiar. Selecione o link acima manualmente.'}
                  </span>
                )}
              </div>
            </DetailsCard>
          )}

          <DetailsCard
            icon={<ToolIcon />}
            title="Execução do serviço"
            description="Informações preenchidas durante a análise e o reparo."
            variant="violet"
          >
            <div className="order-details-work">
              <TextSection
                label="Diagnóstico"
                value={ordemAtual.diagnostico}
                placeholder="O diagnóstico ainda não foi informado."
              />
              <TextSection
                label="Serviço realizado"
                value={ordemAtual.servicoRealizado}
                placeholder="Nenhum serviço foi registrado até o momento."
              />
              <TextSection
                label="Peças utilizadas"
                value={ordemAtual.pecasUtilizadas}
                placeholder="Nenhuma peça foi registrada."
              />
            </div>
          </DetailsCard>

          <DetailsCard
            icon={<WalletIcon />}
            title="Pagamentos"
            description="Registros financeiros auditáveis desta ordem."
            variant="green"
          >
            <PaymentPanel
              ordem={ordemAtual}
              onChanged={() => setTentativaOrdem(valor => valor + 1)}
            />
          </DetailsCard>

          <DetailsCard
            icon={<HistoryIcon />}
            title="Histórico do atendimento"
            description="Linha do tempo das mudanças de status desta ordem."
            count={historicoAtual?.length}
          >
            <OrderHistory
              historico={historicoAtual}
              error={falhaHistoricoAtual?.mensagem}
              onRetry={tentarCarregarHistoricoNovamente}
            />
          </DetailsCard>
        </div>

        <aside className="order-details-layout__aside">
          <DetailsCard
            icon={<UserIcon />}
            title="Cliente"
            description="Contato vinculado a esta ordem."
            compact
          >
            <div className="order-details-client">
              <div className="order-details-client__avatar" aria-hidden="true">
                {obterIniciais(ordemAtual.cliente.nome)}
              </div>
              <div className="order-details-client__content">
                <strong className="order-details-client__name">
                  {ordemAtual.cliente.nome}
                </strong>
                <a
                  className="order-details-client__phone"
                  href={`tel:${ordemAtual.cliente.telefone}`}
                >
                  {formatarTelefone(ordemAtual.cliente.telefone)}
                </a>
              </div>
            </div>
          </DetailsCard>

          <DetailsCard
            icon={<WalletIcon />}
            title="Orçamento aprovado"
            description="Origem comercial desta ordem de serviço."
            variant="green"
            compact
          >
            <dl className="order-details-side-fields">
              <DetailItem
                label="Total aprovado"
                value={formatarValor(ordemAtual.valor)}
              />
              <DetailItem
                label="Orçamento"
                value={`#${ordemAtual.orcamento.numero}`}
              />
            </dl>
            <Link
              className="order-details-budget-link"
              to={`/orcamentos/${ordemAtual.orcamento.id}`}
            >
              Ver orçamento e itens aprovados
            </Link>
          </DetailsCard>

          <div className="order-details-help">
            <InfoIcon />
            <div>
              <strong>Visão completa do atendimento</strong>
              <p>
                As informações desta página são atualizadas conforme a ordem
                avança no fluxo da empresa.
              </p>
            </div>
          </div>
        </aside>
      </div>
      <ServiceDocument ordem={ordemAtual} linkAcompanhamento={linkAcompanhamento} />
    </div>
  )
}

function ServiceDocument({
  ordem,
  linkAcompanhamento,
}: {
  ordem: OrdemServico
  linkAcompanhamento: string | null
}) {
  const totalPago = Number(ordem.pagamentoResumo?.totalPago ?? 0)
  const possuiPagamento = Number.isFinite(totalPago) && totalPago > 0
  const empresa = ordem.empresa
  const enderecoEmpresa = [empresa?.endereco, empresa?.cidade, empresa?.estado]
    .filter(Boolean)
    .join(' - ')

  return (
    <article className="service-document" aria-hidden="true">
      <header className="service-document__header">
        <div>
          <strong>{empresa?.nome ?? 'Empresa prestadora do servi\u00e7o'}</strong>
          {empresa?.cpfCnpj && <span>CPF/CNPJ: {empresa.cpfCnpj}</span>}
          {enderecoEmpresa && <span>{enderecoEmpresa}</span>}
          {(empresa?.telefone || empresa?.email) && (
            <span>{[empresa.telefone, empresa.email].filter(Boolean).join(' - ')}</span>
          )}
        </div>
        <div>
          <span>ORDEM DE SERVI&Ccedil;O</span>
          <strong>#{ordem.numero}</strong>
          <time dateTime={ordem.criadoEm}>{formatarDataHora(ordem.criadoEm)}</time>
        </div>
      </header>

      <h1>Comprovante de recebimento do equipamento</h1>

      <section className="service-document__grid">
        <DocumentField label="Cliente" value={ordem.cliente.nome} />
        <DocumentField label="Telefone" value={formatarTelefone(ordem.cliente.telefone)} />
        <DocumentField label="Equipamento" value={ordem.equipamento} wide />
        <DocumentField label="Defeito/problema informado" value={ordem.problemaRelatado} wide />
        <DocumentField
          label={'Previs\u00e3o informada'}
          value={ordem.previsaoDeEntrega ? formatarDataHora(ordem.previsaoDeEntrega) : 'A definir'}
        />
        <DocumentField label="Valor aprovado" value={formatarValor(ordem.valor)} />
      </section>

      {linkAcompanhamento && (
        <section className="service-document__tracking">
          <QRCodeSVG
            className="service-document__qr-code"
            value={linkAcompanhamento}
            size={82}
            level="M"
            title="QR Code para acompanhar a ordem"
          />
          <div>
            <h2>Acompanhe seu serviço pelo celular</h2>
            <p>Aponte a câmera para o QR Code e abra o acompanhamento sem digitar o endereço.</p>
            <small>{linkAcompanhamento}</small>
          </div>
        </section>
      )}

      {ordem.orcamento.itens && ordem.orcamento.itens.length > 0 && (
        <section className="service-document__items">
          <h2>Servi&ccedil;os e itens aprovados</h2>
          <table>
            <thead><tr><th>Descri&ccedil;&atilde;o</th><th>Qtd.</th><th>Total</th></tr></thead>
            <tbody>
              {ordem.orcamento.itens.map(item => (
                <tr key={item.id}>
                  <td>{item.descricao}</td>
                  <td>{item.quantidade}</td>
                  <td>{formatarValor(item.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {possuiPagamento && (
        <section className="service-document__payment">
          <h2>Recibo de pagamento</h2>
          <p>
            Recebemos de <strong>{ordem.cliente.nome}</strong> o valor de{' '}
            <strong>{formatarValor(String(totalPago))}</strong>, referente &agrave; ordem
            de servi&ccedil;o #{ordem.numero}. Saldo atual:{' '}
            <strong>{formatarValor(ordem.pagamentoResumo?.saldo ?? '0')}</strong>.
          </p>
        </section>
      )}

      <section className="service-document__terms">
        <h2>Condi&ccedil;&otilde;es e direitos do consumidor</h2>
        <ul>
          <li>O servi&ccedil;o segue o or&ccedil;amento aprovado e qualquer altera&ccedil;&atilde;o depende de nova concord&acirc;ncia do cliente.</li>
          <li>A garantia legal do servi&ccedil;o e os direitos por eventual v&iacute;cio permanecem preservados conforme o CDC.</li>
          <li>O prazo de at&eacute; 30 dias do art. 18, &sect; 1&ordm;, refere-se ao saneamento de v&iacute;cio do produto nas hip&oacute;teses legais; a previs&atilde;o deste atendimento &eacute; a registrada nesta OS.</li>
          <li>Este comprovante n&atilde;o exibe a senha do aparelho e n&atilde;o substitui nota fiscal quando sua emiss&atilde;o for obrigat&oacute;ria.</li>
        </ul>
      </section>

      <section className="service-document__signatures">
        <div><span>Cliente/respons&aacute;vel - entrega</span></div>
        <div><span>Atendente - recebimento</span></div>
      </section>

      <section className="service-document__return">
        <h2>Declara&ccedil;&atilde;o de retirada</h2>
        <p>Declaro que recebi o equipamento, tive oportunidade de conferi-lo e fui informado sobre o servi&ccedil;o realizado, sem ren&uacute;ncia &agrave; garantia legal.</p>
        <div><span>Cliente/respons&aacute;vel - retirada e data</span></div>
      </section>
    </article>
  )
}

function DocumentField({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'service-document__field service-document__field--wide' : 'service-document__field'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

interface DetailsCardProps {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
  variant?: 'violet' | 'green'
  count?: number
  compact?: boolean
}

function DetailsCard({
  icon,
  title,
  description,
  children,
  variant,
  count,
  compact = false,
}: DetailsCardProps) {
  const classes = [
    'order-details-card',
    variant ? `order-details-card--${variant}` : '',
    compact ? 'order-details-card--compact' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className={classes}>
      <header className="order-details-card__header">
        <div className="order-details-card__icon">{icon}</div>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {count !== undefined && (
          <span className="order-details-card__count">{count}</span>
        )}
      </header>
      <div className="order-details-card__body">{children}</div>
    </section>
  )
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="order-details-summary__item">
      <div className="order-details-summary__icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function DetailItem({
  label,
  value,
  wide = false,
  emphasized = false,
}: {
  label: string
  value: string
  wide?: boolean
  emphasized?: boolean
}) {
  return (
    <div
      className={[
        'order-details-field',
        wide ? 'order-details-field--wide' : '',
        emphasized ? 'order-details-field--emphasized' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function TextSection({
  label,
  value,
  placeholder,
}: {
  label: string
  value: string | null
  placeholder: string
}) {
  return (
    <div className="order-details-text-section">
      <h3>{label}</h3>
      <p className={value ? '' : 'order-details-text-section--empty'}>
        {value ?? placeholder}
      </p>
    </div>
  )
}

function OrderHistory({
  historico,
  error,
  onRetry,
}: {
  historico: HistoricoStatusOrdem[] | null
  error?: string
  onRetry: () => void
}) {
  if (error) {
    return (
      <div className="order-history-feedback" role="alert">
        <WarningIcon />
        <div>
          <strong>Não foi possível carregar o histórico</strong>
          <p>{error}</p>
        </div>
        <button type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    )
  }

  if (!historico) {
    return (
      <div className="order-history-loading" aria-busy="true">
        <span className="sr-only">Carregando histórico</span>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} />
        ))}
      </div>
    )
  }

  if (historico.length === 0) {
    return (
      <div className="order-history-empty">
        <HistoryIcon />
        <p>Nenhuma mudança de status foi registrada.</p>
      </div>
    )
  }

  return (
    <ol className="order-history-list">
      {historico.map((item, index) => {
        const atual = index === historico.length - 1

        return (
          <li
            className={[
              'order-history-list__item',
              atual ? 'order-history-list__item--current' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            key={item.id}
          >
            <div className="order-history-list__marker">
              {atual ? <CheckIcon /> : null}
            </div>
            <div className="order-history-list__content">
              <div>
                <strong>{STATUS_ORDEM_LABELS[item.status]}</strong>
                {atual && <span>Status atual</span>}
              </div>
              <time dateTime={item.criadoEm}>
                {formatarDataHora(item.criadoEm)}
              </time>
              <p>{formatarAutorHistorico(item)}</p>
              {item.mensagemPublica && (
                <blockquote className="order-history-list__public-message">
                  <span>Mensagem exibida ao cliente</span>
                  {item.mensagemPublica}
                </blockquote>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function OrderStatusBadge({ status }: { status: StatusOrdem }) {
  return (
    <span
      className={`order-details-status order-details-status--${status.toLowerCase()}`}
    >
      <span aria-hidden="true" />
      {STATUS_ORDEM_LABELS[status]}
    </span>
  )
}

function OrderDetailsFeedback({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry?: () => void
}) {
  return (
    <section className="order-details-feedback" role="alert">
      <div className="order-details-feedback__icon">
        <WarningIcon />
      </div>
      <h1>{title}</h1>
      <p>{message}</p>
      <div className="order-details-feedback__actions">
        <Link className="order-details-feedback__button" to="/ordens">
          Voltar para ordens
        </Link>
        {onRetry && (
          <button
            className="order-details-feedback__button order-details-feedback__button--primary"
            type="button"
            onClick={onRetry}
          >
            Tentar novamente
          </button>
        )}
      </div>
    </section>
  )
}

function OrderDetailsSkeleton() {
  return (
    <div className="order-details-page order-details-skeleton" aria-busy="true">
      <span className="sr-only">Carregando detalhes da ordem</span>
      <div className="order-details-skeleton__header" />
      <div className="order-details-skeleton__summary" />
      <div className="order-details-skeleton__layout">
        <div />
        <div />
        <div />
      </div>
    </div>
  )
}

const formatadorDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const PAPEL_LABELS = {
  ADMIN: 'Administrador',
  ATENDENTE: 'Atendente',
  TECNICO: 'Técnico',
} as const

function formatarDataHora(valor: string) {
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? '—' : formatadorDataHora.format(data)
}

function formatarValor(valor: string) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) return '—'
  return formatadorMoeda.format(numero)
}

function formatarTelefone(telefone: string) {
  if (telefone.length === 11) {
    return telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  if (telefone.length === 10) {
    return telefone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }

  return telefone
}

function obterIniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(parte => parte[0]?.toUpperCase() ?? '')
    .join('')
}

function formatarAutorHistorico(item: HistoricoStatusOrdem) {
  if (!item.alteradoPor) return 'Registro automático do sistema'

  return `${item.alteradoPor.nome} · ${PAPEL_LABELS[item.alteradoPor.papel]}`
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

function PencilIcon() {
  return <Icon><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></Icon>
}

function CalendarIcon() {
  return <Icon><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Icon>
}

function RefreshIcon() {
  return <Icon><path d="M20 7v5h-5M4 17v-5h5" /><path d="M7.1 7A7 7 0 0 1 19 10M16.9 17A7 7 0 0 1 5 14" /></Icon>
}

function ClockIcon() {
  return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>
}

function UserCheckIcon() {
  return <Icon><circle cx="9" cy="8" r="4" /><path d="M2.5 21v-2a6.5 6.5 0 0 1 11-4.7M15 17l2 2 4-5" /></Icon>
}

function DeviceIcon() {
  return <Icon><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></Icon>
}

function ToolIcon() {
  return <Icon><path d="M14.5 6.5a4 4 0 0 0-5-5l2.1 2.1-3 3L6.5 4.5a4 4 0 0 0 5 5L19 17l2-2-6.5-8.5Z" /><path d="m5 14-3 3 3 3 3-3" /></Icon>
}

function HistoryIcon() {
  return <Icon><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></Icon>
}

function UserIcon() {
  return <Icon><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></Icon>
}

function WalletIcon() {
  return <Icon><path d="M3 6h15a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6Z" /><path d="M3 6V5a2 2 0 0 1 2-2h12M15 12h6v4h-6a2 2 0 0 1 0-4Z" /></Icon>
}

function InfoIcon() {
  return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></Icon>
}

function WarningIcon() {
  return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon>
}

function CheckIcon() {
  return <Icon><path d="m5 12 4 4L19 6" /></Icon>
}

function LinkIcon() {
  return <Icon><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1" /></Icon>
}

function ExternalLinkIcon() {
  return <Icon><path d="M15 3h6v6M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></Icon>
}

function CopyIcon() {
  return <Icon><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" /></Icon>
}

function PrintIcon() {
  return <Icon><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" /></Icon>
}

function LockIcon() {
  return <Icon><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>
}
