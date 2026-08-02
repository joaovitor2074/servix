import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import {
  STATUS_ORDEM_LABELS,
  TRANSICOES_STATUS_ORDEM,
  type OrdemServico,
  type StatusOrdem,
} from '../../../shared/types/ordem.types'
import { alterarStatusOrdem, listarOrdens } from '../../orders/services/orders.service'
import '../../operations.css'
import './KanbanPage.css'

const COLUNAS: StatusOrdem[] = ['RECEBIDO', 'EM_ANALISE', 'EM_EXECUCAO', 'AGUARDANDO_PECA', 'PRONTO', 'ENTREGUE']

export default function KanbanPage() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [movendo, setMovendo] = useState<number | null>(null)
  const [arrastada, setArrastada] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void listarOrdens({ limite: 100 }, { signal: controller.signal })
      .then(resposta => setOrdens(resposta.dados.filter(ordem => ordem.status !== 'CANCELADO')))
      .catch(error => { if (error instanceof Error && error.name !== 'AbortError') setErro(error.message) })
      .finally(() => setCarregando(false))
    return () => controller.abort()
  }, [])

  const agrupadas = useMemo(() => Object.fromEntries(COLUNAS.map(status => [status, ordens.filter(ordem => ordem.status === status)])) as Record<StatusOrdem, OrdemServico[]>, [ordens])

  async function mover(ordem: OrdemServico, status: StatusOrdem) {
    if (ordem.status === status || movendo) return
    if (!TRANSICOES_STATUS_ORDEM[ordem.status].includes(status)) {
      setErro(`A ordem #${ordem.numero} não pode ir diretamente de ${STATUS_ORDEM_LABELS[ordem.status]} para ${STATUS_ORDEM_LABELS[status]}.`)
      return
    }
    setMovendo(ordem.id)
    setErro('')
    try {
      const resposta = await alterarStatusOrdem(ordem.id, {
        statusEsperado: ordem.status,
        versaoEsperada: ordem.versao,
        status,
        mensagemPublica: `Atendimento atualizado para ${STATUS_ORDEM_LABELS[status]}.`,
      })
      setOrdens(atuais => atuais.map(item => item.id === ordem.id ? { ...item, status: resposta.status, versao: resposta.versao, atualizadoEm: resposta.atualizadoEm } : item))
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível mover a ordem')
    } finally {
      setMovendo(null)
      setArrastada(null)
    }
  }

  function soltar(event: DragEvent, status: StatusOrdem) {
    event.preventDefault()
    const ordem = ordens.find(item => item.id === arrastada)
    if (ordem) void mover(ordem, status)
  }

  return (
    <div className="operation-page kanban-page">
      <header className="operation-header">
        <div><span>Fluxo de atendimento</span><h1>Kanban de serviços</h1><p>Arraste cada ordem para a próxima etapa permitida.</p></div>
        <Link className="operation-primary" to="/orcamentos/novo">Novo orçamento</Link>
      </header>

      {erro && <div className="operation-alert" role="alert"><span>{erro}</span><button onClick={() => setErro('')} type="button">×</button></div>}
      {carregando ? <div className="operation-loading">Carregando quadro...</div> : (
        <section className="kanban-board" aria-label="Quadro de ordens de serviço">
          {COLUNAS.map(status => (
            <div
              className={`kanban-column kanban-column--${status.toLowerCase()}${arrastada ? ' is-dragging' : ''}`}
              key={status}
              onDragOver={event => event.preventDefault()}
              onDrop={event => soltar(event, status)}
            >
              <header><span className="kanban-column__dot" /><h2>{STATUS_ORDEM_LABELS[status]}</h2><strong>{agrupadas[status].length}</strong></header>
              <div className="kanban-column__cards">
                {agrupadas[status].map(ordem => (
                  <article
                    className={`kanban-card${movendo === ordem.id ? ' is-moving' : ''}`}
                    draggable={!movendo && TRANSICOES_STATUS_ORDEM[ordem.status].length > 0}
                    key={ordem.id}
                    onDragStart={() => setArrastada(ordem.id)}
                    onDragEnd={() => setArrastada(null)}
                  >
                    <div className="kanban-card__top"><strong>#{ordem.numero}</strong><time>{formatarData(ordem.atualizadoEm)}</time></div>
                    <h3>{ordem.cliente.nome}</h3>
                    <p>{ordem.equipamento}</p>
                    <small>{ordem.problemaRelatado}</small>
                    {ordem.previsaoDeEntrega && <span className={new Date(ordem.previsaoDeEntrega) < new Date() && !['PRONTO', 'ENTREGUE'].includes(ordem.status) ? 'is-late' : ''}>Previsão: {formatarData(ordem.previsaoDeEntrega)}</span>}
                    <footer>
                      <Link to={`/ordens/${ordem.id}`}>Abrir ordem</Link>
                      {TRANSICOES_STATUS_ORDEM[ordem.status].length > 0 && (
                        <select aria-label={`Mover ordem ${ordem.numero}`} disabled={movendo === ordem.id} value="" onChange={event => void mover(ordem, event.target.value as StatusOrdem)}>
                          <option value="">Mover para...</option>
                          {TRANSICOES_STATUS_ORDEM[ordem.status].filter(item => item !== 'CANCELADO').map(proximo => <option value={proximo} key={proximo}>{STATUS_ORDEM_LABELS[proximo]}</option>)}
                        </select>
                      )}
                    </footer>
                  </article>
                ))}
                {agrupadas[status].length === 0 && <div className="kanban-empty">Nenhuma ordem nesta etapa</div>}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

const formatadorData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
function formatarData(data: string) { return formatadorData.format(new Date(data)) }
