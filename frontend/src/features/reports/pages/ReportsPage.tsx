import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { STATUS_ORDEM, STATUS_ORDEM_LABELS } from '../../../shared/types/ordem.types'
import { buscarRelatorioOperacional } from '../services/reports.service'
import type { RelatorioOperacional } from '../types/report.types'
import '../../operations.css'
import './ReportsPage.css'

export default function ReportsPage() {
  const padrao = periodoPadrao()
  const [filtros, setFiltros] = useState(padrao)
  const [dados, setDados] = useState<RelatorioOperacional | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    void buscarRelatorioOperacional(filtros, controller.signal).then(setDados).catch(error => { if (error instanceof Error && error.name !== 'AbortError') setErro(error.message) }).finally(() => setCarregando(false))
    return () => controller.abort()
  }, [filtros])

  function aplicar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setErro(''); setCarregando(true); setFiltros({ inicio: String(form.get('inicio')), fim: String(form.get('fim')) })
  }
  const maiorStatus = useMemo(() => dados ? Math.max(...Object.values(dados.porStatus), 1) : 1, [dados])

  return (
    <div className="operation-page reports-page">
      <header className="operation-header"><div><span>Inteligência da operação</span><h1>Relatórios</h1><p>Resultados de serviços, equipe, estoque e garantias em um só lugar.</p></div><button className="operation-secondary" type="button" onClick={() => window.print()}>Imprimir relatório</button></header>
      <form className="reports-filter" onSubmit={aplicar}><label>De<input name="inicio" type="date" defaultValue={filtros.inicio} required /></label><label>Até<input name="fim" type="date" defaultValue={filtros.fim} required /></label><button className="operation-primary">Aplicar período</button></form>
      {erro && <div className="operation-alert"><span>{erro}</span></div>}
      {carregando || !dados ? <div className="operation-loading">Gerando indicadores...</div> : <>
        <section className="operation-metrics reports-metrics"><Metric label="Serviços no período" value={String(dados.indicadores.totalOrdens)} hint={`${dados.indicadores.ordensEntregues} entregues`} /><Metric label="Recebido" value={moeda(dados.indicadores.totalRecebido)} hint={`${dados.indicadores.taxaConclusao.toFixed(1)}% de conclusão`} /><Metric label="Lucro estimado" value={moeda(dados.indicadores.lucroEstimado)} hint={`${moeda(dados.indicadores.custoPecas)} em peças`} /><Metric label="Ticket médio" value={moeda(dados.indicadores.ticketMedio)} hint={`${dados.indicadores.tempoMedioDias.toFixed(1)} dias em média`} /></section>
        <section className="reports-radar"><article className={dados.indicadores.produtosEstoqueBaixo ? 'is-warning' : ''}><span>Peças com estoque baixo</span><strong>{dados.indicadores.produtosEstoqueBaixo}</strong></article><article><span>Garantias ativas</span><strong>{dados.indicadores.garantiasAtivas}</strong></article><article><span>Valor dos serviços</span><strong>{moeda(dados.indicadores.valorServicos)}</strong></article></section>
        <div className="reports-grid"><section className="operation-card reports-status"><header><div><h2>Funil das ordens</h2><p>Distribuição por etapa no período</p></div></header><div>{STATUS_ORDEM.map(status => <article key={status}><span>{STATUS_ORDEM_LABELS[status]}</span><div><i style={{ width: `${(dados.porStatus[status] / maiorStatus) * 100}%` }} /></div><strong>{dados.porStatus[status]}</strong></article>)}</div></section><section className="operation-card"><header><div><h2>Equipamentos mais atendidos</h2><p>Demanda registrada nas ordens</p></div></header><ol className="reports-ranking">{dados.equipamentos.map((item, indice) => <li key={item.nome}><span>{indice + 1}</span><strong>{item.nome}</strong><em>{item.quantidade} serviços</em></li>)}{dados.equipamentos.length === 0 && <div className="operation-empty">Sem dados no período.</div>}</ol></section></div>
        <section className="operation-card"><header><div><h2>Produtividade por técnico</h2><p>Ordens atribuídas, entregas e valor movimentado</p></div></header><div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Técnico</th><th>Ordens</th><th>Entregues</th><th>Taxa de entrega</th><th>Valor</th></tr></thead><tbody>{dados.tecnicos.map(item => <tr key={item.id}><td><strong>{item.nome}</strong></td><td>{item.ordens}</td><td>{item.entregues}</td><td>{item.ordens ? ((item.entregues / item.ordens) * 100).toFixed(0) : 0}%</td><td>{moeda(item.valor)}</td></tr>)}</tbody></table>{dados.tecnicos.length === 0 && <div className="operation-empty">Atribua técnicos às ordens para visualizar a produtividade.</div>}</div></section>
      </>}
    </div>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) { return <article><span>{label}</span><strong>{value}</strong><small>{hint}</small></article> }
const moeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
function periodoPadrao() { const fim = new Date(); const inicio = new Date(fim.getTime() - 29 * 86_400_000); const iso = (data: Date) => data.toISOString().slice(0, 10); return { inicio: iso(inicio), fim: iso(fim) } }
