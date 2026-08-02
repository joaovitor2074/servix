import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import {
  atualizarConfiguracaoWhatsApp,
  buscarConfiguracaoWhatsApp,
  testarConexaoWhatsApp,
} from '../services/whatsapp-settings.service'
import type {
  ConfiguracaoWhatsApp,
  ModoEnvioWhatsApp,
  TesteConexaoWhatsApp,
} from '../types/whatsapp-settings.types'
import './WhatsAppSettingsPage.css'

const CAMPOS_TEMPLATE: Array<{ campo: keyof ConfiguracaoWhatsApp; titulo: string; descricao: string }> = [
  { campo: 'templateOrcamento', titulo: 'Orçamento disponível', descricao: 'Usado para enviar o valor e o link de aprovação.' },
  { campo: 'templateRecebido', titulo: 'Aparelho recebido', descricao: 'Confirma que a ordem entrou na assistência.' },
  { campo: 'templateEmAnalise', titulo: 'Em análise', descricao: 'Atualização da etapa de diagnóstico.' },
  { campo: 'templateEmExecucao', titulo: 'Em execução', descricao: 'Informa que o reparo começou.' },
  { campo: 'templateAguardandoPeca', titulo: 'Aguardando peça', descricao: 'Alinha a expectativa quando há dependência de estoque.' },
  { campo: 'templatePronto', titulo: 'Pronto para retirada', descricao: 'Avisa que o equipamento já pode ser retirado.' },
  { campo: 'templateEntregue', titulo: 'Serviço entregue', descricao: 'Mensagem de encerramento do atendimento.' },
  { campo: 'templateGarantia', titulo: 'Certificado de garantia', descricao: 'Confirma a validade da garantia do serviço.' },
]

