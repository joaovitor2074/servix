import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { PapelUsuario } from '../../../auth/types/auth.types'
import {
  alterarSituacaoUsuario,
  atualizarUsuario,
  criarUsuario,
  listarUsuarios,
  redefinirSenhaUsuario,
} from '../services/user-settings.service'
import type { UsuarioEmpresa } from '../types/user-settings.types'
import './UsersSettingsPage.css'

const PAPEIS: Array<{ valor: PapelUsuario; nome: string; descricao: string }> = [
  { valor: 'ADMIN', nome: 'Administrador', descricao: 'Acesso completo, financeiro e configurações.' },
  { valor: 'ATENDENTE', nome: 'Atendente', descricao: 'Clientes, orçamentos, ordens e pagamentos.' },
  { valor: 'TECNICO', nome: 'Técnico', descricao: 'Diagnóstico, execução e andamento das ordens.' },
]

type FormularioUsuario = {
  nome: string
  email: string
  telefone: string
  papel: PapelUsuario
  senha: string
  confirmarSenha: string
}

const FORMULARIO_VAZIO: FormularioUsuario = {
  nome: '', email: '', telefone: '', papel: 'ATENDENTE', senha: '', confirmarSenha: '',
}

export default function UsersSettingsPage({ usuarioAtualId }: { usuarioAtualId: number }) {
  const [usuarios, setUsuarios] = useState<UsuarioEmpresa[]>([])
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [dialogo, setDialogo] = useState<'criar' | 'editar' | null>(null)
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UsuarioEmpresa | null>(null)
  const [formulario, setFormulario] = useState<FormularioUsuario>(FORMULARIO_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erroFormulario, setErroFormulario] = useState('')
  const [usuarioSenha, setUsuarioSenha] = useState<UsuarioEmpresa | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('')
  const [usuarioSituacao, setUsuarioSituacao] = useState<UsuarioEmpresa | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (busca !== buscaAplicada) {
        setCarregando(true)
        setBuscaAplicada(busca)
      }
    }, 280)
    return () => window.clearTimeout(timer)
  }, [busca, buscaAplicada])

  useEffect(() => {
    const controller = new AbortController()
    void listarUsuarios(buscaAplicada, controller.signal)
      .then(resultado => {
        setUsuarios(resultado.dados)
        setErro('')
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErro(mensagemErro(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false)
      })
    return () => controller.abort()
  }, [buscaAplicada, tentativa])

  function recarregar() {
    setCarregando(true)
    setTentativa(valor => valor + 1)
  }

  const resumo = useMemo(() => ({
    total: usuarios.length,
    ativos: usuarios.filter(usuario => usuario.ativo).length,
    administradores: usuarios.filter(usuario => usuario.ativo && usuario.papel === 'ADMIN').length,
    tecnicos: usuarios.filter(usuario => usuario.ativo && usuario.papel === 'TECNICO').length,
  }), [usuarios])

  function abrirCriacao() {
    setUsuarioSelecionado(null)
    setFormulario(FORMULARIO_VAZIO)
    setErroFormulario('')
    setDialogo('criar')
  }

  function abrirEdicao(usuario: UsuarioEmpresa) {
    setUsuarioSelecionado(usuario)
    setFormulario({
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone ?? '',
      papel: usuario.papel,
      senha: '',
      confirmarSenha: '',
    })
    setErroFormulario('')
    setDialogo('editar')
  }

  async function salvarUsuario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErroFormulario('')
    setSucesso('')

    if (dialogo === 'criar' && formulario.senha !== formulario.confirmarSenha) {
      setErroFormulario('As senhas informadas não são iguais.')
      return
    }
    if (dialogo === 'criar' && formulario.senha.length < 8) {
      setErroFormulario('A senha inicial deve possuir pelo menos 8 caracteres.')
      return
    }

    setSalvando(true)
    try {
      if (dialogo === 'criar') {
        const usuario = await criarUsuario({
          nome: formulario.nome,
          email: formulario.email,
          telefone: formulario.telefone.trim() || undefined,
          senha: formulario.senha,
          papel: formulario.papel,
        })
        setUsuarios(atuais => ordenarUsuarios([...atuais, usuario]))
        setSucesso(`Usuário ${usuario.nome} criado com sucesso.`)
      } else if (usuarioSelecionado) {
        const usuario = await atualizarUsuario(usuarioSelecionado.id, {
          nome: formulario.nome,
          email: formulario.email,
          telefone: formulario.telefone.trim() || null,
          papel: formulario.papel,
        })
        setUsuarios(atuais => ordenarUsuarios(atuais.map(item => item.id === usuario.id ? usuario : item)))
        setSucesso(`Usuário ${usuario.nome} atualizado com sucesso.`)
      }
      setDialogo(null)
    } catch (error) {
      setErroFormulario(mensagemErro(error))
    } finally {
      setSalvando(false)
    }
  }

  async function salvarNovaSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!usuarioSenha) return
    setErroFormulario('')
    if (novaSenha.length < 8) return setErroFormulario('A nova senha deve possuir pelo menos 8 caracteres.')
    if (novaSenha !== confirmarNovaSenha) return setErroFormulario('As senhas informadas não são iguais.')

    setSalvando(true)
    try {
      await redefinirSenhaUsuario(usuarioSenha.id, novaSenha)
      setSucesso(`Senha de ${usuarioSenha.nome} redefinida com sucesso.`)
      setUsuarioSenha(null)
      setNovaSenha('')
      setConfirmarNovaSenha('')
    } catch (error) {
      setErroFormulario(mensagemErro(error))
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarSituacao() {
    if (!usuarioSituacao) return
    setSalvando(true)
    setErro('')
    try {
      const atualizado = await alterarSituacaoUsuario(usuarioSituacao.id, !usuarioSituacao.ativo)
      setUsuarios(atuais => atuais.map(item => item.id === atualizado.id ? atualizado : item))
      setSucesso(`${atualizado.nome} foi ${atualizado.ativo ? 'ativado' : 'bloqueado'} com sucesso.`)
      setUsuarioSituacao(null)
    } catch (error) {
      setErro(mensagemErro(error))
      setUsuarioSituacao(null)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="users-settings">
      <header className="users-settings__header">
        <div>
          <span>Configurações · equipe</span>
          <h1>Usuários e acessos</h1>
          <p>Crie uma conta individual para cada pessoa e controle exatamente o que ela pode acessar.</p>
        </div>
        <button className="users-settings__primary" type="button" onClick={abrirCriacao}><PlusIcon /> Novo usuário</button>
      </header>

      <section className="users-settings__notice" aria-label="Orientação de segurança">
        <ShieldIcon />
        <div><strong>Não compartilhe a conta de administrador</strong><p>Contas individuais protegem o histórico da empresa e permitem bloquear somente quem não faz mais parte da equipe.</p></div>
      </section>

      {sucesso && <div className="users-settings__feedback users-settings__feedback--success" role="status"><CheckIcon /><span>{sucesso}</span><button type="button" aria-label="Fechar mensagem" onClick={() => setSucesso('')}>×</button></div>}
      {erro && <div className="users-settings__feedback users-settings__feedback--error" role="alert"><WarningIcon /><span>{erro}</span><button type="button" onClick={recarregar}>Tentar novamente</button></div>}

      <section className="users-settings__metrics" aria-label="Resumo dos usuários">
        <Metric label="Usuários encontrados" value={resumo.total} icon={<UsersIcon />} />
        <Metric label="Contas ativas" value={resumo.ativos} icon={<CheckIcon />} tone="green" />
        <Metric label="Administradores" value={resumo.administradores} icon={<ShieldIcon />} tone="purple" />
        <Metric label="Técnicos" value={resumo.tecnicos} icon={<ToolIcon />} tone="orange" />
      </section>

      <section className="users-settings__card">
        <header className="users-settings__toolbar">
          <div><span>Equipe cadastrada</span><h2>Acessos da empresa</h2></div>
          <label className="users-settings__search"><SearchIcon /><span className="sr-only">Buscar usuário</span><input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar por nome ou e-mail" /></label>
        </header>

        {carregando ? <UsersSkeleton /> : usuarios.length === 0 ? (
          <div className="users-settings__empty"><UsersIcon /><h2>{buscaAplicada ? 'Nenhum usuário encontrado' : 'Sua equipe começa aqui'}</h2><p>{buscaAplicada ? 'Tente outro nome ou e-mail.' : 'Crie contas individuais para atendentes, técnicos e administradores.'}</p>{!buscaAplicada && <button type="button" onClick={abrirCriacao}>Criar primeiro usuário</button>}</div>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead><tr><th>Usuário</th><th>Contato</th><th>Perfil</th><th>Situação</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>{usuarios.map(usuario => (
                <tr key={usuario.id} className={!usuario.ativo ? 'is-inactive' : ''}>
                  <td data-label="Usuário"><div className="users-table__identity"><span>{iniciais(usuario.nome)}</span><div><strong>{usuario.nome}</strong>{usuario.id === usuarioAtualId && <small>Você · sessão atual</small>}</div></div></td>
                  <td data-label="Contato"><div className="users-table__contact"><strong>{usuario.email}</strong><small>{usuario.telefone || 'Telefone não informado'}</small></div></td>
                  <td data-label="Perfil"><span className={`users-role users-role--${usuario.papel.toLowerCase()}`}>{rotuloPapel(usuario.papel)}</span></td>
                  <td data-label="Situação"><span className={`users-status ${usuario.ativo ? 'is-active' : 'is-inactive'}`}><i />{usuario.ativo ? 'Ativo' : 'Bloqueado'}</span></td>
                  <td><div className="users-table__actions"><button type="button" title="Editar usuário" onClick={() => abrirEdicao(usuario)}><EditIcon /><span>Editar</span></button><button type="button" title="Redefinir senha" onClick={() => { setUsuarioSenha(usuario); setErroFormulario(''); setNovaSenha(''); setConfirmarNovaSenha('') }}><KeyIcon /><span>Senha</span></button><button className={usuario.ativo ? 'is-danger' : 'is-success'} type="button" disabled={usuario.id === usuarioAtualId} title={usuario.id === usuarioAtualId ? 'Sua própria conta não pode ser bloqueada' : usuario.ativo ? 'Bloquear acesso' : 'Ativar acesso'} onClick={() => setUsuarioSituacao(usuario)}><PowerIcon /><span>{usuario.ativo ? 'Bloquear' : 'Ativar'}</span></button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {dialogo && <UserDialog mode={dialogo} form={formulario} currentUser={usuarioSelecionado?.id === usuarioAtualId} saving={salvando} error={erroFormulario} onChange={setFormulario} onClose={() => !salvando && setDialogo(null)} onSubmit={salvarUsuario} />}
      {usuarioSenha && <PasswordDialog user={usuarioSenha} password={novaSenha} confirmation={confirmarNovaSenha} saving={salvando} error={erroFormulario} onPassword={setNovaSenha} onConfirmation={setConfirmarNovaSenha} onClose={() => !salvando && setUsuarioSenha(null)} onSubmit={salvarNovaSenha} />}
      {usuarioSituacao && <ConfirmStatusDialog user={usuarioSituacao} saving={salvando} onClose={() => !salvando && setUsuarioSituacao(null)} onConfirm={() => void confirmarSituacao()} />}
    </div>
  )
}

function UserDialog({ mode, form, currentUser, saving, error, onChange, onClose, onSubmit }: { mode: 'criar' | 'editar'; form: FormularioUsuario; currentUser: boolean; saving: boolean; error: string; onChange: (value: FormularioUsuario) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Dialog title={mode === 'criar' ? 'Criar novo usuário' : 'Editar usuário'} description={mode === 'criar' ? 'Defina os dados de acesso e o perfil desta pessoa.' : 'Atualize os dados e as permissões desta conta.'} onClose={onClose}>
    <form className="users-dialog__form" onSubmit={onSubmit}>
      <div className="users-dialog__fields"><label><span>Nome completo</span><input autoFocus required minLength={2} maxLength={120} value={form.nome} onChange={event => onChange({ ...form, nome: event.target.value })} /></label><label><span>E-mail de acesso</span><input required type="email" maxLength={254} value={form.email} onChange={event => onChange({ ...form, email: event.target.value })} /></label><label><span>Telefone <small>opcional</small></span><input inputMode="tel" value={form.telefone} onChange={event => onChange({ ...form, telefone: event.target.value })} placeholder="(99) 99999-9999" /></label><label><span>Perfil de acesso</span><select value={form.papel} disabled={currentUser} onChange={event => onChange({ ...form, papel: event.target.value as PapelUsuario })}>{PAPEIS.map(papel => <option key={papel.valor} value={papel.valor}>{papel.nome}</option>)}</select>{currentUser && <small>Você não pode remover seu próprio acesso de administrador.</small>}</label></div>
      <div className="users-dialog__role-note"><strong>{rotuloPapel(form.papel)}</strong><span>{PAPEIS.find(item => item.valor === form.papel)?.descricao}</span></div>
      {mode === 'criar' && <div className="users-dialog__fields users-dialog__fields--password"><label><span>Senha inicial</span><input required type="password" minLength={8} maxLength={128} value={form.senha} onChange={event => onChange({ ...form, senha: event.target.value })} autoComplete="new-password" /></label><label><span>Confirmar senha</span><input required type="password" minLength={8} maxLength={128} value={form.confirmarSenha} onChange={event => onChange({ ...form, confirmarSenha: event.target.value })} autoComplete="new-password" /></label></div>}
      {error && <p className="users-dialog__error" role="alert">{error}</p>}
      <div className="users-dialog__actions"><button type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="is-primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : mode === 'criar' ? 'Criar usuário' : 'Salvar alterações'}</button></div>
    </form>
  </Dialog>
}

function PasswordDialog({ user, password, confirmation, saving, error, onPassword, onConfirmation, onClose, onSubmit }: { user: UsuarioEmpresa; password: string; confirmation: string; saving: boolean; error: string; onPassword: (value: string) => void; onConfirmation: (value: string) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Dialog title="Redefinir senha" description={`Crie uma nova senha de acesso para ${user.nome}.`} onClose={onClose}><form className="users-dialog__form" onSubmit={onSubmit}><div className="users-dialog__fields users-dialog__fields--password"><label><span>Nova senha</span><input autoFocus required type="password" minLength={8} maxLength={128} value={password} onChange={event => onPassword(event.target.value)} autoComplete="new-password" /></label><label><span>Confirmar nova senha</span><input required type="password" minLength={8} maxLength={128} value={confirmation} onChange={event => onConfirmation(event.target.value)} autoComplete="new-password" /></label></div><p className="users-dialog__hint"><ShieldIcon />A senha não será exibida novamente. Entregue-a diretamente ao usuário.</p>{error && <p className="users-dialog__error" role="alert">{error}</p>}<div className="users-dialog__actions"><button type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="is-primary" type="submit" disabled={saving}>{saving ? 'Redefinindo...' : 'Redefinir senha'}</button></div></form></Dialog>
}

function ConfirmStatusDialog({ user, saving, onClose, onConfirm }: { user: UsuarioEmpresa; saving: boolean; onClose: () => void; onConfirm: () => void }) {
  const bloquear = user.ativo
  return <Dialog title={bloquear ? 'Bloquear este usuário?' : 'Ativar este usuário?'} description={bloquear ? `${user.nome} perderá o acesso imediatamente, mas o histórico será preservado.` : `${user.nome} poderá entrar novamente usando seu e-mail e senha.`} onClose={onClose}><div className="users-dialog__actions users-dialog__actions--standalone"><button type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className={bloquear ? 'is-danger' : 'is-primary'} type="button" onClick={onConfirm} disabled={saving}>{saving ? 'Processando...' : bloquear ? 'Bloquear acesso' : 'Ativar acesso'}</button></div></Dialog>
}

function Dialog({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) { return <div className="users-dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}><section className="users-dialog" role="dialog" aria-modal="true" aria-labelledby="users-dialog-title"><header><div><span>Gerenciamento de acesso</span><h2 id="users-dialog-title">{title}</h2><p>{description}</p></div><button type="button" aria-label="Fechar" onClick={onClose}>×</button></header>{children}</section></div> }
function Metric({ label, value, icon, tone = 'blue' }: { label: string; value: number; icon: ReactNode; tone?: string }) { return <article className={`users-metric users-metric--${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></article> }
function UsersSkeleton() { return <div className="users-settings__skeleton" aria-label="Carregando usuários"><i /><i /><i /><i /></div> }
function ordenarUsuarios(usuarios: UsuarioEmpresa[]) { return [...usuarios].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }
function mensagemErro(error: unknown) { return error instanceof Error && error.message ? error.message : 'Não foi possível concluir a operação.' }
function rotuloPapel(papel: PapelUsuario) { return papel === 'ADMIN' ? 'Administrador' : papel === 'TECNICO' ? 'Técnico' : 'Atendente' }
function iniciais(nome: string) { const partes = nome.trim().split(/\s+/).filter(Boolean); return `${partes[0]?.[0] ?? 'U'}${partes.length > 1 ? partes.at(-1)?.[0] ?? '' : ''}`.toUpperCase() }
function Icon({ children }: { children: ReactNode }) { return <svg viewBox="0 0 24 24" aria-hidden="true">{children}</svg> }
function PlusIcon() { return <Icon><path d="M12 5v14M5 12h14" /></Icon> }
function ShieldIcon() { return <Icon><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></Icon> }
function CheckIcon() { return <Icon><path d="m5 12 4 4L19 6" /></Icon> }
function WarningIcon() { return <Icon><path d="M12 3 2 21h20L12 3Z" /><path d="M12 9v5M12 18h.01" /></Icon> }
function UsersIcon() { return <Icon><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2M16 6a3 3 0 0 1 0 6M17 14a4 4 0 0 1 4 4v2" /></Icon> }
function ToolIcon() { return <Icon><path d="M14 6a4 4 0 0 0-5-4l2 2-3 3-2-2a4 4 0 0 0 4 5l8 8 2-2-8-8" /></Icon> }
function SearchIcon() { return <Icon><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon> }
function EditIcon() { return <Icon><path d="M12 20h9M16 4l4 4L8 20l-5 1 1-5L16 4Z" /></Icon> }
function KeyIcon() { return <Icon><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M15 8l2 2M17 6l2 2" /></Icon> }
function PowerIcon() { return <Icon><path d="M12 2v10M7 5a8 8 0 1 0 10 0" /></Icon> }
