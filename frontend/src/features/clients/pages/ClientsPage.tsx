import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import type { RespostaPaginada } from '../../../shared/types/api.types'
import {
  excluirCliente,
  listarClientes,
  type ListarClientesFiltros,
} from '../services/clients.service'
import type { Cliente } from '../types/client.types'
import './ClientsPage.css'

const LIMITE_POR_PAGINA = 10

interface ResultadoCarregado {
  chave: string
  resposta: RespostaPaginada<Cliente>
}

interface FalhaCarregamento {
  chave: string
  mensagem: string
}

export default function ClientsPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [resultado, setResultado] = useState<ResultadoCarregado | null>(null)
  const [falha, setFalha] = useState<FalhaCarregamento | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(
    null,
  )
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState('')
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

    // Cada mudança de busca ou página cancela a requisição anterior. A chave
    // impede que dados de outra consulta sejam exibidos durante a transição.
    void listarClientes(filtros, { signal: controller.signal })
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

    const novosParametros = new URLSearchParams(searchParams)
    definirParametro(novosParametros, 'busca', busca || undefined)
    novosParametros.delete('pagina')
    setSearchParams(novosParametros)
  }

  function mudarPagina(pagina: number) {
    const novosParametros = new URLSearchParams(searchParams)
    definirParametro(
      novosParametros,
      'pagina',
      pagina > 1 ? pagina : undefined,
    )
    setSearchParams(novosParametros)
  }

  function limparBusca() {
    setSearchParams(new URLSearchParams())
  }

  function tentarNovamente() {
    setFalha(null)
    setTentativa(valor => valor + 1)
  }

  function solicitarExclusao(cliente: Cliente) {
    setErroExclusao('')
    setClienteParaExcluir(cliente)
  }

  async function confirmarExclusao() {
    if (!clienteParaExcluir || excluindo) return

    setExcluindo(true)
    setErroExclusao('')

    try {
      await excluirCliente(clienteParaExcluir.id)
      setClienteParaExcluir(null)
      setMensagemSucesso('Cliente excluído com sucesso.')

      // Refaz a consulta para que total, páginas e registros permaneçam de
      // acordo com o banco após a exclusão.
      setTentativa(valor => valor + 1)
    } catch (error) {
      setErroExclusao(
        error instanceof Error
          ? error.message
          : 'Não foi possível excluir o cliente',
      )
    } finally {
      setExcluindo(false)
    }
  }

  const possuiBusca = Boolean(filtros.busca)

  return (
    <div className="clients-page">
      <header className="clients-page__header">
        <div>
          <span className="clients-page__eyebrow">Relacionamento</span>
          <h1>Clientes</h1>
          <p>Gerencie os contatos atendidos pela sua empresa.</p>
        </div>

        <Link className="clients-page__create" to="/clientes/novo">
          <PlusIcon />
          Novo cliente
        </Link>
      </header>

      {mensagemSucesso && (
        <div className="clients-success" role="status">
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

      <section className="clients-filters" aria-label="Filtros dos clientes">
        <form className="clients-filters__search" onSubmit={handleBusca}>
          <label htmlFor="clients-search" className="sr-only">
            Buscar clientes
          </label>
          <SearchIcon />
          <input
            id="clients-search"
            key={filtros.busca ?? 'sem-busca'}
            name="busca"
            type="search"
            defaultValue={filtros.busca ?? ''}
            placeholder="Nome, telefone ou CPF/CNPJ..."
            maxLength={120}
          />
          <button type="submit">Buscar</button>
        </form>

        {possuiBusca && (
          <button
            className="clients-filters__clear"
            type="button"
            onClick={limparBusca}
          >
            Limpar busca
          </button>
        )}
      </section>

      {carregando && <ClientsSkeleton />}

      {falhaAtual && (
        <section className="clients-feedback" role="alert">
          <div className="clients-feedback__icon">
            <WarningIcon />
          </div>
          <h2>Não foi possível carregar os clientes</h2>
          <p>{falhaAtual.mensagem}</p>
          <button type="button" onClick={tentarNovamente}>
            Tentar novamente
          </button>
        </section>
      )}

      {respostaAtual && (
        <ClientsContent
          resposta={respostaAtual}
          possuiBusca={possuiBusca}
          onClearSearch={limparBusca}
          onChangePage={mudarPagina}
          onDelete={solicitarExclusao}
        />
      )}

      {clienteParaExcluir && (
        <DeleteClientDialog
          cliente={clienteParaExcluir}
          excluindo={excluindo}
          erro={erroExclusao}
          onCancel={() => {
            if (!excluindo) setClienteParaExcluir(null)
          }}
          onConfirm={() => void confirmarExclusao()}
        />
      )}
    </div>
  )
}

interface ClientsContentProps {
  resposta: RespostaPaginada<Cliente>
  possuiBusca: boolean
  onClearSearch: () => void
  onChangePage: (pagina: number) => void
  onDelete: (cliente: Cliente) => void
}

function ClientsContent({
  resposta,
  possuiBusca,
  onClearSearch,
  onChangePage,
  onDelete,
}: ClientsContentProps) {
  const { dados, paginacao } = resposta

  if (dados.length === 0) {
    return (
      <section className="clients-empty">
        <div className="clients-empty__icon">
          <UsersIcon />
        </div>
        <h2>
          {possuiBusca
            ? 'Nenhum cliente encontrado'
            : 'Nenhum cliente cadastrado'}
        </h2>
        <p>
          {possuiBusca
            ? 'Tente usar outro nome, telefone ou documento.'
            : 'Cadastre o primeiro cliente para começar os atendimentos.'}
        </p>
        {possuiBusca ? (
          <button type="button" onClick={onClearSearch}>
            Limpar busca
          </button>
        ) : (
          <Link to="/clientes/novo">Cadastrar cliente</Link>
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
    <section className="clients-card" aria-label="Lista de clientes">
      <div className="clients-card__summary" aria-live="polite">
        <strong>{paginacao.total.toLocaleString('pt-BR')} clientes</strong>
        <span>
          Exibindo {primeiroItem}–{ultimoItem}
        </span>
      </div>

      <div className="clients-table-wrapper">
        <table className="clients-table">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Telefone</th>
              <th scope="col">CPF/CNPJ</th>
              <th scope="col">Endereço</th>
              <th scope="col">Atualização</th>
              <th scope="col"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {dados.map(cliente => (
              <tr key={cliente.id}>
                <td data-label="Cliente">
                  <div className="clients-table__person">
                    <span className="clients-table__avatar" aria-hidden="true">
                      {obterIniciais(cliente.nome)}
                    </span>
                    <div className="clients-table__primary">
                      <strong>{cliente.nome}</strong>
                      <span>{cliente.email ?? 'Sem e-mail'}</span>
                    </div>
                  </div>
                </td>
                <td data-label="Telefone">
                  {formatarTelefone(cliente.telefone)}
                </td>
                <td data-label="CPF/CNPJ">
                  {formatarCpfCnpj(cliente.cpfCnpj)}
                </td>
                <td data-label="Endereço">
                  <span className="clients-table__address">
                    {cliente.endereco ?? 'Não informado'}
                  </span>
                </td>
                <td data-label="Atualização">
                  <time dateTime={cliente.atualizadoEm}>
                    {formatarData(cliente.atualizadoEm)}
                  </time>
                </td>
                <td data-label="Ações">
                  <div className="clients-table__actions">
                    <Link
                      to={`/clientes/${cliente.id}/editar`}
                      aria-label={`Editar ${cliente.nome}`}
                      title="Editar cliente"
                    >
                      <EditIcon />
                    </Link>
                    <button
                      type="button"
                      aria-label={`Excluir ${cliente.nome}`}
                      title="Excluir cliente"
                      onClick={() => onDelete(cliente)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="clients-pagination" aria-label="Paginação dos clientes">
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

interface DeleteClientDialogProps {
  cliente: Cliente
  excluindo: boolean
  erro: string
  onCancel: () => void
  onConfirm: () => void
}

function DeleteClientDialog({
  cliente,
  excluindo,
  erro,
  onCancel,
  onConfirm,
}: DeleteClientDialogProps) {
  const botaoCancelarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    botaoCancelarRef.current?.focus()

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !excluindo) onCancel()
    }

    document.addEventListener('keydown', fecharComEscape)

    return () => {
      document.body.style.overflow = overflowAnterior
      document.removeEventListener('keydown', fecharComEscape)
    }
  }, [excluindo, onCancel])

  return (
    <div className="clients-dialog-backdrop">
      <section
        className="clients-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-client-title"
        aria-describedby="delete-client-description"
      >
        <div className="clients-dialog__icon">
          <TrashIcon />
        </div>
        <h2 id="delete-client-title">Excluir cliente?</h2>
        <p id="delete-client-description">
          Você está prestes a excluir <strong>{cliente.nome}</strong>. Essa ação
          não poderá ser desfeita.
        </p>

        {erro && <p className="clients-dialog__error" role="alert">{erro}</p>}

        <div className="clients-dialog__actions">
          <button
            ref={botaoCancelarRef}
            type="button"
            disabled={excluindo}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="clients-dialog__confirm"
            type="button"
            disabled={excluindo}
            onClick={onConfirm}
          >
            {excluindo ? 'Excluindo...' : 'Excluir cliente'}
          </button>
        </div>
      </section>
    </div>
  )
}

function ClientsSkeleton() {
  return (
    <div className="clients-loading" aria-busy="true">
      <span className="sr-only">Carregando clientes</span>
      <div className="clients-skeleton clients-skeleton--summary" />
      {Array.from({ length: 6 }, (_, index) => (
        <div className="clients-skeleton clients-skeleton--row" key={index} />
      ))}
    </div>
  )
}

function lerFiltrosDaUrl(parametros: URLSearchParams): ListarClientesFiltros {
  const paginaRecebida = Number(parametros.get('pagina'))
  const buscaRecebida = parametros.get('busca')?.trim()

  return {
    pagina:
      Number.isInteger(paginaRecebida) && paginaRecebida > 0
        ? paginaRecebida
        : 1,
    limite: LIMITE_POR_PAGINA,
    ...(buscaRecebida ? { busca: buscaRecebida } : {}),
  }
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

function obterIniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return 'C'
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase()
  return `${partes[0].charAt(0)}${partes.at(-1)?.charAt(0)}`.toUpperCase()
}

function formatarTelefone(telefone: string) {
  const digitos = telefone.replace(/\D/g, '')

  if (digitos.length === 11) {
    return digitos.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  if (digitos.length === 10) {
    return digitos.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }

  return telefone
}

function formatarCpfCnpj(valor: string | null) {
  if (!valor) return 'Não informado'
  const digitos = valor.replace(/\D/g, '')

  if (digitos.length === 11) {
    return digitos.replace(
      /(\d{3})(\d{3})(\d{3})(\d{2})/,
      '$1.$2.$3-$4',
    )
  }

  if (digitos.length === 14) {
    return digitos.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      '$1.$2.$3/$4-$5',
    )
  }

  return valor
}

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

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

function PlusIcon() {
  return <Icon><path d="M12 5v14M5 12h14" /></Icon>
}

function SearchIcon() {
  return <Icon><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Icon>
}

function UsersIcon() {
  return <Icon><path d="M16 19v-1.5a4.5 4.5 0 0 0-4.5-4.5h-4A4.5 4.5 0 0 0 3 17.5V19" /><circle cx="9.5" cy="7" r="4" /><path d="M17 11a3.5 3.5 0 0 1 4 3.5V16" /></Icon>
}

function EditIcon() {
  return <Icon><path d="m4 20 4.2-1 10.5-10.5-3.2-3.2L5 15.8 4 20Z" /><path d="m13.8 7 3.2 3.2" /></Icon>
}

function TrashIcon() {
  return <Icon><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></Icon>
}

function WarningIcon() {
  return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon>
}

function CheckIcon() {
  return <Icon><path d="m5 12 4 4L19 6" /></Icon>
}

function CloseIcon() {
  return <Icon><path d="m6 6 12 12M18 6 6 18" /></Icon>
}

function ChevronLeftIcon() {
  return <Icon><path d="m15 18-6-6 6-6" /></Icon>
}

function ChevronRightIcon() {
  return <Icon><path d="m9 18 6-6-6-6" /></Icon>
}
