import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import type { RespostaPaginada } from '../../../shared/types/api.types'
import BudgetStatusBadge from '../components/BudgetStatusBadge'
import {
  listarOrcamentos,
  type ListarOrcamentosFiltros,
} from '../services/budgets.service'
import {
  STATUS_ORCAMENTO,
  STATUS_ORCAMENTO_LABELS,
  type Orcamento,
  type StatusOrcamento,
} from '../types/budget.types'
import {
  formatarData,
  formatarMoeda,
  formatarNumeroOrcamento,
} from '../utils/budget-formatters'
import './BudgetsPage.css'

const LIMITE_POR_PAGINA = 10

interface ResultadoCarregado {
  chave: string
  resposta: RespostaPaginada<Orcamento>
}

interface FalhaCarregamento {
  chave: string
  mensagem: string
}

export default function BudgetsPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [resultado, setResultado] = useState<ResultadoCarregado | null>(null)
  const [falha, setFalha] = useState<FalhaCarregamento | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [mensagemSucesso, setMensagemSucesso] = useState(() =>
    lerMensagemDaNavegacao(location.state),
  )

  const chaveConsulta = searchParams.toString()
  const filtros = useMemo(
    () => lerFiltrosDaUrl(new URLSearchParams(chaveConsulta)),
    [chaveConsulta],
  )

  useEffect(() => {
    const controller = new AbortController()

    void listarOrcamentos(filtros, { signal: controller.signal })
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
              : 'Não foi possível carregar os orçamentos',
        })
      })

    return () => controller.abort()
  }, [chaveConsulta, filtros, tentativa])

  const respostaAtual =
    resultado?.chave === chaveConsulta ? resultado.resposta : null
  const falhaAtual = falha?.chave === chaveConsulta ? falha : null
  const carregando = !respostaAtual && !falhaAtual
  const possuiFiltros = Boolean(filtros.busca || filtros.status)

  function handleBusca(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const dados = new FormData(event.currentTarget)
    const busca = String(dados.get('busca') ?? '').trim()
    atualizarParametros({ busca: busca || undefined, pagina: 1 })
  }

  function atualizarParametros(
    alteracoes: Partial<ListarOrcamentosFiltros>,
  ) {
    const novosParametros = new URLSearchParams(searchParams)

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

  return (
    <div className="budgets-page">
      <header className="budgets-page__header">
        <div>
          <span className="budgets-page__eyebrow">Comercial</span>
          <h1>Orçamentos</h1>
          <p>Prepare propostas, acompanhe aprovações e gere ordens de serviço.</p>
        </div>
        <Link className="budgets-page__create" to="/orcamentos/novo">
          <PlusIcon />
          Novo orçamento
        </Link>
      </header>

      {mensagemSucesso && (
        <div className="budgets-success" role="status">
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

      <section className="budgets-filters" aria-label="Filtros dos orçamentos">
        <form className="budgets-filters__search" onSubmit={handleBusca}>
          <label htmlFor="budgets-search" className="sr-only">
            Buscar orçamentos
          </label>
          <SearchIcon />
          <input
            id="budgets-search"
            key={filtros.busca ?? 'sem-busca'}
            name="busca"
            type="search"
            defaultValue={filtros.busca ?? ''}
            placeholder="Cliente, equipamento ou problema..."
            maxLength={120}
          />
          <button type="submit">Buscar</button>
        </form>

        <label className="budgets-filters__status">
          <span>Status</span>
          <select
            value={filtros.status ?? ''}
            onChange={event =>
              atualizarParametros({
                status: statusEhValido(event.target.value)
                  ? event.target.value
                  : undefined,
                pagina: 1,
              })
            }
          >
            <option value="">Todos os status</option>
            {STATUS_ORCAMENTO.map(status => (
              <option key={status} value={status}>
                {STATUS_ORCAMENTO_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        {possuiFiltros && (
          <button
            className="budgets-filters__clear"
            type="button"
            onClick={() => setSearchParams(new URLSearchParams())}
          >
            Limpar filtros
          </button>
        )}
      </section>

      {carregando && <BudgetsSkeleton />}

      {falhaAtual && (
        <section className="budgets-feedback" role="alert">
          <div className="budgets-feedback__icon">
            <WarningIcon />
          </div>
          <h2>Não foi possível carregar os orçamentos</h2>
          <p>{falhaAtual.mensagem}</p>
          <button
            type="button"
            onClick={() => {
              setFalha(null)
              setTentativa(valor => valor + 1)
            }}
          >
            Tentar novamente
          </button>
        </section>
      )}

      {respostaAtual && (
        <BudgetsContent
          resposta={respostaAtual}
          possuiFiltros={possuiFiltros}
          onClearFilters={() => setSearchParams(new URLSearchParams())}
          onChangePage={pagina => atualizarParametros({ pagina })}
        />
      )}
    </div>
  )
}

function BudgetsContent({
  resposta,
  possuiFiltros,
  onClearFilters,
  onChangePage,
}: {
  resposta: RespostaPaginada<Orcamento>
  possuiFiltros: boolean
  onClearFilters: () => void
  onChangePage: (pagina: number) => void
}) {
  const { dados, paginacao } = resposta

  if (dados.length === 0) {
    return (
      <section className="budgets-empty">
        <div className="budgets-empty__icon"><QuoteIcon /></div>
        <h2>
          {possuiFiltros
            ? 'Nenhum orçamento encontrado'
            : 'Nenhum orçamento cadastrado'}
        </h2>
        <p>
          {possuiFiltros
            ? 'Tente usar outros termos ou remover os filtros.'
            : 'Crie o primeiro orçamento para iniciar um atendimento seguro.'}
        </p>
        {possuiFiltros ? (
          <button type="button" onClick={onClearFilters}>Limpar filtros</button>
        ) : (
          <Link to="/orcamentos/novo">Criar primeiro orçamento</Link>
        )}
      </section>
    )
  }

  const primeiroItem = (paginacao.pagina - 1) * paginacao.limite + 1
  const ultimoItem = Math.min(
    paginacao.pagina * paginacao.limite,
    paginacao.total,
  )

  return (
    <section className="budgets-card" aria-label="Lista de orçamentos">
      <div className="budgets-card__summary" aria-live="polite">
        <strong>{paginacao.total.toLocaleString('pt-BR')} orçamentos</strong>
        <span>Exibindo {primeiroItem}–{ultimoItem}</span>
      </div>

      <div className="budgets-table-wrapper">
        <table className="budgets-table">
          <thead>
            <tr>
              <th scope="col">Orçamento</th>
              <th scope="col">Cliente</th>
              <th scope="col">Equipamento</th>
              <th scope="col">Status</th>
              <th scope="col">Total</th>
              <th scope="col">Validade</th>
              <th scope="col" className="budgets-table__actions-heading">Ações</th>
            </tr>
          </thead>
          <tbody>
            {dados.map(orcamento => (
              <tr key={orcamento.id}>
                <td data-label="Orçamento">
                  <strong className="budgets-table__id">
                    {formatarNumeroOrcamento(orcamento.numero)}
                  </strong>
                </td>
                <td data-label="Cliente">
                  <div className="budgets-table__primary">
                    <strong>{orcamento.cliente.nome}</strong>
                    <span>{orcamento.cliente.telefone}</span>
                  </div>
                </td>
                <td data-label="Equipamento">
                  <div className="budgets-table__primary">
                    <strong>{orcamento.equipamento}</strong>
                    <span>{orcamento.descricaoProblema}</span>
                  </div>
                </td>
                <td data-label="Status">
                  <BudgetStatusBadge status={orcamento.status} />
                </td>
                <td data-label="Total">
                  <strong>{formatarMoeda(orcamento.total)}</strong>
                </td>
                <td data-label="Validade">
                  <time dateTime={orcamento.validade ?? undefined}>
                    {formatarData(orcamento.validade)}
                  </time>
                </td>
                <td data-label="Ações" className="budgets-table__actions">
                  <Link
                    to={`/orcamentos/${orcamento.id}`}
                    aria-label={`Ver orçamento ${orcamento.numero}`}
                    title="Ver detalhes"
                  >
                    <EyeIcon />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="budgets-pagination" aria-label="Paginação dos orçamentos">
        <button
          type="button"
          disabled={paginacao.pagina <= 1}
          onClick={() => onChangePage(paginacao.pagina - 1)}
        >
          <ChevronLeftIcon /> Anterior
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
          Próxima <ChevronRightIcon />
        </button>
      </nav>
    </section>
  )
}

function BudgetsSkeleton() {
  return (
    <div className="budgets-loading" aria-busy="true">
      <span className="sr-only">Carregando orçamentos</span>
      <div className="budgets-skeleton budgets-skeleton--summary" />
      {Array.from({ length: 6 }, (_, index) => (
        <div className="budgets-skeleton budgets-skeleton--row" key={index} />
      ))}
    </div>
  )
}

function lerFiltrosDaUrl(parametros: URLSearchParams): ListarOrcamentosFiltros {
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
    ...(statusEhValido(statusRecebido) ? { status: statusRecebido } : {}),
  }
}

function statusEhValido(status: string | null): status is StatusOrcamento {
  return STATUS_ORCAMENTO.includes(status as StatusOrcamento)
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

function Icon({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg>
}

function SearchIcon() { return <Icon><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Icon> }
function PlusIcon() { return <Icon><path d="M12 5v14M5 12h14" /></Icon> }
function CheckIcon() { return <Icon><path d="m5 12 4 4L19 6" /></Icon> }
function EyeIcon() { return <Icon><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></Icon> }
function QuoteIcon() { return <Icon><path d="M6 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z" /><path d="M8 8h8M8 12h6" /></Icon> }
function WarningIcon() { return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon> }
function ChevronLeftIcon() { return <Icon><path d="m15 18-6-6 6-6" /></Icon> }
function ChevronRightIcon() { return <Icon><path d="m9 18 6-6-6-6" /></Icon> }
