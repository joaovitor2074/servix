import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { acionarGarantia, buscarGarantia, listarGarantias } from '../services/warranties.service'
import type { GarantiaServico, StatusGarantiaExibicao } from '../types/warranty.types'
import '../../operations.css'
import './WarrantiesPage.css'

const ROTULOS: Record<StatusGarantiaExibicao, string> = { ATIVA: 'Ativa', EXPIRADA: 'Expirada', UTILIZADA: 'Acionada', CANCELADA: 'Cancelada' }

export default function WarrantiesPage() {
  const [garantias, setGarantias] = useState<GarantiaServico[]>([])
  const [selecionada, setSelecionada] = useState<GarantiaServico | null>(null)
  const [filtro, setFiltro] = useState<'TODAS' | StatusGarantiaExibicao>('TODAS')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [agora] = useState(() => Date.now())

  async function carregar(signal?: AbortSignal) {
    setGarantias(await listarGarantias(signal))
  }
  useEffect(() => {
    const controller = new AbortController()
    void listarGarantias(controller.signal).then(setGarantias).catch(error => { if (error instanceof Error && error.name !== 'AbortError') setErro(error.message) }).finally(() => setCarregando(false))
    return () => controller.abort()
  }, [])

  const filtradas = useMemo(() => garantias.filter(item => {
    const texto = `${item.ordem.numero} ${item.ordem.cliente.nome} ${item.ordem.equipamento} ${item.codigo}`.toLowerCase()
    return (filtro === 'TODAS' || item.statusExibicao === filtro) && texto.includes(busca.toLowerCase().trim())
  }), [busca, filtro, garantias])
  const ativas = garantias.filter(item => item.statusExibicao === 'ATIVA').length
  const expirando = garantias.filter(item => item.statusExibicao === 'ATIVA' && new Date(item.expiraEm).getTime() - agora <= 15 * 86_400_000).length

  async function abrirCertificado(id: number) {
    setErro('')
    try { setSelecionada(await buscarGarantia(id)) } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível abrir a garantia') }
  }
  async function acionar(item: GarantiaServico) {
    const observacao = window.prompt('Descreva o motivo do retorno em garantia:')?.trim()
    if (!observacao) return
    try { await acionarGarantia(item.id, observacao); await carregar(); setSelecionada(null) } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível acionar a garantia') }
  }

  return (
    <div className="operation-page warranties-page">
      <header className="operation-header"><div><span>Pós-atendimento</span><h1>Garantias</h1><p>Certificados gerados automaticamente quando uma ordem é entregue.</p></div></header>
      {erro && <div className="operation-alert" role="alert"><span>{erro}</span><button type="button" onClick={() => setErro('')}>×</button></div>}
      <section className="operation-metrics"><article><span>Garantias emitidas</span><strong>{garantias.length}</strong></article><article><span>Ativas</span><strong>{ativas}</strong></article><article className={expirando ? 'is-danger' : ''}><span>Expiram em até 15 dias</span><strong>{expirando}</strong></article></section>
      <section className="operation-toolbar"><input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Cliente, aparelho, OS ou código..." /><select value={filtro} onChange={event => setFiltro(event.target.value as typeof filtro)}><option value="TODAS">Todos os status</option>{Object.entries(ROTULOS).map(([valor, rotulo]) => <option value={valor} key={valor}>{rotulo}</option>)}</select></section>
      {carregando ? <div className="operation-loading">Carregando garantias...</div> : <section className="operation-card"><div className="operation-table-wrap"><table className="operation-table"><thead><tr><th>Garantia</th><th>Cliente e aparelho</th><th>Período</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filtradas.map(item => <tr key={item.id}><td><strong>OS #{item.ordem.numero}</strong><small>{item.codigo.slice(0, 8).toUpperCase()}</small></td><td><strong>{item.ordem.cliente.nome}</strong><small>{item.ordem.equipamento}</small></td><td><strong>Até {data(item.expiraEm)}</strong><small>{item.dias} dias</small></td><td><span className={`warranty-status warranty-status--${item.statusExibicao.toLowerCase()}`}>{ROTULOS[item.statusExibicao]}</span></td><td><div className="operation-row-actions"><button type="button" onClick={() => void abrirCertificado(item.id)}>Certificado</button><Link to={`/ordens/${item.ordem.id}`}>Ordem</Link>{item.statusExibicao === 'ATIVA' && <button type="button" onClick={() => void acionar(item)}>Acionar</button>}</div></td></tr>)}</tbody></table>{filtradas.length === 0 && <div className="operation-empty">Nenhuma garantia encontrada. Elas aparecerão após a entrega das ordens.</div>}</div></section>}
      {selecionada && <div className="warranty-modal" role="dialog" aria-modal="true" aria-label="Certificado de garantia"><div className="warranty-certificate"><header><div><span>Certificado de garantia</span><h2>{selecionada.empresa?.nome ?? 'Assistência técnica'}</h2></div><strong>OS #{selecionada.ordem.numero}</strong></header><section><dl><div><dt>Cliente</dt><dd>{selecionada.ordem.cliente.nome}</dd></div><div><dt>Equipamento</dt><dd>{selecionada.ordem.equipamento}</dd></div><div><dt>Serviço realizado</dt><dd>{selecionada.ordem.servicoRealizado || 'Conforme ordem de serviço'}</dd></div><div><dt>Validade</dt><dd>{data(selecionada.inicioEm)} a {data(selecionada.expiraEm)}</dd></div><div><dt>Código</dt><dd>{selecionada.codigo.toUpperCase()}</dd></div></dl><h3>Condições</h3><p>{selecionada.termos}</p></section><footer><button type="button" onClick={() => setSelecionada(null)}>Fechar</button><button className="operation-primary" type="button" onClick={() => window.print()}>Imprimir certificado</button></footer></div></div>}
    </div>
  )
}

const data = (valor: string) => new Intl.DateTimeFormat('pt-BR').format(new Date(valor))
