import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { listarOrdens } from '../../orders/services/orders.service'
import type { OrdemServico } from '../../../shared/types/ordem.types'
import { criarProdutoEstoque, listarMovimentacoesEstoque, listarProdutosEstoque, movimentarEstoque } from '../services/inventory.service'
import type { MovimentacaoEstoque, ProdutoEstoque, TipoMovimentacaoEstoque } from '../types/inventory.types'
import '../../operations.css'
import './InventoryPage.css'

export default function InventoryPage() {
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([])
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([])
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [mostrarProduto, setMostrarProduto] = useState(false)
  const [mostrarMovimento, setMostrarMovimento] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function carregar(signal?: AbortSignal) {
    const [listaProdutos, listaMovimentos, listaOrdens] = await Promise.all([
      listarProdutosEstoque(signal), listarMovimentacoesEstoque(signal), listarOrdens({ limite: 100 }, { signal }),
    ])
    setProdutos(listaProdutos)
    setMovimentacoes(listaMovimentos)
    setOrdens(listaOrdens.dados.filter(item => !['ENTREGUE', 'CANCELADO'].includes(item.status)))
  }

  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      listarProdutosEstoque(controller.signal),
      listarMovimentacoesEstoque(controller.signal),
      listarOrdens({ limite: 100 }, { signal: controller.signal }),
    ]).then(([listaProdutos, listaMovimentos, listaOrdens]) => {
      setProdutos(listaProdutos)
      setMovimentacoes(listaMovimentos)
      setOrdens(listaOrdens.dados.filter(item => !['ENTREGUE', 'CANCELADO'].includes(item.status)))
    }).catch(error => { if (error instanceof Error && error.name !== 'AbortError') setErro(error.message) }).finally(() => setCarregando(false))
    return () => controller.abort()
  }, [])

  const indicadores = useMemo(() => ({
    itens: produtos.length,
    unidades: produtos.reduce((soma, item) => soma + item.quantidade, 0),
    baixos: produtos.filter(item => item.estoqueBaixo).length,
    valor: produtos.reduce((soma, item) => soma + item.quantidade * Number(item.custoUnitario), 0),
  }), [produtos])

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSalvando(true); setErro('')
    const dados = new FormData(event.currentTarget)
    try {
      await criarProdutoEstoque({
        nome: String(dados.get('nome')), sku: String(dados.get('sku') || ''), unidade: String(dados.get('unidade') || 'un'),
        quantidade: Number(dados.get('quantidade')), estoqueMinimo: Number(dados.get('estoqueMinimo')),
        custoUnitario: Number(dados.get('custoUnitario')), precoVenda: Number(dados.get('precoVenda')),
      })
      event.currentTarget.reset(); setMostrarProduto(false); setMensagem('Peça cadastrada com saldo inicial.'); await carregar()
    } catch (error) { setErro(error instanceof Error ? error.message : 'Erro ao cadastrar peça') } finally { setSalvando(false) }
  }

  async function movimentar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSalvando(true); setErro('')
    const dados = new FormData(event.currentTarget)
    const tipo = String(dados.get('tipo')) as TipoMovimentacaoEstoque
    try {
      await movimentarEstoque({
        produtoId: Number(dados.get('produtoId')), tipo, quantidade: Number(dados.get('quantidade')),
        ...(dados.get('ordemId') ? { ordemId: Number(dados.get('ordemId')) } : {}), observacao: String(dados.get('observacao') || ''),
      })
      event.currentTarget.reset(); setMostrarMovimento(false); setMensagem('Movimentação registrada e saldo atualizado.'); await carregar()
    } catch (error) { setErro(error instanceof Error ? error.message : 'Erro ao movimentar estoque') } finally { setSalvando(false) }
  }

  return (
    <div className="operation-page inventory-page">
      <header className="operation-header"><div><span>Peças e materiais</span><h1>Estoque</h1><p>Controle entradas, consumo por ordem e alertas de reposição.</p></div><div className="operation-actions"><button className="operation-secondary" type="button" onClick={() => setMostrarMovimento(valor => !valor)}>Movimentar</button><button className="operation-primary" type="button" onClick={() => setMostrarProduto(valor => !valor)}>Nova peça</button></div></header>
      {erro && <div className="operation-alert" role="alert"><span>{erro}</span><button type="button" onClick={() => setErro('')}>×</button></div>}
      {mensagem && <div className="operation-success" role="status">{mensagem}</div>}
      <section className="operation-metrics">
        <Metric label="Peças cadastradas" value={String(indicadores.itens)} /><Metric label="Unidades em estoque" value={String(indicadores.unidades)} /><Metric label="Estoque baixo" value={String(indicadores.baixos)} danger={indicadores.baixos > 0} /><Metric label="Capital em peças" value={moeda(indicadores.valor)} />
      </section>

      {mostrarProduto && <form className="operation-form" onSubmit={cadastrar}><header><h2>Cadastrar nova peça</h2><p>O saldo inicial também ficará registrado no histórico.</p></header><div className="operation-form__grid"><label>Nome<input name="nome" required maxLength={160} /></label><label>SKU<input name="sku" maxLength={80} /></label><label>Unidade<input name="unidade" defaultValue="un" required /></label><label>Saldo inicial<input name="quantidade" type="number" min="0" defaultValue="0" required /></label><label>Estoque mínimo<input name="estoqueMinimo" type="number" min="0" defaultValue="1" required /></label><label>Custo unitário<input name="custoUnitario" type="number" min="0" step="0.01" defaultValue="0" required /></label><label>Preço de venda<input name="precoVenda" type="number" min="0" step="0.01" defaultValue="0" required /></label></div><footer><button type="button" onClick={() => setMostrarProduto(false)}>Cancelar</button><button className="operation-primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Cadastrar peça'}</button></footer></form>}

      {mostrarMovimento && <form className="operation-form" onSubmit={movimentar}><header><h2>Movimentar estoque</h2><p>Para saídas de serviço, selecione a ordem que utilizou a peça.</p></header><div className="operation-form__grid"><label>Peça<select name="produtoId" required defaultValue=""><option value="" disabled>Selecione</option>{produtos.map(item => <option key={item.id} value={item.id}>{item.nome} · saldo {item.quantidade}</option>)}</select></label><label>Movimento<select name="tipo" required defaultValue="SAIDA_ORDEM"><option value="SAIDA_ORDEM">Saída para ordem</option><option value="ENTRADA">Entrada de compra</option><option value="AJUSTE_ENTRADA">Ajuste de entrada</option><option value="AJUSTE_SAIDA">Ajuste de saída</option><option value="ESTORNO">Estorno / devolução</option></select></label><label>Quantidade<input name="quantidade" type="number" min="1" defaultValue="1" required /></label><label>Ordem de serviço<select name="ordemId" defaultValue=""><option value="">Sem ordem vinculada</option>{ordens.map(item => <option key={item.id} value={item.id}>#{item.numero} · {item.cliente.nome}</option>)}</select></label><label className="operation-field-wide">Observação<input name="observacao" maxLength={500} placeholder="Compra, ajuste ou peça utilizada" /></label></div><footer><button type="button" onClick={() => setMostrarMovimento(false)}>Cancelar</button><button className="operation-primary" disabled={salvando}>{salvando ? 'Registrando...' : 'Registrar movimento'}</button></footer></form>}

      {carregando ? <div className="operation-loading">Carregando estoque...</div> : <div className="inventory-grid"><section className="operation-card"><header><div><h2>Catálogo de peças</h2><p>Saldos e preços atuais</p></div></header><div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Peça</th><th>Saldo</th><th>Mínimo</th><th>Custo</th><th>Venda</th></tr></thead><tbody>{produtos.map(item => <tr key={item.id}><td><strong>{item.nome}</strong><small>{item.sku || 'Sem SKU'}</small></td><td><span className={item.estoqueBaixo ? 'stock-badge stock-badge--low' : 'stock-badge'}>{item.quantidade} {item.unidade}</span></td><td>{item.estoqueMinimo}</td><td>{moeda(Number(item.custoUnitario))}</td><td>{moeda(Number(item.precoVenda))}</td></tr>)}</tbody></table>{produtos.length === 0 && <div className="operation-empty">Cadastre a primeira peça para começar.</div>}</div></section><section className="operation-card"><header><div><h2>Movimentações recentes</h2><p>Histórico auditável do saldo</p></div></header><div className="inventory-movements">{movimentacoes.map(item => <article key={item.id}><span className={adiciona(item.tipo) ? 'is-in' : 'is-out'}>{adiciona(item.tipo) ? '+' : '−'}{item.quantidade}</span><div><strong>{item.produto.nome}</strong><small>{rotuloMovimento(item.tipo)}{item.ordem ? ` · OS #${item.ordem.numero}` : ''}</small></div><time>{dataHora(item.criadoEm)}</time>{item.ordem && <Link to={`/ordens/${item.ordem.id}`}>Ver</Link>}</article>)}</div></section></div>}
    </div>
  )
}

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) { return <article className={danger ? 'is-danger' : ''}><span>{label}</span><strong>{value}</strong></article> }
const moeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
const dataHora = (data: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data))
const adiciona = (tipo: TipoMovimentacaoEstoque) => ['ENTRADA', 'AJUSTE_ENTRADA', 'ESTORNO'].includes(tipo)
const rotuloMovimento = (tipo: TipoMovimentacaoEstoque) => ({ ENTRADA: 'Entrada', SAIDA_ORDEM: 'Uso na ordem', AJUSTE_ENTRADA: 'Ajuste de entrada', AJUSTE_SAIDA: 'Ajuste de saída', ESTORNO: 'Devolução' })[tipo]
