import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router'
import type { RespostaPaginada } from '../../../shared/types/api.types'
import {
  STATUS_ORDEM,
  STATUS_ORDEM_LABELS,
  type OrdemServico,
  type StatusOrdem,
} from '../../../shared/types/ordem.types'
import {
  listarOrdens,
  type ListarOrdensFiltros,
} from '../services/orders.service'
import './OrdersPage.css'

const LIMITE_POR_PAGINA = 10

interface ResultadoCarregado {
  // A chave identifica exatamente para quais parâmetros esta resposta pertence.
  chave: string
  resposta: RespostaPaginada<OrdemServico>
}

interface FalhaCarregamento {
  chave: string
  mensagem: string
}

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [resultado, setResultado] = useState<ResultadoCarregado | null>(null)
  const [falha, setFalha] = useState<FalhaCarregamento | null>(null)
  const [tentativa, setTentativa] = useState(0)

  // Transformar a query em texto cria uma chave estável para a requisição. Ela
  // também permite diferenciar a resposta anterior da página sendo carregada.
  const chaveConsulta = searchParams.toString()
  const filtros = useMemo(
    () => lerFiltrosDaUrl(new URLSearchParams(chaveConsulta)),
    [chaveConsulta],
  )

  useEffect(() => {
    const controller = new AbortController()

    // Quando filtros ou página mudam, a requisição anterior é cancelada pelo
    // cleanup. Assim uma resposta antiga não substitui dados mais recentes.
    void listarOrdens(filtros, { signal: controller.signal })
      .then(resposta => {
        setResultado({ chave: chaveConsulta, resposta })
        setFalha(null)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return

        setFalha({
          chave: chaveConsulta,
          mensagem:
            error instanceof Error
              ? error.message
              : 'Ocorreu um erro inesperado',
        })
      })

    return () => controller.abort()
  }, [chaveConsulta, filtros, tentativa])

  const respostaAtual =
    resultado?.chave === chaveConsulta ? resultado.resposta : null
  const falhaAtual = falha?.chave === chaveConsulta ? falha : null
  const carregando = !respostaAtual && !falhaAtual

  function handleBusca(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const dados = new FormData(event.currentTarget)
    const busca = String(dados.get('busca') ?? '').trim()
    atualizarParametros({ busca: busca || undefined, pagina: 1 })
  }

  function handleStatus(status: string) {
    atualizarParametros({
      status: statusEhValido(status) ? status : undefined,
      pagina: 1,
    })
  }

  function atualizarParametros(
    alteracoes: Partial<ListarOrdensFiltros>,
  ) {
    const novosParametros = new URLSearchParams(searchParams)

    // Cada alteração é aplicada de forma explícita para manter a URL curta e
    // permitir compartilhar ou recarregar a página preservando seus filtros.
    if ('busca' in alteracoes) {
      definirParametro(novosParametros, 'busca', alteracoes.busca)
    }

    if ('status' in alteracoes) {
      definirParametro(novosParametros, 'status', alteracoes.status)
    }

    if (alteracoes.pagina !== undefined) {
      definirParametro(
        novosParametros,
        'pagina',
        alteracoes.pagina > 1 ? alteracoes.pagina : undefined,
      )
    }

    setSearchParams(novosParametros)
  }

  function limparFiltros() {
    setSearchParams(new URLSearchParams())
  }

  function tentarNovamente() {
    // Limpar a falha faz o skeleton reaparecer enquanto uma nova tentativa é
    // disparada, mesmo que os parâmetros continuem iguais.
    setFalha(null)
    setTentativa(valor => valor + 1)
  }

  const possuiFiltros = Boolean(filtros.busca || filtros.status)

  return (
    <div className="orders-page">
      <header className="orders-page__header">
        <div>
          <span className="orders-page__eyebrow">Atendimentos</span>
          <h1>Ordens de serviço</h1>
          <p>Consulte e acompanhe todos os serviços da empresa.</p>
        </div>
      </header>

      <section className="orders-filters" aria-label="Filtros das ordens">
        <form className="orders-filters__search" onSubmit={handleBusca}>
          <label htmlFor="orders-search" className="sr-only">
            Buscar ordens
          </label>
          <SearchIcon />
          <input
            id="orders-search"
            key={filtros.busca ?? 'sem-busca'}
            name="busca"
            type="search"
            defaultValue={filtros.busca ?? ''}
            placeholder="Cliente, equipamento ou problema..."
            maxLength={120}
          />
          <button type="submit">Buscar</button>
        </form>

        <label className="orders-filters__status">
          <span>Status</span>
          <select
            value={filtros.status ?? ''}
            onChange={event => handleStatus(event.target.value)}
          >
            <option value="">Todos os status</option>
            {STATUS_ORDEM.map(status => (
              <option value={status} key={status}>
                {STATUS_ORDEM_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        {possuiFiltros && (
          <button
            className="orders-filters__clear"
            type="button"
            onClick={limparFiltros}
          >
            Limpar filtros
          </button>
        )}
      </section>

      {carregando && <OrdersSkeleton />}

      {falhaAtual && (
        <section className="orders-feedback" role="alert">
          <div className="orders-feedback__icon">
            <WarningIcon />
          </div>
          <h2>Não foi possível carregar as ordens</h2>
          <p>{falhaAtual.mensagem}</p>
          <button type="button" onClick={tentarNovamente}>
            Tentar novamente
          </button>
        </section>
      )}

      {respostaAtual && (
        <OrdersContent
          resposta={respostaAtual}
          possuiFiltros={possuiFiltros}
          onClearFilters={limparFiltros}
          onChangePage={pagina => atualizarParametros({ pagina })}
        />
      )}
    </div>
  )
}

interface OrdersContentProps {
  resposta: RespostaPaginada<OrdemServico>
  possuiFiltros: boolean
  onClearFilters: () => void
  onChangePage: (pagina: number) => void
}

function OrdersContent({
  resposta,
  possuiFiltros,
  onClearFilters,
  onChangePage,
}: OrdersContentProps) {
  const { dados, paginacao } = resposta

  if (dados.length === 0) {
    return (
      <section className="orders-empty">
        <div className="orders-empty__icon">
          <ClipboardIcon />
        </div>
        <h2>
          {possuiFiltros
            ? 'Nenhuma ordem encontrada'
            : 'Nenhuma ordem cadastrada'}
        </h2>
        <p>
          {possuiFiltros
            ? 'Tente usar outros termos ou remover os filtros.'
            : 'As ordens criadas pela empresa aparecerão nesta lista.'}
        </p>
        {possuiFiltros && (
          <button type="button" onClick={onClearFilters}>
            Limpar filtros
          </button>
        )}
      </section>
    )
  }

  const primeiroItem =
    (paginacao.pagina - 1) * paginacao.limite + 1
  const ultimoItem = Math.min(
    paginacao.pagina * paginacao.limite,
    paginacao.total,
  )

  return (
    <section className="orders-card" aria-label="Lista de ordens">
      <div className="orders-card__summary" aria-live="polite">
        <strong>{paginacao.total.toLocaleString('pt-BR')} ordens</strong>
        <span>
          Exibindo {primeiroItem}–{ultimoItem}
        </span>
      </div>

      <div className="orders-table-wrapper">
        <table className="orders-table">
          <thead>
            <tr>
              <th scope="col">Ordem</th>
              <th scope="col">Cliente</th>
              <th scope="col">Equipamento</th>
              <th scope="col">Status</th>
              <th scope="col">Valor</th>
              <th scope="col">Atualização</th>
            </tr>
          </thead>
          <tbody>
            {dados.map(ordem => (
              <tr key={ordem.id}>
                <td data-label="Ordem">
                  <strong className="orders-table__id">#{ordem.id}</strong>
                </td>
                <td data-label="Cliente">
                  <div className="orders-table__primary">
                    <strong>{ordem.cliente.nome}</strong>
                    <span>{ordem.cliente.telefone}</span>
                  </div>
                </td>
                <td data-label="Equipamento">
                  <div className="orders-table__primary">
                    <strong>{ordem.equipamento}</strong>
                    <span>{ordem.problemaRelatado}</span>
                  </div>
                </td>
                <td data-label="Status">
                  <OrderStatus status={ordem.status} />
                </td>
                <td data-label="Valor">
                  <strong>{formatarValor(ordem.valor)}</strong>
                </td>
                <td data-label="Atualização">
                  <time dateTime={ordem.atualizadoEm}>
                    {formatarData(ordem.atualizadoEm)}
                  </time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="orders-pagination" aria-label="Paginação das ordens">
        <button
          type="button"
          disabled={paginacao.pagina <= 1}
          onClick={() => onChangePage(paginacao.pagina - 1)}
        >
          <ChevronLeftIcon />
          Anterior
        </button>
        <span>
          Página <strong>{paginacao.pagina}</strong> de{' '}
          <strong>{Math.max(paginacao.totalPaginas, 1)}</strong>
        </span>
        <button
          type="button"
          disabled={
            paginacao.totalPaginas === 0 ||
            paginacao.pagina >= paginacao.totalPaginas
          }
          onClick={() => onChangePage(paginacao.pagina + 1)}
        >
          Próxima
          <ChevronRightIcon />
        </button>
      </nav>
    </section>
  )
}

function OrderStatus({ status }: { status: StatusOrdem }) {
  return (
    <span className={`order-status order-status--${status.toLowerCase()}`}>
      {STATUS_ORDEM_LABELS[status]}
    </span>
  )
}

function OrdersSkeleton() {
  return (
    <div className="orders-loading" aria-busy="true">
      <span className="sr-only">Carregando ordens</span>
      <div className="orders-skeleton orders-skeleton--summary" />
      {Array.from({ length: 6 }, (_, index) => (
        <div className="orders-skeleton orders-skeleton--row" key={index} />
      ))}
    </div>
  )
}

function lerFiltrosDaUrl(parametros: URLSearchParams): ListarOrdensFiltros {
  const paginaRecebida = Number(parametros.get('pagina'))
  const statusRecebido = parametros.get('status')
  const buscaRecebida = parametros.get('busca')?.trim()

  return {
    pagina:
      Number.isInteger(paginaRecebida) && paginaRecebida > 0
        ? paginaRecebida
        : 1,
    limite: LIMITE_POR_PAGINA,
    ...(buscaRecebida ? { busca: buscaRecebida } : {}),
    ...(statusEhValido(statusRecebido)
      ? { status: statusRecebido }
      : {}),
  }
}

function statusEhValido(status: string | null): status is StatusOrdem {
  return STATUS_ORDEM.includes(status as StatusOrdem)
}

function definirParametro(
  parametros: URLSearchParams,
  nome: string,
  valor: string | number | undefined,
) {
  if (valor === undefined || valor === '') {
    parametros.delete(nome)
    return
  }

  parametros.set(nome, String(valor))
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatarValor(valor: string) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? formatadorMoeda.format(numero) : '—'
}

function formatarData(data: string) {
  return formatadorData.format(new Date(data))
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
  return (
    <Icon>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Icon>
  )
}

function ClipboardIcon() {
  return (
    <Icon>
      <path d="M9 5h6M9 3h6v4H9z" />
      <path d="M7 5H5a2 2 0 0 0-2 2v13h18V7a2 2 0 0 0-2-2h-2M7 11h10M7 15h7" />
    </Icon>
  )
}

function WarningIcon() {
  return (
    <Icon>
      <path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      <path d="M12 8v5M12 17h.01" />
    </Icon>
  )
}

function ChevronLeftIcon() {
  return (
    <Icon>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  )
}

function ChevronRightIcon() {
  return (
    <Icon>
      <path d="m9 18 6-6-6-6" />
    </Icon>
  )
}
