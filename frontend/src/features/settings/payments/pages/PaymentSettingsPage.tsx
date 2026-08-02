import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
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
    descricao: 'Gera cobranças fictícias para validar o fluxo sem movimentar dinheiro.',
    destaque: 'Teste',
    icon: <SimulationIcon />,
  },
  {
    id: 'MERCADO_PAGO',
    nome: 'Mercado Pago',
    descricao: 'Conecte a conta da assistência para receber cobranças Pix.',
    destaque: 'OAuth',
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
  const [conectandoMercadoPago, setConectandoMercadoPago] = useState(false)
  const [desconectandoMercadoPago, setDesconectandoMercadoPago] =
    useState(false)
  const [retornoOAuth] = useState(lerRetornoOAuth)
  const [erroCarregamento, setErroCarregamento] = useState('')
  const [erroSalvamento, setErroSalvamento] = useState(() =>
    retornoOAuth?.resultado === 'erro'
      ? mensagemRetornoOAuth(retornoOAuth.codigo)
      : '',
  )
  const [conflito, setConflito] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState(() =>
    retornoOAuth?.resultado === 'conectado'
      ? 'Conta do Mercado Pago conectada. Selecione o provedor e salve para ativar o Pix.'
      : '',
  )
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (!retornoOAuth) return

    const url = new URL(window.location.href)
    url.searchParams.delete('mercadoPago')
    url.searchParams.delete('codigo')
    window.history.replaceState(window.history.state, '', url)
  }, [retornoOAuth])

  useEffect(() => {
    const controller = new AbortController()

    void buscarConfiguracaoPagamento({ signal: controller.signal })
      .then(resultado => {
        setConfiguracao(resultado.configuracao)
        setRascunho(criarRascunho(resultado.configuracao))
        setProvedoresDisponiveis(resultado.provedoresDisponiveis)
        setIntegracaoMercadoPago(resultado.integracaoMercadoPago)
        setErroCarregamento('')
        setConflito(false)
        setConectandoMercadoPago(false)
        setDesconectandoMercadoPago(false)
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
      const resultado = await atualizarConfiguracaoPagamento(rascunho)
      setConfiguracao(resultado.configuracao)
      setRascunho(criarRascunho(resultado.configuracao))
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

  function selecionarProvedor(provedor: ProvedorPagamento) {
    const disponibilidade = provedoresDisponiveis.find(
      item => item.provedor === provedor,
    )
    if (!disponibilidade?.disponivel) return

    setMensagemSucesso('')
    setErroSalvamento('')
    const ambientes = obterAmbientesProvedor(provedor, provedoresDisponiveis)
    setRascunho(atual => {
      if (!atual) return atual

      return {
        ...atual,
        provedor,
        ativo: true,
        pixHabilitado: provedor === 'MERCADO_PAGO',
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
    setMensagemSucesso('')
    setErroSalvamento('')
    setRascunho(atual => (atual ? { ...atual, [campo]: valor } : atual))
  }

  async function handleConectarMercadoPago() {
    if (conectandoMercadoPago || desconectandoMercadoPago) return

    setConectandoMercadoPago(true)
    setErroSalvamento('')
    setMensagemSucesso('')

    try {
      const { authorizationUrl } = await iniciarOAuthMercadoPago()
      window.location.assign(authorizationUrl)
    } catch (error) {
      setErroSalvamento(obterMensagemErro(error))
      setConectandoMercadoPago(false)
    }
  }

  async function handleDesconectarMercadoPago() {
    if (conectandoMercadoPago || desconectandoMercadoPago) return
    if (!window.confirm(
      'Desconectar a conta do Mercado Pago? Novas cobranças Pix ficarão indisponíveis.',
    )) return

    setDesconectandoMercadoPago(true)
    setErroSalvamento('')
    setMensagemSucesso('')

    try {
      await desconectarMercadoPago()
      setMensagemSucesso('Conta do Mercado Pago desconectada com sucesso.')
      setCarregando(true)
      setTentativa(valor => valor + 1)
    } catch (error) {
      setErroSalvamento(obterMensagemErro(error))
      setDesconectandoMercadoPago(false)
    }
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

  const modoManual = rascunho.provedor === 'MANUAL'
  const modoMercadoPago = rascunho.provedor === 'MERCADO_PAGO'
  const provedorSelecionadoDisponivel =
    provedoresDisponiveis.find(
      item => item.provedor === rascunho.provedor,
    )?.disponivel === true
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
          ativo={rascunho.ativo}
          status={rascunho.ativo ? 'ATIVA' : 'INATIVA'}
        />
      </header>

      <div className="payment-settings-notice" role="note">
        <span className="payment-settings-notice__icon">
          <ShieldIcon />
        </span>
        <div>
          <strong>Conexão segura com a conta da assistência</strong>
          <p>
            O Servix usa OAuth: a senha e o Access Token do Mercado Pago nunca
            são informados nesta tela nem enviados ao navegador.
          </p>
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
              const disponivel = disponibilidade?.disponivel === true

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
                        )}
                      </small>
                    </span>
                    <span>{provedor.descricao}</span>
                    {!disponivel && (
                      <span className="payment-provider__reason">
                        {obterMotivoIndisponibilidade(
                          provedor.id,
                          disponibilidade,
                        )}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}

            <MercadoPagoConnectionCard
              integracao={integracaoMercadoPago}
              conectando={conectandoMercadoPago}
              desconectando={desconectandoMercadoPago}
              onConectar={() => void handleConectarMercadoPago()}
              onDesconectar={() => void handleDesconectarMercadoPago()}
            />
          </fieldset>
        </section>

        <section className="payment-settings-card">
          <div className="payment-settings-card__header">
            <span>2</span>
            <div>
              <h2>Defina o funcionamento</h2>
              <p>
                {modoMercadoPago
                  ? 'Ative as cobranças Pix recebidas na conta conectada.'
                  : 'O registro manual confirma valores recebidos diretamente pela assistência.'}
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
                  : 'Permite utilizar o provedor conectado nas cobranças.'
              }
              onChange={valor => alterarOpcao('ativo', valor)}
            />

            {modoMercadoPago && (
              <SwitchField
                checked={rascunho.pixHabilitado}
                disabled={
                  salvando ||
                  !provedorSelecionadoDisponivel ||
                  !rascunho.ativo
                }
                label="Habilitar cobranças Pix"
                description="Permite gerar Pix para os clientes usando a conta conectada."
                onChange={valor => alterarOpcao('pixHabilitado', valor)}
              />
            )}
          </div>

          <fieldset className="payment-environment" disabled={salvando}>
            <legend className="sr-only">Ambiente da integração</legend>
            <div>
              <strong>Ambiente</strong>
              <span>
                O ambiente é definido pela configuração OAuth do servidor e
                precisa corresponder à conta autorizada.
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
              {rascunho.ativo ? 'Ativo' : 'Inativo'}
              {modoMercadoPago
                ? ` · Pix ${rascunho.pixHabilitado ? 'habilitado' : 'desabilitado'}`
                : ''}
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
                  setRascunho(criarRascunho(configuracao))
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
  conectando,
  desconectando,
  onConectar,
  onDesconectar,
}: {
  integracao: IntegracaoMercadoPago
  conectando: boolean
  desconectando: boolean
  onConectar: () => void
  onDesconectar: () => void
}) {
  const processando = conectando || desconectando
  const conectado = integracao.conectado && integracao.status === 'CONECTADA'
  const tone = conectado
    ? 'connected'
    : integracao.status === 'ERRO' || !integracao.oauthDisponivel
      ? 'error'
      : integracao.status === 'BLOQUEADA' || integracao.status === 'EXPIRADA'
        ? 'warning'
        : 'disconnected'
  const status = conectado
    ? 'Conectada'
    : integracao.status === 'BLOQUEADA'
      ? 'Ambiente incorreto'
      : integracao.status === 'EXPIRADA'
        ? 'Expirada'
        : integracao.status === 'ERRO'
          ? 'Requer atenção'
          : 'Desconectada'

  return (
    <section
      className={`mercado-pago-connection mercado-pago-connection--${tone}`}
      aria-labelledby="mercado-pago-connection-title"
    >
      <header className="mercado-pago-connection__header">
        <span className="mercado-pago-connection__icon" aria-hidden="true">
          <WalletIcon />
        </span>
        <div>
          <span>Conta da empresa</span>
          <h3 id="mercado-pago-connection-title">Mercado Pago</h3>
          <p>
            {conectado
              ? 'Esta assistência autorizou o Servix a criar e consultar cobranças.'
              : 'Conecte a conta que receberá os pagamentos dos clientes.'}
          </p>
        </div>
        <span className="mercado-pago-connection__status">
          <i aria-hidden="true" />
          {status}
        </span>
      </header>

      {integracao.mercadoPagoUserId && (
        <dl className="mercado-pago-connection__details">
          <div>
            <dt>Conta Mercado Pago</dt>
            <dd>{integracao.mercadoPagoUserId}</dd>
          </div>
          <div>
            <dt>Ambiente</dt>
            <dd>{integracao.liveMode ? 'Produção' : 'Teste'}</dd>
          </div>
          {integracao.conectadoEm && (
            <div>
              <dt>Conectada em</dt>
              <dd>{formatarData(integracao.conectadoEm)}</dd>
            </div>
          )}
          {integracao.tokenExpiraEm && (
            <div>
              <dt>Credencial válida até</dt>
              <dd>{formatarData(integracao.tokenExpiraEm)}</dd>
            </div>
          )}
        </dl>
      )}

      {integracao.liveMode && conectado && (
        <div className="mercado-pago-connection__live-warning" role="note">
          <WarningIcon />
          <span>Conta de produção: as cobranças criadas movimentam dinheiro real.</span>
        </div>
      )}

      {integracao.motivoIndisponibilidade && !conectado && (
        <div className="mercado-pago-connection__error" role="alert">
          <WarningIcon />
          <span>{integracao.motivoIndisponibilidade}</span>
        </div>
      )}

      <div className="mercado-pago-connection__footer">
        <p>
          <ShieldIcon />
          A autorização acontece no domínio oficial do Mercado Pago. O Servix
          armazena os tokens criptografados somente no servidor.
        </p>
        <div className="mercado-pago-connection__actions">
          <button
            className="mercado-pago-connection__connect"
            type="button"
            disabled={!integracao.oauthDisponivel || processando}
            onClick={onConectar}
          >
            {conectando ? <LoadingIcon /> : <ExternalLinkIcon />}
            {conectando
              ? 'Abrindo Mercado Pago...'
              : conectado
                ? 'Reconectar conta'
                : 'Conectar Mercado Pago'}
          </button>
          {integracao.mercadoPagoUserId && (
            <button
              className="mercado-pago-connection__disconnect"
              type="button"
              disabled={processando}
              onClick={onDesconectar}
            >
              {desconectando && <LoadingIcon />}
              {desconectando ? 'Desconectando...' : 'Desconectar'}
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
): AtualizarConfiguracaoPagamentoInput {
  return {
    versaoEsperada: configuracao.versao,
    provedor: configuracao.provedor,
    ambiente: configuracao.ambiente,
    ativo: configuracao.ativo,
    pixHabilitado: configuracao.pixHabilitado,
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
) {
  if (disponibilidade?.disponivel) {
    return provedor.destaque
  }
  if (provedor.id === 'MERCADO_PAGO' && disponibilidade?.configuracaoServidor === 'CONFIGURADA') {
    return 'Conectar conta'
  }
  return provedor.id === 'ASAAS' ? 'Em breve' : 'Indisponível'
}

function obterMotivoIndisponibilidade(
  provedor: ProvedorPagamento,
  disponibilidade?: ProvedorPagamentoDisponivel,
) {
  if (disponibilidade?.motivoIndisponibilidade) {
    return disponibilidade.motivoIndisponibilidade
  }
  return provedor === 'ASAAS'
    ? 'Este provedor ainda não está disponível.'
    : 'Este provedor não está disponível neste ambiente.'
}

function lerRetornoOAuth() {
  const url = new URL(window.location.href)
  const resultado = url.searchParams.get('mercadoPago')

  if (resultado !== 'conectado' && resultado !== 'erro') return null

  return {
    resultado,
    codigo: url.searchParams.get('codigo'),
  }
}

function mensagemRetornoOAuth(codigo: string | null) {
  const mensagens: Record<string, string> = {
    AUTORIZACAO_NEGADA: 'A autorização foi cancelada no Mercado Pago.',
    AMBIENTE_INCOMPATIVEL:
      'A conta autorizada pertence a outro ambiente. Confira se o servidor está em teste ou produção.',
    COBRANCAS_PENDENTES:
      'Existem cobranças pendentes vinculadas à conta atual. Concilie-as antes de trocar a conexão.',
    CONTA_JA_CONECTADA:
      'Esta conta do Mercado Pago já está conectada a outra empresa no Servix.',
    STATE_INVALIDO:
      'A solicitação de conexão expirou ou já foi utilizada. Inicie novamente.',
    CALLBACK_INVALIDO:
      'O Mercado Pago não devolveu uma autorização válida. Tente novamente.',
    TROCA_TOKEN_FALHOU:
      'Não foi possível validar a autorização com o Mercado Pago. Tente novamente.',
  }

  return codigo && mensagens[codigo]
    ? mensagens[codigo]
    : 'Não foi possível concluir a conexão com o Mercado Pago.'
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

function ExternalLinkIcon() {
  return <Icon><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></Icon>
}