export default function WhatsAppSettingsPage() {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoWhatsApp | null>(null)
  const [token, setToken] = useState('')
  const [removerToken, setRemoverToken] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [testando, setTestando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [resultadoTeste, setResultadoTeste] = useState<TesteConexaoWhatsApp | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void buscarConfiguracaoWhatsApp(controller.signal)
      .then(setConfiguracao)
      .catch(error => { if (error instanceof Error && error.name !== 'AbortError') setErro(error.message) })
      .finally(() => setCarregando(false))
    return () => controller.abort()
  }, [])

  function alterar<K extends keyof ConfiguracaoWhatsApp>(campo: K, valor: ConfiguracaoWhatsApp[K]) {
    setConfiguracao(atual => atual ? { ...atual, [campo]: valor } : atual)
    setSucesso('')
  }

  async function salvar(event: FormEvent) {
    event.preventDefault()
    if (!configuracao) return
    setSalvando(true); setErro(''); setSucesso(''); setResultadoTeste(null)
    try {
      const atualizada = await atualizarConfiguracaoWhatsApp({
        versaoEsperada: configuracao.versao,
        ativo: configuracao.ativo,
        modoEnvio: configuracao.modoEnvio,
        telefoneEmpresa: configuracao.telefoneEmpresa,
        incluirLink: configuracao.incluirLink,
        templateOrcamento: configuracao.templateOrcamento,
        templateRecebido: configuracao.templateRecebido,
        templateEmAnalise: configuracao.templateEmAnalise,
        templateEmExecucao: configuracao.templateEmExecucao,
        templateAguardandoPeca: configuracao.templateAguardandoPeca,
        templatePronto: configuracao.templatePronto,
        templateEntregue: configuracao.templateEntregue,
        templateGarantia: configuracao.templateGarantia,
        apiPhoneNumberId: configuracao.apiPhoneNumberId,
        apiBusinessAccountId: configuracao.apiBusinessAccountId,
        ...(token ? { apiAccessToken: token } : {}),
        ...(removerToken ? { removerApiAccessToken: true } : {}),
      })
      setConfiguracao(atualizada); setToken(''); setRemoverToken(false)
      setSucesso('Configurações do WhatsApp salvas com segurança.')
    } catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível salvar.') }
    finally { setSalvando(false) }
  }

  async function testar() {
    setTestando(true); setErro(''); setResultadoTeste(null)
    try { setResultadoTeste(await testarConexaoWhatsApp()) }
    catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível testar a conexão.') }
    finally { setTestando(false) }
  }

  if (carregando) return <div className="whatsapp-settings whatsapp-settings--loading">Carregando configurações...</div>
  if (!configuracao) return <div className="whatsapp-settings"><div className="whatsapp-settings__alert is-error">{erro || 'Configuração indisponível.'}</div></div>

  return (
    <form className="whatsapp-settings" onSubmit={salvar}>
      <header className="whatsapp-settings__header">
        <div><span>Configurações · comunicação</span><h1>WhatsApp</h1><p>Escolha como sua equipe envia mensagens e personalize cada etapa do atendimento.</p></div>
        <Link to="/whatsapp">Voltar para a Central</Link>
      </header>

      {erro && <div className="whatsapp-settings__alert is-error" role="alert">{erro}</div>}
      {sucesso && <div className="whatsapp-settings__alert is-success" role="status">{sucesso}</div>}

      <section className="whatsapp-settings__section whatsapp-settings__general">
        <div className="whatsapp-settings__section-title"><div><h2>Funcionamento</h2><p>O modo manual funciona imediatamente. A API oficial é opcional.</p></div><label className="whatsapp-switch"><input type="checkbox" checked={configuracao.ativo} onChange={event => alterar('ativo', event.target.checked)} /><span /><strong>{configuracao.ativo ? 'Ativo' : 'Desativado'}</strong></label></div>
        <div className="whatsapp-settings__modes">
          <ModeCard modo="LINK_MANUAL" selecionado={configuracao.modoEnvio} onChange={modo => alterar('modoEnvio', modo)} titulo="Abrir no WhatsApp" selo="Recomendado" descricao="O Servix prepara a mensagem. Sua equipe confere e toca em enviar no WhatsApp Web ou aplicativo." />
          <ModeCard modo="CLOUD_API" selecionado={configuracao.modoEnvio} onChange={modo => alterar('modoEnvio', modo)} titulo="API oficial da Meta" selo="Avançado" descricao="Envia pela conta oficial conectada. Mensagens fora da janela de atendimento podem exigir modelo aprovado pela Meta." />
        </div>
        <div className="whatsapp-settings__fields two-columns">
          <label><span>Telefone da empresa</span><input value={configuracao.telefoneEmpresa ?? ''} onChange={event => alterar('telefoneEmpresa', event.target.value || null)} placeholder="(11) 99999-9999" inputMode="tel" /><small>Usado como referência da conta comercial.</small></label>
          <label className="whatsapp-settings__checkbox"><input type="checkbox" checked={configuracao.incluirLink} onChange={event => alterar('incluirLink', event.target.checked)} /><span><strong>Incluir links seguros</strong><small>Adiciona acompanhamento, orçamento ou certificado às mensagens.</small></span></label>
        </div>
      </section>

      <section className="whatsapp-settings__section">
        <div className="whatsapp-settings__section-title"><div><h2>Mensagens automáticas</h2><p>Edite o tom das mensagens. As variáveis são preenchidas pelo Servix.</p></div></div>
        <div className="whatsapp-settings__variables"><span>{'{{cliente}}'}</span><span>{'{{empresa}}'}</span><span>{'{{numero}}'}</span><span>{'{{equipamento}}'}</span><span>{'{{valor}}'}</span><span>{'{{validade}}'}</span><span>{'{{link}}'}</span></div>
        <div className="whatsapp-settings__templates">
          {CAMPOS_TEMPLATE.map(item => <label key={item.campo}><span>{item.titulo}</span><small>{item.descricao}</small><textarea rows={4} maxLength={1200} value={String(configuracao[item.campo] ?? '')} onChange={event => alterar(item.campo, event.target.value as never)} /></label>)}
        </div>
      </section>

      <section className={`whatsapp-settings__section whatsapp-settings__api${configuracao.modoEnvio === 'CLOUD_API' ? ' is-selected' : ''}`}>
        <div className="whatsapp-settings__section-title"><div><h2>Conexão com a Meta</h2><p>Credenciais exclusivas desta empresa, protegidas por criptografia no servidor.</p></div><span className={`whatsapp-settings__connection ${configuracao.possuiApiAccessToken ? 'is-ready' : ''}`}>{configuracao.possuiApiAccessToken ? 'Token salvo' : 'Não conectado'}</span></div>
        {!configuracao.integracaoApiDisponivelNoServidor && <div className="whatsapp-settings__inline-warning">A proteção de credenciais ainda não está habilitada no servidor. O modo manual continua funcionando normalmente.</div>}
        <div className="whatsapp-settings__fields two-columns">
          <label><span>Phone Number ID</span><input value={configuracao.apiPhoneNumberId ?? ''} onChange={event => alterar('apiPhoneNumberId', event.target.value || null)} placeholder="Ex.: 123456789012345" /></label>
          <label><span>WhatsApp Business Account ID</span><input value={configuracao.apiBusinessAccountId ?? ''} onChange={event => alterar('apiBusinessAccountId', event.target.value || null)} placeholder="Ex.: 123456789012345" /></label>
        </div>
        <label><span>Token de acesso permanente</span><input type="password" autoComplete="new-password" value={token} onChange={event => { setToken(event.target.value); setRemoverToken(false) }} placeholder={configuracao.possuiApiAccessToken ? 'Deixe vazio para manter o token salvo' : 'Cole o token gerado na Meta'} /><small>O Servix nunca devolve o token salvo para o navegador.</small></label>
        {configuracao.possuiApiAccessToken && <label className="whatsapp-settings__remove"><input type="checkbox" checked={removerToken} onChange={event => { setRemoverToken(event.target.checked); if (event.target.checked) setToken('') }} /> Remover o token salvo ao salvar</label>}
        <div className="whatsapp-settings__api-footer"><a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer">Abrir guia oficial da Meta ↗</a><button type="button" onClick={() => void testar()} disabled={testando || !configuracao.possuiApiAccessToken}>{testando ? 'Testando...' : 'Testar conexão salva'}</button></div>
        {resultadoTeste && <div className="whatsapp-settings__test-result"><strong>Conexão aprovada</strong><span>{resultadoTeste.nomeVerificado ?? 'Conta oficial'}{resultadoTeste.telefone ? ` · ${resultadoTeste.telefone}` : ''}{resultadoTeste.qualidade ? ` · Qualidade ${resultadoTeste.qualidade}` : ''}</span></div>}
      </section>

      <footer className="whatsapp-settings__save"><span>Versão {configuracao.versao} · API Graph {configuracao.graphApiVersion}</span><button type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar configurações'}</button></footer>
    </form>
  )
}

function ModeCard({ modo, selecionado, onChange, titulo, selo, descricao }: { modo: ModoEnvioWhatsApp; selecionado: ModoEnvioWhatsApp; onChange: (modo: ModoEnvioWhatsApp) => void; titulo: string; selo: string; descricao: string }) {
  return <button className={selecionado === modo ? 'is-selected' : ''} type="button" onClick={() => onChange(modo)}><span className="whatsapp-settings__radio" /><div><div><strong>{titulo}</strong><small>{selo}</small></div><p>{descricao}</p></div></button>
}
