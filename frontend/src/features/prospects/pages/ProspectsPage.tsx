import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './ProspectsPage.css'

type ProspectStatus = 'NOVO' | 'CONTATADO' | 'RESPONDEU' | 'PROPOSTA' | 'FECHADO' | 'ARQUIVADO'
type ContactChannel = 'WHATSAPP' | 'INSTAGRAM' | 'TELEFONE' | 'EMAIL'

interface Prospect {
  id: string
  empresa: string
  cidade: string
  segmento: string
  canal: ContactChannel
  contato: string
  status: ProspectStatus
  observacoes: string
  ultimoContato: string
  proximaAcao: string
  criadoEm: string
}

type ProspectForm = Omit<Prospect, 'id' | 'criadoEm' | 'ultimoContato'>

const STORAGE_KEY = 'servix:prospeccao:v1'

const STATUS: Array<{ value: ProspectStatus; label: string }> = [
  { value: 'NOVO', label: 'Novo' },
  { value: 'CONTATADO', label: 'Contatado' },
  { value: 'RESPONDEU', label: 'Respondeu' },
  { value: 'PROPOSTA', label: 'Proposta enviada' },
  { value: 'FECHADO', label: 'Fechado' },
  { value: 'ARQUIVADO', label: 'Arquivado' },
]

