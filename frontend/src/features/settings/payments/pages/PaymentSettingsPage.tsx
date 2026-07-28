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
} from '../services/payment-settings.service'
import type {
  AtualizarConfiguracaoPagamentoInput,
  ConfiguracaoPagamento,
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
    descricao: 'Cobranças automáticas ficarão disponíveis em uma etapa futura.',
    destaque: 'Em desenvolvimento',
    icon: <SimulationIcon />,
  },
  {
    id: 'MERCADO_PAGO',
    nome: 'Mercado Pago',
    descricao: 'A conexão OAuth e os pagamentos online estão em desenvolvimento.',
    destaque: 'Em desenvolvimento',
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
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erroCarregamento, setErroCarregamento] = useState('')
  const [erroSalvamento, setErroSalvamento] = useState('')
  const [conflito, setConflito] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    void buscarConfiguracaoPagamento({ signal: controller.signal })
      .then(resultado => {
        setConfiguracao(resultado.configuracao)
        setRascunho(criarRascunho(resultado.configuracao))
        setProvedoresDisponiveis(resultado.provedoresDisponiveis)
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
      const dadosEnvio = {
        ...rascunho,
        provedor: 'MANUAL' as const,
        ambiente: 'PRODUCAO' as const,
        pixHabilitado: false,
      }
      const resultado = await atualizarConfiguracaoPagamento(dadosEnvio)
      setConfiguracao(resultado.configuracao)
      setRascunho(criarRascunho(resultado.configuracao))
      setProvedoresDisponiveis(resultado.provedoresDisponiveis)
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
    if (provedor !== 'MANUAL') return

    setMensagemSucesso('')
    setErroSalvamento('')
    const ambientes = obterAmbientesProvedor(provedor, provedoresDisponiveis)
    setRascunho(atual => {
      if (!atual) return atual

      return {
        ...atual,
        provedor,
        pixHabilitado: false,
        ambiente: ambientes.includes(atual.ambiente)
          ? atual.ambiente
          : ambientes[0] ?? 'TESTE',
      }
    })
  }

  function alterarOpcao(
    campo: 'ativo',
    valor: boolean,
  ) {
    setMensagemSucesso('')
    setErroSalvamento('')
    setRascunho(atual => (atual ? { ...atual, [campo]: valor } : atual))
  }

  if (carregando) return <PaymentSettingsSkeleton />

  if (
    erroCarregamento ||
    !configuracao ||
    !rascunho
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
  const provedorSelecionadoDisponivel =
    modoManual && provedoresDisponiveis.find(
      item => item.provedor === 'MANUAL',
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
          <strong>Pagamentos online em desenvolvimento</strong>
          <p>
            Por enquanto, os recebimentos são feitos diretamente na
            assistência e registrados manualmente na ordem de serviço.
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
              const disponivel =
                provedor.id === 'MANUAL' &&
                disponibilidade?.disponivel === true

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
                  A conexão OAuth será liberada depois da validação técnica.
                  Até lá, nenhuma conta pode ser conectada nesta tela.
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
                className="payment-provider-documentation__status payment-provider-documentation__status--waiting"
                role="status"
              >
                <span aria-hidden="true" />
                <div>
                  <strong>Aplicativo OAuth</strong>
                  <p>Configuração preservada no servidor, mas indisponível para uso.</p>
                </div>
                <small>Em desenvolvimento</small>
              </div>
            </div>
          </fieldset>

          <MercadoPagoDevelopmentCard />
        </section>

        <section className="payment-settings-card">
          <div className="payment-settings-card__header">
            <span>2</span>
            <div>
              <h2>Defina o funcionamento</h2>
              <p>
                O registro manual confirma valores que já foram recebidos
                diretamente pela assistência.
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

          </div>

          <fieldset className="payment-environment" disabled={salvando}>
            <legend className="sr-only">Ambiente da integração</legend>
            <div>
              <strong>Ambiente</strong>
              <span>
                Produção identifica registros reais feitos pela equipe. Nenhum
                pagamento é processado pelo Servix neste modo.
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
              {rascunho.ativo ? 'Ativo' : 'Inativo'} · pagamentos online em desenvolvimento
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

function MercadoPagoDevelopmentCard() {
  return (
    <section
      className="mercado-pago-connection mercado-pago-connection--disconnected"
      aria-labelledby="mercado-pago-connection-title"
    >
      <header className="mercado-pago-connection__header">
        <span className="mercado-pago-connection__icon" aria-hidden="true">
          <WalletIcon />
        </span>
        <div>
          <span>Conta da empresa</span>
          <h3 id="mercado-pago-connection-title">Mercado Pago</h3>
          <p>A conexão OAuth ainda não está disponível para as empresas.</p>
        </div>
        <span className="mercado-pago-connection__status">
          <i aria-hidden="true" />
          Em desenvolvimento
        </span>
      </header>

      <div className="mercado-pago-connection__footer">
        <p>
          <ShieldIcon />
          Até a liberação, use apenas o registro manual depois que a assistência
          receber o pagamento diretamente.
        </p>
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
    provedor: 'MANUAL',
    ambiente: 'PRODUCAO',
    ativo: true,
    pixHabilitado: false,
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
  if (provedor.id === 'MANUAL' && disponibilidade?.disponivel) {
    return provedor.destaque
  }
  return provedor.id === 'ASAAS' ? 'Em breve' : 'Em desenvolvimento'
}

function obterMotivoIndisponibilidade(
  provedor: ProvedorPagamento,
) {
  return provedor === 'ASAAS'
    ? 'Este provedor ainda não está disponível.'
    : 'Pagamentos online estão em desenvolvimento.'
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

function ExternalLinkIcon() {
  return <Icon><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></Icon>
}
