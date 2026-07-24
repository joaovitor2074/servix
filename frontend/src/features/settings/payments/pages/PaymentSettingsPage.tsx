import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router'
import {
  atualizarConfiguracaoPagamento,
  buscarConfiguracaoPagamento,
  ConflitoConfiguracaoPagamentoError,
  desconectarMercadoPago,
  iniciarOAuthMercadoPago,
} from '../services/payment-settings.service'
import type {
  AtualizarConfiguracaoPagamentoInput,
  ConfiguracaoPagamento,
  IntegracaoMercadoPago,
  ProvedorPagamentoDisponivel,
  ProvedorPagamento,
} from '../types/payment-settings.types'
import './PaymentSettingsPage.css'

interface ProvedorOpcao {
  id: ProvedorPagamento
  nome: string
  descricao: string
  destaque: string
  icon: ReactNode
}

const MERCADO_PAGO_DOCUMENTATION_URL =
  'https://www.mercadopago.com.br/developers/pt/docs/overview'

const PROVEDORES: ProvedorOpcao[] = [
  {
    id: 'MANUAL',
    nome: 'Pagamento manual',
    descricao: 'A equipe registra na ordem os valores recebidos fora do Servix.',
    destaque: 'Disponível',
    icon: <ManualIcon />,
  },
  {
    id: 'SIMULADO',
    nome: 'Gateway simulado',
    descricao: 'Teste cobranças e confirmações sem movimentar dinheiro de verdade.',
    destaque: 'Ambiente seguro',
    icon: <SimulationIcon />,
  },
  {
    id: 'MERCADO_PAGO',
    nome: 'Mercado Pago',
    descricao: 'Conexão via conta da empresa para cobranças Pix automáticas.',
    destaque: 'Pronto para teste',
    icon: <WalletIcon />,
  },
  {
    id: 'ASAAS',
    nome: 'Asaas',
    descricao: 'Integração para gerar cobranças e acompanhar pagamentos.',
    destaque: 'Em breve',
    icon: <BankIcon />,
  },
]

