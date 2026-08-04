import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  listarMovimentacoesOrdemEstoque,
  listarProdutosEstoque,
  movimentarEstoque,
} from '../../inventory/services/inventory.service'
import type {
  MovimentacaoEstoque,
  ProdutoEstoque,
} from '../../inventory/types/inventory.types'
import './OrderPartsPanel.css'

interface OrderPartsPanelProps {
  ordemId: number
  ordemNumero: number
  podeMovimentar: boolean
  ordemEncerrada: boolean
  onClose: () => void
}

export default function OrderPartsPanel({
  ordemId,
  ordemNumero,
  podeMovimentar,
  ordemEncerrada,
  onClose,
}: OrderPartsPanelProps) {
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([])
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([])
  const [quantidades, setQuantidades] = useState<Record<number, number>>({})
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvandoProdutoId, setSalvandoProdutoId] = useState<number | null>(null)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', fecharComEscape)

    void Promise.all([
      listarProdutosEstoque(controller.signal),
      listarMovimentacoesOrdemEstoque(ordemId, controller.signal),
    ])
      .then(([listaProdutos, listaMovimentacoes]) => {
        setProdutos(listaProdutos)
        setMovimentacoes(listaMovimentacoes)
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErro(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as peças do estoque.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false)
      })

    return () => {
      controller.abort()
      window.removeEventListener('keydown', fecharComEscape)
      document.body.style.overflow = overflowAnterior
    }
  }, [onClose, ordemId, tentativa])

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    if (!termo) return produtos

    return produtos.filter(produto =>
      `${produto.nome} ${produto.sku ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(termo),
    )
  }, [busca, produtos])

  const resumo = useMemo(() => ({
    cadastradas: produtos.length,
    disponiveis: produtos.filter(produto => produto.quantidade > 0).length,
    unidades: produtos.reduce((total, produto) => total + produto.quantidade, 0),
  }), [produtos])

  const usosNaOrdem = movimentacoes.filter(
    movimentacao => movimentacao.tipo === 'SAIDA_ORDEM',
  )

  async function registrarUso(produto: ProdutoEstoque) {
    if (salvandoProdutoId !== null || produto.quantidade <= 0) return

    const quantidade = Math.max(
      1,
      Math.min(quantidades[produto.id] ?? 1, produto.quantidade),
    )
    setSalvandoProdutoId(produto.id)
    setErro('')
    setMensagem('')

    try {
      const resultado = await movimentarEstoque({
        produtoId: produto.id,
        tipo: 'SAIDA_ORDEM',
        quantidade,
        ordemId,
        observacao: `Peça utilizada na OS #${ordemNumero}`,
      })

      setProdutos(atuais => atuais.map(item =>
        item.id === produto.id ? resultado.produto : item,
      ))
      setMovimentacoes(atuais => [resultado.movimentacao, ...atuais])
      setQuantidades(atuais => ({ ...atuais, [produto.id]: 1 }))
      setMensagem(
        `${quantidade} ${produto.unidade} de ${produto.nome} vinculada à ordem.`,
      )
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar a peça nesta ordem.',
      )
    } finally {
      setSalvandoProdutoId(null)
    }
  }

  return (
    <div
      className="order-parts-overlay"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="order-parts-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-parts-title"
      >
        <header className="order-parts-panel__header">
          <div className="order-parts-panel__heading">
            <span className="order-parts-panel__icon" aria-hidden="true">P</span>
            <div>
              <span>Estoque da assistência</span>
              <h2 id="order-parts-title">Peças da ordem #{ordemNumero}</h2>
              <p>Consulte o saldo atual e veja o que já foi usado neste atendimento.</p>
            </div>
          </div>
          <button
            className="order-parts-panel__close"
            type="button"
            onClick={onClose}
            aria-label="Fechar peças da ordem"
            autoFocus
          >
            ×
          </button>
        </header>

        <div className="order-parts-panel__summary" aria-label="Resumo do estoque">
          <article><span>Peças cadastradas</span><strong>{resumo.cadastradas}</strong></article>
          <article><span>Com saldo</span><strong>{resumo.disponiveis}</strong></article>
          <article><span>Unidades disponíveis</span><strong>{resumo.unidades}</strong></article>
        </div>

        {!podeMovimentar && (
          <div className="order-parts-panel__permission" role="note">
            <strong>Consulta de estoque</strong>
            <span>Somente administradores e técnicos podem dar baixa em peças.</span>
          </div>
        )}

        {ordemEncerrada && (
          <div className="order-parts-panel__permission" role="note">
            <strong>Ordem encerrada</strong>
            <span>O estoque continua visível, mas não aceita novas baixas.</span>
          </div>
        )}

        {mensagem && <div className="order-parts-panel__message" role="status">{mensagem}</div>}
        {erro && (
          <div className="order-parts-panel__error" role="alert">
            <span>{erro}</span>
            {!produtos.length && (
              <button
                type="button"
                onClick={() => {
                  setCarregando(true)
                  setErro('')
                  setTentativa(valor => valor + 1)
                }}
              >
                Tentar novamente
              </button>
            )}
          </div>
        )}

        <div className="order-parts-panel__toolbar">
          <label>
            <span className="sr-only">Buscar peça no estoque</span>
            <input
              type="search"
              value={busca}
              onChange={event => setBusca(event.target.value)}
              placeholder="Buscar por nome ou SKU"
            />
          </label>
          <Link to="/estoque" onClick={onClose}>Gerenciar estoque</Link>
        </div>

        <div className="order-parts-panel__content">
          <section className="order-parts-catalog" aria-labelledby="order-parts-catalog-title">
            <header>
              <div>
                <h3 id="order-parts-catalog-title">Peças disponíveis</h3>
                <p>{produtosFiltrados.length} resultado(s) no estoque da empresa</p>
              </div>
            </header>

            {carregando ? (
              <div className="order-parts-panel__loading" role="status">Carregando peças...</div>
            ) : produtosFiltrados.length ? (
              <div className="order-parts-list">
                {produtosFiltrados.map(produto => {
                  const quantidade = Math.max(
                    1,
                    Math.min(quantidades[produto.id] ?? 1, Math.max(produto.quantidade, 1)),
                  )
                  const semSaldo = produto.quantidade <= 0
                  const podeRegistrar = podeMovimentar && !ordemEncerrada && !semSaldo

                  return (
                    <article className="order-parts-item" key={produto.id}>
                      <div className="order-parts-item__identity">
                        <span aria-hidden="true">{obterSigla(produto.nome)}</span>
                        <div>
                          <strong>{produto.nome}</strong>
                          <small>{produto.sku || 'Sem SKU'} · {moeda(Number(produto.precoVenda))}</small>
                        </div>
                      </div>
                      <span className={produto.estoqueBaixo ? 'order-parts-stock order-parts-stock--low' : 'order-parts-stock'}>
                        <strong>{produto.quantidade}</strong> {produto.unidade}
                        <small>{semSaldo ? 'sem saldo' : produto.estoqueBaixo ? 'estoque baixo' : 'disponível'}</small>
                      </span>
                      {podeRegistrar ? (
                        <div className="order-parts-item__action">
                          <label>
                            <span>Qtd.</span>
                            <input
                              type="number"
                              min="1"
                              max={produto.quantidade}
                              value={quantidade}
                              onChange={event => setQuantidades(atuais => ({
                                ...atuais,
                                [produto.id]: Math.max(1, Math.min(Number(event.target.value) || 1, produto.quantidade)),
                              }))}
                            />
                          </label>
                          <button
                            type="button"
                            disabled={salvandoProdutoId !== null}
                            onClick={() => void registrarUso(produto)}
                          >
                            {salvandoProdutoId === produto.id ? 'Registrando...' : 'Usar na ordem'}
                          </button>
                        </div>
                      ) : (
                        <span className="order-parts-item__view-only">
                          {semSaldo ? 'Indisponível' : 'Somente consulta'}
                        </span>
                      )}
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="order-parts-panel__empty">
                <strong>{busca ? 'Nenhuma peça encontrada' : 'Estoque ainda vazio'}</strong>
                <p>{busca ? 'Tente buscar por outro nome ou SKU.' : 'Cadastre as peças usadas pela assistência para consultá-las nas ordens.'}</p>
                {!busca && <Link to="/estoque" onClick={onClose}>Cadastrar primeira peça</Link>}
              </div>
            )}
          </section>

          <aside className="order-parts-used" aria-labelledby="order-parts-used-title">
            <header>
              <span>Histórico da ordem</span>
              <h3 id="order-parts-used-title">Peças já utilizadas</h3>
            </header>
            {usosNaOrdem.length ? (
              <div>
                {usosNaOrdem.map(movimentacao => (
                  <article key={movimentacao.id}>
                    <span>−{movimentacao.quantidade}</span>
                    <div>
                      <strong>{movimentacao.produto.nome}</strong>
                      <small>{movimentacao.criadoPor?.nome ?? 'Equipe'} · {dataHora(movimentacao.criadoEm)}</small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="order-parts-used__empty">
                <strong>Nenhuma baixa registrada</strong>
                <p>As peças usadas nesta ordem aparecerão aqui.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatadorDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function moeda(valor: number) {
  return Number.isFinite(valor) ? formatadorMoeda.format(valor) : 'R$ 0,00'
}

function dataHora(valor: string) {
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? 'Agora' : formatadorDataHora.format(data)
}

function obterSigla(nome: string) {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(parte => parte[0]?.toUpperCase() ?? '')
    .join('')
}