const EMPTY_FORM: ProspectForm = {
  empresa: '',
  cidade: '',
  segmento: '',
  canal: 'WHATSAPP',
  contato: '',
  status: 'NOVO',
  observacoes: '',
  proximaAcao: '',
}

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>(loadProspects)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ProspectForm>(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProspectStatus | 'TODOS'>('TODOS')

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prospects))
  }, [prospects])

  const filteredProspects = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    return prospects.filter(prospect => {
      const matchesStatus = statusFilter === 'TODOS' || prospect.status === statusFilter
      const matchesSearch = !term || [
        prospect.empresa,
        prospect.cidade,
        prospect.segmento,
        prospect.contato,
      ].some(value => value.toLocaleLowerCase('pt-BR').includes(term))

      return matchesStatus && matchesSearch
    })
  }, [prospects, search, statusFilter])

  const metrics = useMemo(() => ({
    total: prospects.length,
    novos: prospects.filter(item => item.status === 'NOVO').length,
    conversas: prospects.filter(item => ['CONTATADO', 'RESPONDEU'].includes(item.status)).length,
    propostas: prospects.filter(item => item.status === 'PROPOSTA').length,
    fechados: prospects.filter(item => item.status === 'FECHADO').length,
  }), [prospects])

  function updateForm<K extends keyof ProspectForm>(field: K, value: ProspectForm[K]) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function submitProspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const now = new Date().toISOString()

    if (editingId) {
      setProspects(current => current.map(item => item.id === editingId ? { ...item, ...form } : item))
    } else {
      setProspects(current => [{
        ...form,
        id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
        ultimoContato: '',
        criadoEm: now,
      }, ...current])
    }

    closeForm()
  }

  function openNewProspect() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEditProspect(prospect: Prospect) {
    setEditingId(prospect.id)
    setForm({
      empresa: prospect.empresa,
      cidade: prospect.cidade,
      segmento: prospect.segmento,
      canal: prospect.canal,
      contato: prospect.contato,
      status: prospect.status,
      observacoes: prospect.observacoes,
      proximaAcao: prospect.proximaAcao,
    })
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function registerContact(id: string) {
    const today = new Date().toISOString()
    setProspects(current => current.map(item => item.id === id ? {
      ...item,
      status: item.status === 'NOVO' ? 'CONTATADO' : item.status,
      ultimoContato: today,
    } : item))
  }

  function updateStatus(id: string, status: ProspectStatus) {
    setProspects(current => current.map(item => item.id === id ? { ...item, status } : item))
  }

  function removeProspect(prospect: Prospect) {
    if (!window.confirm(`Remover ${prospect.empresa} da prospecção?`)) return
    setProspects(current => current.filter(item => item.id !== prospect.id))
  }

  function exportCsv() {
    const header = ['Empresa', 'Cidade', 'Segmento', 'Canal', 'Contato', 'Status', 'Último contato', 'Próxima ação', 'Observações']
    const rows = prospects.map(item => [
      item.empresa,
      item.cidade,
      item.segmento,
      item.canal,
      item.contato,
      statusLabel(item.status),
      formatDate(item.ultimoContato),
      formatDate(item.proximaAcao),
      item.observacoes,
    ])
    const csv = [header, ...rows]
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(';'))
      .join('\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `prospeccao-servix-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="prospects-page">
      <header className="prospects-header">
        <div>
          <span>Comercial</span>
          <h1>Central de Prospecção</h1>
          <p>Organize empresas, conversas, propostas e próximos contatos em um único funil.</p>
        </div>
        <div className="prospects-header__actions">
          <button className="prospects-button prospects-button--secondary" type="button" onClick={exportCsv} disabled={!prospects.length}>
            Exportar CSV
          </button>
          <button className="prospects-button prospects-button--primary" type="button" onClick={openNewProspect}>
            + Nova empresa
          </button>
        </div>
      </header>

      <section className="prospects-metrics" aria-label="Resumo da prospecção">
        <Metric label="Empresas" value={metrics.total} />
        <Metric label="Novas" value={metrics.novos} tone="blue" />
        <Metric label="Em conversa" value={metrics.conversas} tone="orange" />
        <Metric label="Propostas" value={metrics.propostas} tone="purple" />
        <Metric label="Fechadas" value={metrics.fechados} tone="green" />
      </section>

      {formOpen && (
        <section className="prospect-form-card" aria-labelledby="prospect-form-title">
          <div className="prospect-form-card__heading">
            <div>
              <span>{editingId ? 'Atualizar oportunidade' : 'Nova oportunidade'}</span>
              <h2 id="prospect-form-title">{editingId ? 'Editar empresa' : 'Adicionar empresa ao funil'}</h2>
            </div>
            <button type="button" onClick={closeForm} aria-label="Fechar formulário">×</button>
          </div>
          <form onSubmit={submitProspect}>
            <label><span>Empresa *</span><input required value={form.empresa} onChange={event => updateForm('empresa', event.target.value)} placeholder="Ex.: Assistência Tech" /></label>
            <label><span>Cidade</span><input value={form.cidade} onChange={event => updateForm('cidade', event.target.value)} placeholder="Ex.: Imperatriz - MA" /></label>
            <label><span>Segmento</span><input value={form.segmento} onChange={event => updateForm('segmento', event.target.value)} placeholder="Ex.: Celulares e informática" /></label>
            <label><span>Canal *</span><select value={form.canal} onChange={event => updateForm('canal', event.target.value as ContactChannel)}><option value="WHATSAPP">WhatsApp</option><option value="INSTAGRAM">Instagram</option><option value="TELEFONE">Telefone</option><option value="EMAIL">E-mail</option></select></label>
            <label><span>Contato *</span><input required value={form.contato} onChange={event => updateForm('contato', event.target.value)} placeholder="Número, @perfil ou e-mail" /></label>
            <label><span>Etapa</span><select value={form.status} onChange={event => updateForm('status', event.target.value as ProspectStatus)}>{STATUS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label><span>Próxima ação</span><input type="date" value={form.proximaAcao} onChange={event => updateForm('proximaAcao', event.target.value)} /></label>
            <label className="prospect-form__notes"><span>Observações</span><textarea value={form.observacoes} onChange={event => updateForm('observacoes', event.target.value)} placeholder="Necessidade percebida, responsável, proposta de abordagem..." rows={3} /></label>
            <div className="prospect-form__actions"><button type="button" onClick={closeForm}>Cancelar</button><button type="submit">{editingId ? 'Salvar alterações' : 'Adicionar ao funil'}</button></div>
          </form>
        </section>
      )}

      <section className="prospects-board">
        <div className="prospects-toolbar">
          <label><span className="sr-only">Buscar empresas</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar empresa, cidade, segmento ou contato..." /></label>
          <label><span className="sr-only">Filtrar por etapa</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as ProspectStatus | 'TODOS')}><option value="TODOS">Todas as etapas</option>{STATUS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <span>{filteredProspects.length} resultado{filteredProspects.length === 1 ? '' : 's'}</span>
        </div>

        {filteredProspects.length ? (
          <div className="prospects-list">
            {filteredProspects.map(prospect => (
              <article className="prospect-card" key={prospect.id}>
                <div className="prospect-card__identity">
                  <span>{prospect.empresa.slice(0, 2).toUpperCase()}</span>
                  <div><h2>{prospect.empresa}</h2><p>{[prospect.segmento, prospect.cidade].filter(Boolean).join(' · ') || 'Sem detalhes adicionais'}</p></div>
                </div>
                <div className="prospect-card__contact"><small>{channelLabel(prospect.canal)}</small><strong>{prospect.contato}</strong>{prospect.ultimoContato && <span>Contato em {formatDate(prospect.ultimoContato)}</span>}</div>
                <label className={`prospect-status prospect-status--${prospect.status.toLowerCase()}`}><span className="sr-only">Etapa</span><select value={prospect.status} onChange={event => updateStatus(prospect.id, event.target.value as ProspectStatus)}>{STATUS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                <div className="prospect-card__next"><small>Próxima ação</small><strong>{prospect.proximaAcao ? formatDate(prospect.proximaAcao) : 'Não agendada'}</strong></div>
                <div className="prospect-card__actions">
                  <a href={contactHref(prospect)} target="_blank" rel="noreferrer" onClick={() => registerContact(prospect.id)}>Abrir contato</a>
                  <button type="button" onClick={() => openEditProspect(prospect)}>Editar</button>
                  <button className="is-danger" type="button" onClick={() => removeProspect(prospect)}>Remover</button>
                </div>
                {prospect.observacoes && <p className="prospect-card__notes">{prospect.observacoes}</p>}
              </article>
            ))}
          </div>
        ) : (
          <div className="prospects-empty">
            <span aria-hidden="true">◎</span>
            <h2>{prospects.length ? 'Nenhuma empresa encontrada' : 'Seu funil começa aqui'}</h2>
            <p>{prospects.length ? 'Ajuste a busca ou os filtros para ver outros resultados.' : 'Cadastre empresas e acompanhe cada conversa até o fechamento.'}</p>
            {!prospects.length && <button type="button" onClick={openNewProspect}>Adicionar primeira empresa</button>}
          </div>
        )}
      </section>

      <aside className="prospects-privacy">
        <strong>Dados neste dispositivo</strong>
        <span>Esta primeira versão salva a prospecção apenas neste navegador. Exporte o CSV regularmente como cópia de segurança.</span>
      </aside>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: string }) {
  return <article className={`prospect-metric prospect-metric--${tone}`}><span>{label}</span><strong>{value}</strong></article>
}

function statusLabel(status: ProspectStatus) {
  return STATUS.find(item => item.value === status)?.label ?? status
}

function channelLabel(channel: ContactChannel) {
  return { WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', TELEFONE: 'Telefone', EMAIL: 'E-mail' }[channel]
}

function contactHref(prospect: Prospect) {
  if (prospect.canal === 'INSTAGRAM') {
    if (/^https?:\/\//i.test(prospect.contato)) return prospect.contato
    return `https://www.instagram.com/${prospect.contato.replace(/^@/, '').replace(/\/$/, '')}/`
  }
  if (prospect.canal === 'EMAIL') return `mailto:${prospect.contato}`

  const digits = prospect.contato.replace(/\D/g, '')
  if (prospect.canal === 'TELEFONE') return `tel:${digits}`
  const international = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${international}?text=${encodeURIComponent(`Olá! Encontrei a ${prospect.empresa} e gostaria de apresentar uma ideia para melhorar a presença digital da empresa.`)}`
}

function formatDate(value: string) {
  if (!value) return ''
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function loadProspects() {
  try {
    if (typeof window === 'undefined') return []
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) as Prospect[] : []
  } catch {
    return []
  }
}