export default function PaymentSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const retornoOAuth = obterRetornoOAuth(searchParams)
  const [configuracao, setConfiguracao] =
    useState<ConfiguracaoPagamento | null>(null)
  const [rascunho, setRascunho] =
    useState<AtualizarConfiguracaoPagamentoInput | null>(null)
  const [provedoresDisponiveis, setProvedoresDisponiveis] = useState<
    ProvedorPagamentoDisponivel[]
  >([])
  const [integracaoMercadoPago, setIntegracaoMercadoPago] =
    useState<IntegracaoMercadoPago | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [processandoIntegracao, setProcessandoIntegracao] = useState<
    'CONECTAR' | 'DESCONECTAR' | null
  >(null)
  const [erroCarregamento, setErroCarregamento] = useState('')
  const [erroSalvamento, setErroSalvamento] = useState('')
  const [erroIntegracao, setErroIntegracao] = useState(() =>
    retornoOAuth.resultado === 'erro'
      ? obterMensagemRetornoOAuth(retornoOAuth.codigo)
      : '',
  )
  const [conflito, setConflito] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState(() =>
    retornoOAuth.resultado === 'conectado'
      ? 'Conta do Mercado Pago conectada com segurança a esta empresa.'
      : '',
  )
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    const resultado = searchParams.get('mercadoPago')
    if (resultado !== 'conectado' && resultado !== 'erro') return

    const parametrosAtualizados = new URLSearchParams(searchParams)
    parametrosAtualizados.delete('mercadoPago')
    parametrosAtualizados.delete('codigo')
    setSearchParams(parametrosAtualizados, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const controller = new AbortController()

    void buscarConfiguracaoPagamento({ signal: controller.signal })
      .then(resultado => {
        setConfiguracao(resultado.configuracao)
        setRascunho(criarRascunho(
          resultado.configuracao,
          resultado.integracaoMercadoPago,
        ))
        setProvedoresDisponiveis(resultado.provedoresDisponiveis)
        setIntegracaoMercadoPago(resultado.integracaoMercadoPago)
        setErroCarregamento('')
        setConflito(false)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErroCarregamento(obterMensagemErro(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false)
      })

    return () => controller.abort()
  }, [tentativa])

  const possuiAlteracoes = useMemo(() => {
    if (!configuracao || !rascunho) return false

    return (
      configuracao.provedor !== rascunho.provedor ||
      configuracao.ambiente !== rascunho.ambiente ||
      configuracao.ativo !== rascunho.ativo ||
      configuracao.pixHabilitado !== rascunho.pixHabilitado
    )
  }, [configuracao, rascunho])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!rascunho || salvando || !possuiAlteracoes) return

    setSalvando(true)
    setErroSalvamento('')
    setMensagemSucesso('')

    try {
      const dadosEnvio =
        rascunho.provedor === 'MERCADO_PAGO' &&
        integracaoMercadoPago?.liveMode
          ? { ...rascunho, ativo: false, pixHabilitado: false }
          : rascunho
      const resultado = await atualizarConfiguracaoPagamento(dadosEnvio)
      setConfiguracao(resultado.configuracao)
      setRascunho(criarRascunho(
        resultado.configuracao,
        resultado.integracaoMercadoPago,
      ))
      setProvedoresDisponiveis(resultado.provedoresDisponiveis)
      setIntegracaoMercadoPago(resultado.integracaoMercadoPago)
      setMensagemSucesso('Configurações de pagamento salvas com sucesso.')
    } catch (error) {
      setConflito(error instanceof ConflitoConfiguracaoPagamentoError)
      setErroSalvamento(obterMensagemErro(error))
    } finally {
      setSalvando(false)
    }
  }

  function tentarNovamente() {
    setCarregando(true)
    setErroCarregamento('')
    setErroSalvamento('')
    setConflito(false)
    setTentativa(valor => valor + 1)
  }

  async function conectarMercadoPago() {
    if (
      !integracaoMercadoPago?.oauthDisponivel ||
      processandoIntegracao
    ) {
      return
    }

    setProcessandoIntegracao('CONECTAR')
    setErroIntegracao('')
    setMensagemSucesso('')

    try {
      const { authorizationUrl } = await iniciarOAuthMercadoPago()
      window.location.assign(authorizationUrl)
    } catch (error) {
      setErroIntegracao(obterMensagemErro(error))
      setProcessandoIntegracao(null)
    }
  }

  async function removerConexaoMercadoPago() {
    if (
      integracaoMercadoPago?.origem !== 'OAUTH' ||
      processandoIntegracao
    ) {
      return
    }

    const confirmado = window.confirm(
      'Desconectar o Mercado Pago desta empresa? Novas cobranças automáticas ficarão indisponíveis até uma nova conexão.',
    )
    if (!confirmado) return

    setProcessandoIntegracao('DESCONECTAR')
    setErroIntegracao('')
    setMensagemSucesso('')

    try {
      await desconectarMercadoPago()
      setIntegracaoMercadoPago(atual => atual && ({
        ...atual,
        conectado: false,
        status: 'DESCONECTADA',
        mercadoPagoUserId: undefined,
        conectadoEm: undefined,
        tokenExpiraEm: undefined,
        origem: null,
        liveMode: false,
      }))
      setMensagemSucesso('Conta do Mercado Pago desconectada desta empresa.')
      setTentativa(valor => valor + 1)
    } catch (error) {
      setErroIntegracao(obterMensagemErro(error))
    } finally {
      setProcessandoIntegracao(null)
    }
  }

  function selecionarProvedor(provedor: ProvedorPagamento) {
    setMensagemSucesso('')
    setErroSalvamento('')
    const ambientes = obterAmbientesProvedor(provedor, provedoresDisponiveis)
    setRascunho(atual => {
      if (!atual) return atual

      return {
        ...atual,
        provedor,
        pixHabilitado:
          provedor === 'MANUAL' ||
          (provedor === 'MERCADO_PAGO' && integracaoMercadoPago?.liveMode)
            ? false
            : atual.pixHabilitado,
        ambiente: ambientes.includes(atual.ambiente)
          ? atual.ambiente
          : ambientes[0] ?? 'TESTE',
      }
    })
  }

  function alterarOpcao(
    campo: 'ativo' | 'pixHabilitado',
    valor: boolean,
  ) {
    if (
      campo === 'pixHabilitado' &&
      rascunho?.provedor === 'MERCADO_PAGO' &&
      integracaoMercadoPago?.liveMode
    ) {
      return
    }

    setMensagemSucesso('')
    setErroSalvamento('')
    setRascunho(atual => (atual ? { ...atual, [campo]: valor } : atual))
  }

  if (carregando) return <PaymentSettingsSkeleton />

  if (
    erroCarregamento ||
    !configuracao ||
    !rascunho ||
    !integracaoMercadoPago
  ) {
    return (
      <section className="payment-settings-feedback" role="alert">
        <span className="payment-settings-feedback__icon">
          <WarningIcon />
        </span>
        <h1>Não foi possível carregar os pagamentos</h1>
        <p>{erroCarregamento || 'A configuração recebida é inválida.'}</p>
        <button type="button" onClick={tentarNovamente}>
          Tentar novamente
        </button>
      </section>
    )
  }

  const modoSimulado = rascunho.provedor === 'SIMULADO'
  const modoManual = rascunho.provedor === 'MANUAL'
  const modoMercadoPago = rascunho.provedor === 'MERCADO_PAGO'
  const provedorSelecionadoDisponivel =
    provedoresDisponiveis.find(
      item => item.provedor === rascunho.provedor,
    )?.disponivel === true &&
    (!modoMercadoPago || integracaoMercadoPago.conectado)
  const mercadoPagoEmModoReal = integracaoMercadoPago.liveMode === true
  const ambientesSelecionados = obterAmbientesProvedor(
    rascunho.provedor,
    provedoresDisponiveis,
  )

  return (
    <div className="payment-settings">
      <header className="payment-settings__header">
        <div>
          <span className="payment-settings__eyebrow">Configurações</span>
          <h1>Pagamentos</h1>
          <p>
            Escolha como sua empresa registra cobranças e deixe a estrutura
            preparada para os próximos gateways.
          </p>
        </div>

        <StatusPill
          ativo={configuracao.ativo && !(
            configuracao.provedor === 'MERCADO_PAGO' &&
            mercadoPagoEmModoReal
          )}
          status={configuracao.status}
        />
      </header>

      <div
        className={`payment-settings-notice${
          mercadoPagoEmModoReal ? ' payment-settings-notice--warning' : ''
        }`}
        role="note"
      >
        <span className="payment-settings-notice__icon">
          <ShieldIcon />
        </span>
        <div>
          <strong>{obterTituloAvisoMercadoPago(integracaoMercadoPago)}</strong>
          <p>{obterDescricaoAvisoMercadoPago(integracaoMercadoPago)}</p>
        </div>
      </div>

      {mensagemSucesso && (
        <div className="payment-settings-success" role="status">
          <CheckIcon />
          <span>{mensagemSucesso}</span>
          <button
            type="button"
            aria-label="Fechar mensagem"
            onClick={() => setMensagemSucesso('')}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      <form className="payment-settings-form" onSubmit={handleSubmit}>
        <section className="payment-settings-card">
          <div className="payment-settings-card__header">
            <span>1</span>
            <div>
              <h2>Escolha o provedor</h2>
              <p>
                O pagamento manual continua disponível enquanto as conexões
                com gateways reais não forem ativadas.
              </p>
            </div>
          </div>

          <fieldset
            className="payment-provider-grid"
            disabled={salvando}
          >
            <legend className="sr-only">Provedor de pagamento</legend>

            {PROVEDORES.map(provedor => {
              const disponibilidade = provedoresDisponiveis.find(
                item => item.provedor === provedor.id,
              )
              const disponivel =
                disponibilidade?.disponivel === true &&
                (provedor.id !== 'MERCADO_PAGO' ||
                  integracaoMercadoPago.conectado)

              return (
                <label
                  className={`payment-provider${
                    rascunho.provedor === provedor.id
                      ? ' payment-provider--selected'
                      : ''
                  }${
                    !disponivel ? ' payment-provider--disabled' : ''
                  }`}
                  key={provedor.id}
                >
                  <input
                    type="radio"
                    name="provedor"
                    value={provedor.id}
                    checked={rascunho.provedor === provedor.id}
                    disabled={!disponivel || salvando}
                    onChange={() => selecionarProvedor(provedor.id)}
                  />
                  <span className="payment-provider__select" aria-hidden="true" />
                  <span className="payment-provider__icon">{provedor.icon}</span>
                  <span className="payment-provider__copy">
                    <span className="payment-provider__title">
                      <strong>{provedor.nome}</strong>
                      <small>
                        {obterRotuloDisponibilidade(
                          provedor,
                          disponibilidade,
                          integracaoMercadoPago,
                        )}
                      </small>
                    </span>
                    <span>{provedor.descricao}</span>
                    {!disponivel && (
                      <span className="payment-provider__reason">
                        {obterMotivoIndisponibilidade(
                          provedor.id,
                          disponibilidade,
                          integracaoMercadoPago,
                        )}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}

            <div className="payment-provider-documentation" role="note">
              <span className="payment-provider-documentation__icon">
                <BookIcon />
              </span>
              <div>
                <strong>Integração com o Mercado Pago</strong>
                <p>
                  A conexão utiliza OAuth para autorizar cada empresa sem
                  revelar o Access Token. Consulte o guia oficial para revisar
                  a aplicação e suas permissões.
                </p>
              </div>
              <a
                href={MERCADO_PAGO_DOCUMENTATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir documentação oficial do Mercado Pago em uma nova aba"
              >
                Abrir documentação
                <ExternalLinkIcon />
              </a>
              <div
                className={`payment-provider-documentation__status payment-provider-documentation__status--${obterTomConfiguracaoMercadoPago(integracaoMercadoPago)}`}
                role="status"
              >
                <span aria-hidden="true" />
                <div>
                  <strong>Aplicativo OAuth</strong>
                  <p>{obterDescricaoConfiguracaoMercadoPago(integracaoMercadoPago)}</p>
                </div>
                <small>{obterRotuloConfiguracaoMercadoPago(integracaoMercadoPago)}</small>
              </div>
            </div>
          </fieldset>

          <MercadoPagoConnectionCard
            integracao={integracaoMercadoPago}
            erro={erroIntegracao}
            processando={processandoIntegracao}
            onConnect={() => void conectarMercadoPago()}
            onDisconnect={() => void removerConexaoMercadoPago()}
            onDismissError={() => setErroIntegracao('')}
          />
        </section>

        <section className="payment-settings-card">
          <div className="payment-settings-card__header">
            <span>2</span>
            <div>
              <h2>Defina o funcionamento</h2>
              <p>
                Estas opções controlam o Pix exibido ao cliente no link público
                do orçamento.
              </p>
            </div>
          </div>

          <div className="payment-options">
            <SwitchField
              checked={rascunho.ativo}
              disabled={salvando || !provedorSelecionadoDisponivel}
              label="Ativar este provedor"
              description={
                modoManual
                  ? 'Mantém o registro manual disponível nas ordens de serviço.'
                  : 'Permite utilizar o provedor nos testes de cobrança.'
              }
              onChange={valor => alterarOpcao('ativo', valor)}
            />

            <SwitchField
              checked={rascunho.pixHabilitado}
              disabled={
                salvando ||
                !provedorSelecionadoDisponivel ||
                !rascunho.ativo ||
                modoManual ||
                (modoMercadoPago && mercadoPagoEmModoReal)
              }
              label={modoSimulado ? 'Habilitar Pix simulado' : 'Habilitar Pix'}
              description={
                modoSimulado
                  ? 'Cria somente dados de teste; nenhum QR Code poderá ser pago.'
                  : modoMercadoPago && mercadoPagoEmModoReal
                    ? 'A conta está conectada, mas cobranças reais permanecem bloqueadas nesta etapa.'
                  : modoMercadoPago
                    ? 'Gera uma cobrança Pix de teste pelo Mercado Pago quando o orçamento for aprovado.'
                  : 'Para gerar código no link público, selecione um gateway. O Pix manual continua disponível na OS.'
              }
              onChange={valor => alterarOpcao('pixHabilitado', valor)}
            />
          </div>

          <fieldset className="payment-environment" disabled={salvando}>
            <legend className="sr-only">Ambiente da integração</legend>
            <div>
              <strong>Ambiente</strong>
              <span>
                {modoMercadoPago
                  ? 'A conexão pode ser validada, mas a geração de cobranças em produção permanece bloqueada nesta etapa.'
                  : 'O gateway simulado funciona somente em teste. No modo manual, produção apenas identifica registros reais feitos pela equipe.'}
              </span>
            </div>
            <div className="payment-environment__options">
              {(['TESTE', 'PRODUCAO'] as const).map(ambiente => {
                const habilitado = ambientesSelecionados.includes(ambiente)
                return (
                  <label key={ambiente}>
                    <input
                      type="radio"
                      name="ambiente"
                      value={ambiente}
                      checked={rascunho.ambiente === ambiente}
                      disabled={!habilitado || salvando}
                      onChange={() =>
                        setRascunho(atual =>
                          atual ? { ...atual, ambiente } : atual,
                        )
                      }
                    />
                    {ambiente === 'TESTE' && <FlaskIcon />}
                    {ambiente === 'TESTE' ? 'Teste' : 'Produção'}
                  </label>
                )
              })}
            </div>
          </fieldset>
        </section>

        <aside className="payment-settings-summary" aria-label="Resumo da configuração">
          <div>
            <span>Configuração atual</span>
            <strong>{obterNomeProvedor(rascunho.provedor)}</strong>
            <small>
              {rascunho.ativo ? 'Ativo' : 'Inativo'} · Pix{' '}
              {rascunho.pixHabilitado ? 'habilitado' : 'desabilitado'}
            </small>
          </div>

          {configuracao.atualizadoEm && (
            <span className="payment-settings-summary__updated">
              Última atualização {formatarData(configuracao.atualizadoEm)}
            </span>
          )}

          <div className="payment-settings-summary__actions">
            {possuiAlteracoes && (
              <button
                className="payment-settings-summary__cancel"
                type="button"
                disabled={salvando}
                onClick={() => {
                  setRascunho(criarRascunho(
                    configuracao,
                    integracaoMercadoPago,
                  ))
                  setErroSalvamento('')
                }}
              >
                Descartar
              </button>
            )}
            <button
              className="payment-settings-summary__save"
              type="submit"
              disabled={salvando || !possuiAlteracoes}
            >
              {salvando ? <LoadingIcon /> : <SaveIcon />}
              {salvando ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        </aside>

        {erroSalvamento && (
          <div className="payment-settings-error" role="alert">
            <WarningIcon />
            <span>{erroSalvamento}</span>
            {conflito && (
              <button type="button" onClick={tentarNovamente}>
                Recarregar dados
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  )
}

function MercadoPagoConnectionCard({
  integracao,
  erro,
  processando,
  onConnect,
  onDisconnect,
  onDismissError,
}: {
  integracao: IntegracaoMercadoPago
  erro: string
  processando: 'CONECTAR' | 'DESCONECTAR' | null
  onConnect: () => void
  onDisconnect: () => void
  onDismissError: () => void
}) {
  const conexaoOAuth = integracao.origem === 'OAUTH'
  const deveReconectar =
    conexaoOAuth ||
    integracao.status === 'EXPIRADA' ||
    integracao.status === 'ERRO'
  const tom = obterTomIntegracaoMercadoPago(integracao)

  return (
    <section
      className={`mercado-pago-connection mercado-pago-connection--${tom}`}
      aria-labelledby="mercado-pago-connection-title"
    >
      <header className="mercado-pago-connection__header">
        <span className="mercado-pago-connection__icon" aria-hidden="true">
          <WalletIcon />
        </span>
        <div>
          <span>Conta da empresa</span>
          <h3 id="mercado-pago-connection-title">Mercado Pago</h3>
          <p>{obterDescricaoIntegracaoMercadoPago(integracao)}</p>
        </div>
        <span className="mercado-pago-connection__status">
          <i aria-hidden="true" />
          {obterRotuloIntegracaoMercadoPago(integracao)}
        </span>
      </header>

      {integracao.liveMode && (
        <div className="mercado-pago-connection__live-warning" role="note">
          <WarningIcon />
          <span>
            Autorização de produção reconhecida e bloqueada. Os tokens não
            foram armazenados e o Pix não pode ser ativado. Qualquer teste real
            só pode ser feito pelo titular adulto ou responsável da conta.
          </span>
        </div>
      )}

      {(integracao.conectado || integracao.liveMode) && (
        <dl className="mercado-pago-connection__details">
          <div>
            <dt>Conta autorizada</dt>
            <dd>{integracao.mercadoPagoUserId || 'Identificada pelo Mercado Pago'}</dd>
          </div>
          <div>
            <dt>Conectada em</dt>
            <dd>
              {integracao.conectadoEm
                ? formatarData(integracao.conectadoEm)
                : 'Data não informada'}
            </dd>
          </div>
          <div>
            <dt>Origem</dt>
            <dd>
              OAuth da empresa
            </dd>
          </div>
          {!integracao.liveMode && integracao.tokenExpiraEm && (
            <div>
              <dt>Token válido até</dt>
              <dd>{formatarData(integracao.tokenExpiraEm)}</dd>
            </div>
          )}
        </dl>
      )}

      {erro && (
        <div className="mercado-pago-connection__error" role="alert">
          <WarningIcon />
          <span>{erro}</span>
          <button
            type="button"
            aria-label="Fechar erro da conexão"
            onClick={onDismissError}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      <div className="mercado-pago-connection__footer">
        <p>
          <ShieldIcon />
          {integracao.liveMode
            ? 'O navegador recebe apenas o status. Tokens de produção não são armazenados.'
            : 'O navegador recebe apenas o status da conexão. Os tokens permanecem criptografados no servidor.'}
        </p>

        <div className="mercado-pago-connection__actions">
          {integracao.oauthDisponivel && (
            <button
              className={`mercado-pago-connection__connect${
                processando === 'CONECTAR' ? ' is-loading' : ''
              }`}
              type="button"
              disabled={processando !== null}
              onClick={onConnect}
            >
              {processando === 'CONECTAR' ? (
                <LoadingIcon />
              ) : (
                <ExternalLinkIcon />
              )}
              {processando === 'CONECTAR'
                ? 'Abrindo Mercado Pago...'
                : deveReconectar
                  ? 'Reconectar'
                  : 'Conectar Mercado Pago'}
            </button>
          )}

          {conexaoOAuth && (
            <button
              className={`mercado-pago-connection__disconnect${
                processando === 'DESCONECTAR' ? ' is-loading' : ''
              }`}
              type="button"
              disabled={processando !== null}
              onClick={onDisconnect}
            >
              {processando === 'DESCONECTAR' ? (
                <LoadingIcon />
              ) : (
                <UnlinkIcon />
              )}
              {processando === 'DESCONECTAR'
                ? 'Desconectando...'
                : 'Desconectar'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function SwitchField({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  label: string
  description: string
  onChange: (valor: boolean) => void
}) {
  return (
    <label className={`payment-switch${disabled ? ' payment-switch--disabled' : ''}`}>
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={event => onChange(event.target.checked)}
      />
      <span className="payment-switch__control" aria-hidden="true" />
    </label>
  )
}

function StatusPill({ ativo, status }: { ativo: boolean; status: string }) {
  const possuiErro = status.toUpperCase() === 'ERRO'
  const tone = possuiErro ? 'error' : ativo ? 'active' : 'inactive'
  const label = possuiErro ? 'Requer atenção' : ativo ? 'Ativo' : 'Inativo'

  return (
    <span className={`payment-settings-status payment-settings-status--${tone}`}>
      <span aria-hidden="true" />
      {label}
    </span>
  )
}

function PaymentSettingsSkeleton() {
  return (
    <div className="payment-settings payment-settings--loading" aria-busy="true">
      <span className="sr-only">Carregando configurações de pagamento</span>
      <div className="payment-settings-skeleton payment-settings-skeleton--header" />
      <div className="payment-settings-skeleton payment-settings-skeleton--notice" />
      <div className="payment-settings-skeleton payment-settings-skeleton--card" />
      <div className="payment-settings-skeleton payment-settings-skeleton--card" />
    </div>
  )
}

function criarRascunho(
  configuracao: ConfiguracaoPagamento,
  integracaoMercadoPago?: IntegracaoMercadoPago | null,
): AtualizarConfiguracaoPagamentoInput {
  return {
    versaoEsperada: configuracao.versao,
    provedor: configuracao.provedor,
    ambiente: configuracao.ambiente,
    ativo:
      configuracao.provedor === 'MERCADO_PAGO' &&
      integracaoMercadoPago?.liveMode
        ? false
        : configuracao.ativo,
    pixHabilitado:
      configuracao.provedor === 'MANUAL' ||
      (configuracao.provedor === 'MERCADO_PAGO' &&
        integracaoMercadoPago?.liveMode)
        ? false
        : configuracao.pixHabilitado,
  }
}

function obterAmbientesProvedor(
  provedor: ProvedorPagamento,
  provedores: ProvedorPagamentoDisponivel[],
) {
  return provedores.find(item => item.provedor === provedor)?.ambientes ?? [
    'TESTE',
  ]
}

function obterNomeProvedor(provedor: ProvedorPagamento) {
  return PROVEDORES.find(item => item.id === provedor)?.nome ?? provedor
}

function obterRotuloDisponibilidade(
  provedor: ProvedorOpcao,
  disponibilidade?: ProvedorPagamentoDisponivel,
  integracaoMercadoPago?: IntegracaoMercadoPago,
) {
  if (provedor.id === 'MERCADO_PAGO') {
    if (integracaoMercadoPago?.conectado) {
      return 'Conta conectada'
    }

    if (
      integracaoMercadoPago?.status === 'EXPIRADA' ||
      integracaoMercadoPago?.status === 'ERRO'
    ) {
      return 'Reconectar'
    }

    if (integracaoMercadoPago?.oauthDisponivel) return 'Conectar conta'
  }

  if (disponibilidade?.disponivel) return provedor.destaque

  if (disponibilidade?.configuracaoServidor === 'ERRO') {
    return 'Requer atenção'
  }

  return provedor.id === 'ASAAS' ? 'Em breve' : 'Indisponível'
}

function obterMotivoIndisponibilidade(
  provedor: ProvedorPagamento,
  disponibilidade: ProvedorPagamentoDisponivel | undefined,
  integracaoMercadoPago: IntegracaoMercadoPago,
) {
  if (provedor !== 'MERCADO_PAGO') {
    return disponibilidade?.motivoIndisponibilidade ||
      'Este provedor ainda não está disponível.'
  }

  if (integracaoMercadoPago.liveMode) {
    return 'A conta está conectada, mas cobranças reais permanecem bloqueadas.'
  }

  if (integracaoMercadoPago.conectado) {
    return disponibilidade?.motivoIndisponibilidade ||
      'A conexão está válida, mas o provedor ainda não foi liberado.'
  }

  if (
    integracaoMercadoPago.status === 'EXPIRADA' ||
    integracaoMercadoPago.status === 'ERRO'
  ) {
    return 'Reconecte a conta para voltar a usar o Mercado Pago.'
  }

  if (integracaoMercadoPago.oauthDisponivel) {
    return 'Conecte a conta da empresa para liberar este provedor.'
  }

  return integracaoMercadoPago.motivoIndisponibilidade ||
    disponibilidade?.motivoIndisponibilidade ||
    'A conexão OAuth ainda não está disponível.'
}

function obterTomConfiguracaoMercadoPago(
  integracao: IntegracaoMercadoPago,
) {
  if (integracao.status === 'ERRO') return 'error'
  if (integracao.oauthDisponivel) {
    return 'ready'
  }
  return 'waiting'
}

function obterRotuloConfiguracaoMercadoPago(
  integracao: IntegracaoMercadoPago,
) {
  if (integracao.oauthDisponivel) return 'OAuth pronto'
  return integracao.status === 'ERRO' ? 'Erro' : 'Indisponível'
}

function obterDescricaoConfiguracaoMercadoPago(
  integracao: IntegracaoMercadoPago,
) {
  if (integracao.oauthDisponivel) {
    return 'O servidor está pronto para iniciar uma autorização individual por empresa.'
  }
  return integracao.motivoIndisponibilidade ||
    'A aplicação OAuth ainda não foi configurada no servidor.'
}

function obterTituloAvisoMercadoPago(integracao: IntegracaoMercadoPago) {
  if (integracao.liveMode) {
    return 'Autorização de produção bloqueada'
  }
  if (integracao.conectado) {
    return 'Conta Mercado Pago desta empresa conectada'
  }
  if (integracao.oauthDisponivel) return 'Cada empresa conecta a própria conta'
  return 'Conexão OAuth indisponível no momento'
}

function obterDescricaoAvisoMercadoPago(integracao: IntegracaoMercadoPago) {
  if (integracao.liveMode) {
    return 'A autorização foi reconhecida, mas o Pix do Mercado Pago não pode ser ativado enquanto o backend mantiver a produção bloqueada. Qualquer teste real só pode ser feito pelo titular adulto ou responsável da conta.'
  }
  if (integracao.conectado) {
    return 'A autorização pertence somente a esta empresa. Os tokens ficam criptografados no backend e nunca são enviados ao navegador.'
  }
  if (integracao.oauthDisponivel) {
    return 'O administrador autoriza o Servix no Mercado Pago. Depois disso, somente esta empresa poderá usar a conexão criada.'
  }
  return `${integracao.motivoIndisponibilidade ||
    'A aplicação do Mercado Pago ainda não está pronta no servidor.'} Nenhuma credencial deve ser informada nesta tela.`
}

function obterTomIntegracaoMercadoPago(integracao: IntegracaoMercadoPago) {
  if (
    integracao.liveMode ||
    integracao.status === 'BLOQUEADA' ||
    integracao.status === 'EXPIRADA'
  ) return 'warning'
  if (integracao.status === 'ERRO') return 'error'
  return integracao.conectado ? 'connected' : 'disconnected'
}

function obterRotuloIntegracaoMercadoPago(integracao: IntegracaoMercadoPago) {
  if (integracao.status === 'EXPIRADA') return 'Expirada'
  if (integracao.status === 'ERRO') return 'Requer atenção'
  if (integracao.status === 'BLOQUEADA') return 'Produção bloqueada'
  if (integracao.conectado) {
    return 'Conectada'
  }
  return 'Desconectada'
}

function obterDescricaoIntegracaoMercadoPago(
  integracao: IntegracaoMercadoPago,
) {
  if (integracao.liveMode) {
    return 'A conta foi autorizada, mas a movimentação real continua bloqueada.'
  }
  if (integracao.status === 'EXPIRADA') {
    return 'A autorização expirou. Reconecte a conta para continuar.'
  }
  if (integracao.status === 'ERRO') {
    return integracao.motivoIndisponibilidade ||
      'A conexão precisa ser refeita antes de gerar cobranças.'
  }
  if (integracao.conectado) {
    return 'Esta autorização será usada somente nas cobranças desta empresa.'
  }
  if (integracao.oauthDisponivel) {
    return 'Autorize o Servix a criar e acompanhar cobranças em nome desta empresa.'
  }
  return integracao.motivoIndisponibilidade ||
    'A conexão ainda não pode ser iniciada.'
}

function obterRetornoOAuth(parametros: URLSearchParams): {
  resultado: 'conectado' | 'erro' | null
  codigo: string | null
} {
  const resultado = parametros.get('mercadoPago')

  return {
    resultado:
      resultado === 'conectado' || resultado === 'erro' ? resultado : null,
    codigo: parametros.get('codigo'),
  }
}

function obterMensagemRetornoOAuth(codigo: string | null) {
  const codigoNormalizado = codigo?.trim().toLowerCase()

  if (
    codigoNormalizado === 'access_denied' ||
    codigoNormalizado === 'acesso_negado' ||
    codigoNormalizado === 'autorizacao_negada' ||
    codigoNormalizado === 'authorization_denied'
  ) {
    return 'A autorização foi cancelada no Mercado Pago. Nenhuma conexão foi criada.'
  }
  if (
    codigoNormalizado === 'invalid_state' ||
    codigoNormalizado === 'state_invalido'
  ) {
    return 'A autorização perdeu a validade por segurança. Inicie a conexão novamente.'
  }
  if (
    codigoNormalizado === 'oauth_not_configured' ||
    codigoNormalizado === 'oauth_nao_configurado' ||
    codigoNormalizado === 'oauth_indisponivel'
  ) {
    return 'A conexão OAuth ainda não está disponível no servidor.'
  }
  if (codigoNormalizado === 'producao_bloqueada') {
    return 'Esta conta opera em modo real e não foi conectada, porque cobranças reais continuam bloqueadas nesta etapa. Qualquer teste real só pode ser feito pelo titular adulto ou responsável da conta.'
  }
  if (codigoNormalizado === 'cobrancas_pendentes') {
    return 'A conexão não pode ser alterada enquanto houver cobranças Pix sem conciliação final. Atualize essas cobranças e tente novamente.'
  }
  if (codigoNormalizado === 'conta_ja_conectada') {
    return 'Esta conta do Mercado Pago já está vinculada a outra empresa no Servix.'
  }
  if (
    codigoNormalizado === 'troca_token_falhou' ||
    codigoNormalizado === 'callback_invalido'
  ) {
    return 'O Mercado Pago não concluiu a autorização. Inicie a conexão novamente.'
  }

  return 'Não foi possível concluir a conexão com o Mercado Pago. Tente novamente.'
}

function formatarData(valor: string) {
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'recentemente'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data)
}

function obterMensagemErro(error: unknown) {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado'
}

function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
}

function ManualIcon() {
  return <Icon><path d="M7 3h10v4H7V3ZM5 5H4a1 1 0 0 0-1 1v15h18V6a1 1 0 0 0-1-1h-1M7 12h10M7 16h7" /></Icon>
}

function SimulationIcon() {
  return <Icon><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M8 15h8" /></Icon>
}

function WalletIcon() {
  return <Icon><path d="M4 6.5h14a2 2 0 0 1 2 2V19H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12M16 12h4" /><circle cx="16" cy="12" r=".5" /></Icon>
}

function BankIcon() {
  return <Icon><path d="m3 9 9-6 9 6H3ZM5 9v9M9 9v9M15 9v9M19 9v9M3 21h18M2 18h20" /></Icon>
}

function ShieldIcon() {
  return <Icon><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-5" /></Icon>
}

function CheckIcon() {
  return <Icon><path d="m5 12 4 4L19 6" /></Icon>
}

function CloseIcon() {
  return <Icon><path d="m6 6 12 12M18 6 6 18" /></Icon>
}

function WarningIcon() {
  return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon>
}

function FlaskIcon() {
  return <Icon><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M8 15h8" /></Icon>
}

function SaveIcon() {
  return <Icon><path d="M5 3h12l2 2v16H5V3Z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></Icon>
}

function LoadingIcon() {
  return <Icon><path d="M20 12a8 8 0 1 1-2.3-5.7" /></Icon>
}

function BookIcon() {
  return <Icon><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16ZM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5v-16Z" /></Icon>
}

function UnlinkIcon() {
  return <Icon><path d="m9 15-2 2a3 3 0 0 1-4-4l3-3a3 3 0 0 1 4 0M15 9l2-2a3 3 0 0 1 4 4l-3 3a3 3 0 0 1-4 0M8 4l8 16" /></Icon>
}

function ExternalLinkIcon() {
  return <Icon><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></Icon>
}
