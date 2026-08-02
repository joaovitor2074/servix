import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  buscarCentralWhatsApp,
  enviarMensagemWhatsApp,
} from '../services/communication.service'
import type {
  CentralWhatsApp,
  OrigemMensagemWhatsApp,
} from '../types/communication.types'
import '../../operations.css'
import './WhatsAppPage.css'

type Fila = 'ORDENS' | 'ORCAMENTOS' | 'GARANTIAS'
interface ItemExibicao {
  id: number
  origem: OrigemMensagemWhatsApp
  numero: number
  equipamento: string
  atualizadoEm: string
  cliente: { nome: string; telefone: string }
  mensagem: string
  link: string
  contexto: string
}

export default function WhatsAppPage({ podeConfigurar = false }: { podeConfigurar?: boolean }) {
  const [dados, setDados] = useState<CentralWhatsApp | null>(null)
  const [fila, setFila] = useState<Fila>('ORDENS')
  const [busca, setBusca] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [copiado, setCopiado] = useState<number | null>(null)
  const [enviando, setEnviando] = useState<number | null>(null)

  async function carregar(signal?: AbortSignal) {
    try { setDados(await buscarCentralWhatsApp(signal)) }
    catch (error) { if (error instanceof Error && error.name !== 'AbortError') setErro(error.message) }
  }

  useEffect(() => {
    const controller = new AbortController()
    void buscarCentralWhatsApp(controller.signal)
      .then(setDados)
      .catch(error => { if (error instanceof Error && error.name !== 'AbortError') setErro(error.message) })
    return () => controller.abort()
  }, [])

  const itens = useMemo<ItemExibicao[]>(() => {
    if (!dados) return []
    const origem: ItemExibicao[] = fila === 'ORDENS'
      ? dados.ordens.map(item => ({ id: item.id, origem: 'ORDEM', numero: item.numero, equipamento: item.equipamento, atualizadoEm: item.atualizadoEm, cliente: item.cliente, mensagem: item.mensagem, link: `${window.location.origin}/acompanhar/${item.tokenAcompanhamento}`, contexto: `OS #${item.numero}` }))
      : fila === 'ORCAMENTOS'
        ? dados.orcamentos.map(item => ({ id: item.id, origem: 'ORCAMENTO', numero: item.numero, equipamento: item.equipamento, atualizadoEm: item.atualizadoEm, cliente: item.cliente, mensagem: item.mensagem, link: `${window.location.origin}/orcamento/${item.tokenPublico}`, contexto: `Orçamento #${item.numero}` }))
        : dados.garantias.map(item => ({ id: item.id, origem: 'GARANTIA', numero: item.ordem.numero, equipamento: item.ordem.equipamento, atualizadoEm: item.atualizadoEm, cliente: item.ordem.cliente, mensagem: item.mensagem, link: `${window.location.origin}/acompanhar/${item.ordem.tokenAcompanhamento}`, contexto: `Garantia ${item.codigo}` }))
    const termo = busca.toLowerCase().trim()
    return origem.filter(item => `${item.cliente.nome} ${item.cliente.telefone} ${item.numero} ${item.equipamento} ${item.contexto}`.toLowerCase().includes(termo))
  }, [busca, dados, fila])

  const montarMensagem = (item: ItemExibicao) => item.mensagem.replaceAll('{{link}}', item.link)

  async function enviar(item: ItemExibicao) {
    setEnviando(item.id); setErro(''); setSucesso('')
    try {
      const resultado = await enviarMensagemWhatsApp(item.origem, item.id)
      if (resultado.modoEnvio === 'LINK_MANUAL') {
        window.open(resultado.url, '_blank', 'noopener,noreferrer')
      } else {
        setSucesso(`Mensagem de ${item.cliente.nome} enviada pela API oficial.`)
      }
      await carregar()
    } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem.') }
    finally { setEnviando(null) }
  }

  async function copiar(item: ItemExibicao) {
    await navigator.clipboard.writeText(montarMensagem(item)); setCopiado(item.id)
    window.setTimeout(() => setCopiado(null), 1800)
  }

  const automatico = dados?.configuracao.modoEnvio === 'CLOUD_API'
  return (
    <div className="operation-page whatsapp-page">
      <header className="operation-header whatsapp-header"><div><span>Comunicação com clientes</span><h1>Central do WhatsApp</h1><p>Orçamentos, atualizações e garantias com textos personalizados e histórico.</p></div><div className="whatsapp-header__actions"><span className={`whatsapp-mode${automatico ? ' is-api' : ''}`}>{automatico ? 'API oficial' : 'Envio manual seguro'}</span>{podeConfigurar && <Link to="/configuracoes/whatsapp">Configurar</Link>}</div></header>
      <div className="whatsapp-notice"><strong>{automatico ? 'Envio pela conta oficial' : 'Você mantém o controle'}</strong><p>{automatico ? 'Ao tocar em enviar, o Servix solicita o envio à API oficial da Meta e registra o resultado.' : 'O Servix prepara a mensagem e abre o WhatsApp. Sua equipe confere o contato e toca em enviar.'}</p></div>
      {dados && !dados.configuracao.ativo && <div className="operation-alert"><span>A Central está desativada. Um administrador pode reativá-la nas configurações.</span></div>}
      {erro && <div className="operation-alert"><span>{erro}</span></div>}
      {sucesso && <div className="whatsapp-success" role="status">{sucesso}</div>}
      <section className="operation-toolbar whatsapp-toolbar"><div className="whatsapp-tabs"><Tab ativa={fila === 'ORDENS'} onClick={() => setFila('ORDENS')} titulo="Ordens" quantidade={dados?.ordens.length ?? 0} /><Tab ativa={fila === 'ORCAMENTOS'} onClick={() => setFila('ORCAMENTOS')} titulo="Orçamentos" quantidade={dados?.orcamentos.length ?? 0} /><Tab ativa={fila === 'GARANTIAS'} onClick={() => setFila('GARANTIAS')} titulo="Garantias" quantidade={dados?.garantias.length ?? 0} /></div><input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar cliente, aparelho ou número..." /></section>
      {!dados ? <div className="operation-loading">Preparando mensagens...</div> : <section className="whatsapp-list">{itens.map(item => <article key={`${item.origem}-${item.id}`}><div className="whatsapp-avatar">{iniciais(item.cliente.nome)}</div><div className="whatsapp-content"><header><div><h2>{item.cliente.nome}</h2><span>{item.cliente.telefone} · {item.contexto}</span></div><time>{data(item.atualizadoEm)}</time></header><p>{montarMensagem(item)}</p><footer><button type="button" onClick={() => void copiar(item)}>{copiado === item.id ? 'Copiado!' : 'Copiar mensagem'}</button><button className="whatsapp-send" type="button" disabled={!dados.configuracao.ativo || enviando === item.id} onClick={() => void enviar(item)}>{enviando === item.id ? 'Preparando...' : automatico ? 'Enviar agora' : 'Abrir no WhatsApp'}</button></footer></div></article>)}{itens.length === 0 && <div className="operation-empty">Nenhuma mensagem pendente nesta fila.</div>}</section>}
      {dados && dados.historico.length > 0 && <section className="whatsapp-history"><header><div><span>Auditoria</span><h2>Últimas mensagens</h2></div><small>{dados.historico.length} registros recentes</small></header><div>{dados.historico.slice(0, 8).map(item => <article key={item.id}><span className={`whatsapp-history__status is-${item.status.toLowerCase()}`}>{rotuloStatus(item.status)}</span><div><strong>{rotuloTipo(item.tipo)}</strong><small>{item.telefone} · {item.registradoPor?.nome ?? 'Usuário'} · {data(item.criadoEm)}</small>{item.erro && <em>{item.erro}</em>}</div></article>)}</div></section>}
    </div>
  )
}

function Tab({ ativa, onClick, titulo, quantidade }: { ativa: boolean; onClick: () => void; titulo: string; quantidade: number }) { return <button className={ativa ? 'is-active' : ''} onClick={onClick} type="button">{titulo} <span>{quantidade}</span></button> }
function iniciais(nome: string) { return nome.split(/\s+/).slice(0, 2).map(parte => parte[0]).join('').toUpperCase() }
const data = (valor: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
const rotuloStatus = (status: string) => ({ PREPARADA: 'Preparada', ENVIADA: 'Enviada', FALHA: 'Falhou' }[status] ?? status)
const rotuloTipo = (tipo: string) => ({ ORCAMENTO: 'Orçamento', STATUS_ORDEM: 'Atualização de ordem', PRONTO_RETIRADA: 'Pronto para retirada', GARANTIA: 'Garantia' }[tipo] ?? tipo)
