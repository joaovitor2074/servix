import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { listarClientes } from '../../clients/services/clients.service'
import type { Cliente } from '../../clients/types/client.types'
import './ClientSelector.css'

const LIMITE_CLIENTES = 6

interface ClientSelectorProps {
  clienteSelecionado: Cliente | null
  onSelecionar: (cliente: Cliente) => void
  onTrocar: () => void
  onCadastrarCliente?: () => void
  stepLabel?: string
}

interface ResultadoClientes {
  busca: string
  clientes: Cliente[]
}

interface FalhaClientes {
  busca: string
  mensagem: string
}

export default function ClientSelector({
  clienteSelecionado,
  onSelecionar,
  onTrocar,
  onCadastrarCliente,
  stepLabel = 'Etapa 1 de 2',
}: ClientSelectorProps) {
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [resultado, setResultado] = useState<ResultadoClientes | null>(null)
  const [falha, setFalha] = useState<FalhaClientes | null>(null)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    // Com um cliente confirmado o resumo já tem tudo o que a etapa precisa;
    // evitamos uma listagem desnecessária até o funcionário clicar em trocar.
    if (clienteSelecionado) return

    // A tela abre com os clientes mais recentes. Isso reduz buscas no balcão,
    // mas o mesmo endpoint também atende pesquisas por nome, telefone e CPF/CNPJ.
    const controller = new AbortController()

    void listarClientes(
      {
        pagina: 1,
        limite: LIMITE_CLIENTES,
        ...(buscaAplicada ? { busca: buscaAplicada } : {}),
      },
      { signal: controller.signal },
    )
      .then(resposta => {
        setResultado({ busca: buscaAplicada, clientes: resposta.dados })
        setFalha(null)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return

        setFalha({
          busca: buscaAplicada,
          mensagem:
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar os clientes',
        })
      })

    return () => controller.abort()
  }, [buscaAplicada, clienteSelecionado, tentativa])

  // Depois da escolha mostramos somente um resumo. O funcionário confirma
  // visualmente o cliente antes de informar os dados do equipamento.
  if (clienteSelecionado) {
    return (
      <section className="client-selector client-selector--selected">
        <div className="client-selector__selected-icon">
          <CheckIcon />
        </div>
        <div className="client-selector__selected-data">
          <span>Cliente selecionado</span>
          <strong>{clienteSelecionado.nome}</strong>
          <p>
            {formatarTelefone(clienteSelecionado.telefone)}
            {clienteSelecionado.email
              ? ` · ${clienteSelecionado.email}`
              : ''}
          </p>
        </div>
        <button type="button" onClick={onTrocar}>
          Trocar cliente
        </button>
      </section>
    )
  }

  const resultadoAtual =
    resultado?.busca === buscaAplicada ? resultado.clientes : null
  const falhaAtual = falha?.busca === buscaAplicada ? falha : null
  const carregando = !resultadoAtual && !falhaAtual

  function handleBusca(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const dados = new FormData(event.currentTarget)
    const termoDigitado = String(dados.get('buscaCliente') ?? '').trim()

    // Telefones e documentos são armazenados apenas com dígitos. Quando a
    // entrada não possui letras, retiramos a máscara antes de consultar a API.
    const novaBusca = normalizarBusca(termoDigitado)

    setResultado(null)
    setFalha(null)
    setBuscaAplicada(novaBusca)
    setTentativa(valor => valor + 1)
  }

  function tentarNovamente() {
    setResultado(null)
    setFalha(null)
    setTentativa(valor => valor + 1)
  }

  return (
    <section className="client-selector" aria-labelledby="client-selector-title">
      <div className="client-selector__header">
        <div>
          <span className="client-selector__step">{stepLabel}</span>
          <h2 id="client-selector-title">Selecione o cliente</h2>
          <p>Busque pelo nome, telefone ou CPF/CNPJ.</p>
        </div>
        {onCadastrarCliente && (
          <button
            className="client-selector__create"
            type="button"
            onClick={onCadastrarCliente}
          >
            <PlusIcon />
            Cadastrar cliente
          </button>
        )}
      </div>

      <form className="client-selector__search" onSubmit={handleBusca}>
        <label htmlFor="client-search" className="sr-only">
          Buscar cliente
        </label>
        <SearchIcon />
        <input
          id="client-search"
          name="buscaCliente"
          type="search"
          defaultValue={buscaAplicada}
          placeholder="Nome, telefone ou documento..."
          maxLength={120}
        />
        <button type="submit">Buscar</button>
      </form>

      {carregando && <ClientResultsSkeleton />}

      {falhaAtual && (
        <div className="client-selector__feedback" role="alert">
          <WarningIcon />
          <div>
            <strong>Não foi possível buscar os clientes</strong>
            <p>{falhaAtual.mensagem}</p>
          </div>
          <button type="button" onClick={tentarNovamente}>
            Tentar novamente
          </button>
        </div>
      )}

      {resultadoAtual && resultadoAtual.length > 0 && (
        <div className="client-selector__results">
          <div className="client-selector__results-title">
            <strong>
              {buscaAplicada ? 'Resultados da busca' : 'Clientes recentes'}
            </strong>
            <span>Selecione para continuar</span>
          </div>

          <div className="client-selector__list">
            {resultadoAtual.map(cliente => (
              <button
                className="client-selector__client"
                type="button"
                key={cliente.id}
                onClick={() => onSelecionar(cliente)}
              >
                <span className="client-selector__avatar" aria-hidden="true">
                  {obterIniciais(cliente.nome)}
                </span>
                <span className="client-selector__client-data">
                  <strong>{cliente.nome}</strong>
                  <small>
                    {formatarTelefone(cliente.telefone)}
                    {cliente.cpfCnpj
                      ? ` · ${formatarDocumento(cliente.cpfCnpj)}`
                      : ''}
                  </small>
                </span>
                <ChevronRightIcon />
              </button>
            ))}
          </div>
        </div>
      )}

      {resultadoAtual && resultadoAtual.length === 0 && (
        <div className="client-selector__empty">
          <UserSearchIcon />
          <div>
            <strong>Nenhum cliente encontrado</strong>
            <p>Confira a busca ou cadastre o cliente para seguir.</p>
          </div>
          {onCadastrarCliente && (
            <button
              className="client-selector__create"
              type="button"
              onClick={onCadastrarCliente}
            >
              Cadastrar novo cliente
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function normalizarBusca(valor: string) {
  if (/[A-Za-zÀ-ÿ]/.test(valor)) return valor
  return valor.replace(/\D/g, '')
}

function obterIniciais(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(parte => parte[0]?.toUpperCase() ?? '')
    .join('')
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

function formatarDocumento(documento: string) {
  if (documento.length === 11) {
    return documento.replace(
      /(\d{3})(\d{3})(\d{3})(\d{2})/,
      '$1.$2.$3-$4',
    )
  }

  if (documento.length === 14) {
    return documento.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5',
    )
  }

  return documento
}

function ClientResultsSkeleton() {
  return (
    <div className="client-selector__loading" aria-busy="true">
      <span className="sr-only">Carregando clientes</span>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} />
      ))}
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

function SearchIcon() {
  return <Icon><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Icon>
}

function PlusIcon() {
  return <Icon><path d="M12 5v14M5 12h14" /></Icon>
}

function CheckIcon() {
  return <Icon><path d="m5 12 4 4L19 6" /></Icon>
}

function ChevronRightIcon() {
  return <Icon><path d="m9 18 6-6-6-6" /></Icon>
}

function WarningIcon() {
  return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon>
}

function UserSearchIcon() {
  return <Icon><circle cx="10" cy="8" r="3.5" /><path d="M3.5 19v-1a6.5 6.5 0 0 1 10-5.5M16 16l4 4M19.5 16.5a3 3 0 1 1-4.2-4.2 3 3 0 0 1 4.2 4.2Z" /></Icon>
}
