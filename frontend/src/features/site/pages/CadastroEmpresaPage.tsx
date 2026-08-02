import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { cadastrarEmpresa } from '../site.service'
import {
  formatarMoeda,
  SERVIX_PLAN,
} from '../site-data'

type EtapaCadastro = 1 | 2 | 3

interface CadastroFormData {
  administradorNome: string
  administradorEmail: string
  administradorTelefone: string
  senha: string
  confirmarSenha: string
  nome: string
  tipoNegocio: string
  telefone: string
  email: string
  cpfCnpj: string
  cidade: string
  estado: string
  endereco: string
  slug: string
  aceitouTermos: boolean
  aceitouPrivacidade: boolean
  aceitouAmbienteTeste: boolean
}

const initialFormData: CadastroFormData = {
  administradorNome: '',
  administradorEmail: '',
  administradorTelefone: '',
  senha: '',
  confirmarSenha: '',
  nome: '',
  tipoNegocio: '',
  telefone: '',
  email: '',
  cpfCnpj: '',
  cidade: '',
  estado: '',
  endereco: '',
  slug: '',
  aceitouTermos: false,
  aceitouPrivacidade: false,
  aceitouAmbienteTeste: false,
}

const estados = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]

export default function CadastroEmpresaPage({
  onNovaEmpresaCriada,
}: {
  onNovaEmpresaCriada: () => void
}) {
  const navigate = useNavigate()
  const [etapa, setEtapa] = useState<EtapaCadastro>(1)
  const [dados, setDados] = useState(initialFormData)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [erroApi, setErroApi] = useState('')
  const [enviando, setEnviando] = useState(false)

  function atualizarCampo<K extends keyof CadastroFormData>(
    campo: K,
    valor: CadastroFormData[K],
  ) {
    setDados(atuais => ({ ...atuais, [campo]: valor }))
    setErros(atuais => {
      if (!atuais[campo]) return atuais
      const proximos = { ...atuais }
      delete proximos[campo]
      return proximos
    })
  }

  function atualizarNomeEmpresa(nome: string) {
    setDados(atuais => ({
      ...atuais,
      nome,
      slug:
        atuais.slug === slugify(atuais.nome) || atuais.slug === ''
          ? slugify(nome)
          : atuais.slug,
    }))
    setErros(atuais => {
      const proximos = { ...atuais }
      delete proximos.nome
      delete proximos.slug
      return proximos
    })
  }

  function validarEtapa(etapaAtual: EtapaCadastro) {
    const novosErros: Record<string, string> = {}

    if (etapaAtual === 1) {
      if (dados.administradorNome.trim().length < 2) {
        novosErros.administradorNome = 'Informe o nome do responsável.'
      }
      if (!emailValido(dados.administradorEmail)) {
        novosErros.administradorEmail = 'Informe um e-mail válido.'
      }
      const telefoneResponsavel = somenteDigitos(dados.administradorTelefone)
      if (telefoneResponsavel.length < 8 || telefoneResponsavel.length > 15) {
        novosErros.administradorTelefone = 'Informe um telefone com DDD.'
      }
      if (dados.senha.length < 8) {
        novosErros.senha = 'A senha deve ter pelo menos 8 caracteres.'
      }
      if (dados.confirmarSenha !== dados.senha) {
        novosErros.confirmarSenha = 'As senhas precisam ser iguais.'
      }
    }

    if (etapaAtual === 2) {
      const documento = somenteDigitos(dados.cpfCnpj)
      const telefone = somenteDigitos(dados.telefone)

      if (dados.nome.trim().length < 2) {
        novosErros.nome = 'Informe o nome da empresa.'
      }
      if (!dados.tipoNegocio) {
        novosErros.tipoNegocio = 'Selecione o tipo de negócio.'
      }
      if (![11, 14].includes(documento.length)) {
        novosErros.cpfCnpj = 'Informe um CPF ou CNPJ válido.'
      }
      if (dados.telefone && (telefone.length < 8 || telefone.length > 15)) {
        novosErros.telefone = 'Informe um telefone com DDD.'
      }
      if (dados.email && !emailValido(dados.email)) {
        novosErros.email = 'Informe um e-mail comercial válido.'
      }
      if (dados.cidade.trim().length < 2) {
        novosErros.cidade = 'Informe a cidade.'
      }
      if (!dados.estado) {
        novosErros.estado = 'Selecione o estado.'
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dados.slug)) {
        novosErros.slug = 'Use letras minúsculas, números e hífens.'
      }
    }

    if (etapaAtual === 3) {
      if (!dados.aceitouTermos) {
        novosErros.aceitouTermos = 'Aceite os Termos de Uso para continuar.'
      }
      if (!dados.aceitouPrivacidade) {
        novosErros.aceitouPrivacidade = 'Confirme a leitura da Política de Privacidade.'
      }
      if (!dados.aceitouAmbienteTeste) {
        novosErros.aceitouAmbienteTeste =
          'Confirme as condições do teste gratuito.'
      }
    }

    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) {
      requestAnimationFrame(() => {
        document.getElementById(Object.keys(novosErros)[0])?.focus()
      })
      return false
    }

    return true
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErroApi('')

    if (!validarEtapa(etapa)) return

    if (etapa < 3) {
      setEtapa((etapa + 1) as EtapaCadastro)
      requestAnimationFrame(() => {
        document.getElementById(`cadastro-etapa-${etapa + 1}`)?.focus()
      })
      return
    }

    setEnviando(true)

    try {
      const resposta = await cadastrarEmpresa({
        nome: dados.nome.trim(),
        slug: dados.slug.trim(),
        ...(dados.telefone.trim() && { telefone: dados.telefone.trim() }),
        ...(dados.email.trim() && { email: dados.email.trim() }),
        tipoNegocio: dados.tipoNegocio,
        cpfCnpj: somenteDigitos(dados.cpfCnpj),
        cidade: dados.cidade.trim(),
        estado: dados.estado,
        ...(dados.endereco.trim() && { endereco: dados.endereco.trim() }),
        planoCodigo: SERVIX_PLAN.codigo,
        aceitouTermos: true,
        administrador: {
          nome: dados.administradorNome.trim(),
          email: dados.administradorEmail.trim().toLowerCase(),
          telefone: somenteDigitos(dados.administradorTelefone),
          senha: dados.senha,
        },
      })

      // O cadastro é público e pode ser aberto enquanto outra empresa ainda
      // está autenticada neste navegador. Remova essa sessão antes de oferecer
      // o primeiro acesso para não redirecionar ao dashboard da empresa antiga.
      onNovaEmpresaCriada()
      navigate('/cadastro/concluido', {
        state: resposta,
      })
    } catch (erro) {
      setErroApi(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível concluir o cadastro.',
      )
    } finally {
      setEnviando(false)
    }
  }

  function voltarEtapa() {
    setErros({})
    setErroApi('')
    setEtapa(atual => Math.max(1, atual - 1) as EtapaCadastro)
  }

  return (
    <section className="signup-page">
      <div className="site-container signup-page__header">
        <p className="eyebrow">
          Teste gratuito de 5 dias
        </p>
        <h1>Crie a conta da sua empresa.</h1>
        <p>
          São três etapas rápidas. Sem cartão, sem assinatura antecipada e sem cobrança agora.
        </p>
      </div>

      <div className="site-container signup-layout">
        <div className="signup-panel">
          <ol className="signup-steps" aria-label="Etapas do cadastro">
            {[
              ['Responsável', 'Seus dados de acesso'],
              ['Empresa', 'Informações do negócio'],
              ['Plano', 'Resumo e aceites'],
            ].map(([titulo, descricao], index) => {
              const numero = (index + 1) as EtapaCadastro
              const concluida = etapa > numero
              return (
                <li
                  key={titulo}
                  className={concluida ? 'is-complete' : undefined}
                  aria-current={etapa === numero ? 'step' : undefined}
                >
                  <span aria-hidden="true">{concluida ? '✓' : numero}</span>
                  <div><strong>{titulo}</strong><small>{descricao}</small></div>
                </li>
              )
            })}
          </ol>

          <form className="signup-form" onSubmit={handleSubmit} noValidate>
            {etapa === 1 && (
              <fieldset>
                <legend id="cadastro-etapa-1" tabIndex={-1}>Dados do responsável</legend>
                <p className="signup-form__intro">Este será o primeiro administrador da empresa.</p>
                <div className="signup-form__grid">
                  <Field
                    id="administradorNome"
                    label="Nome completo"
                    error={erros.administradorNome}
                    full
                  >
                    <input
                      id="administradorNome"
                      name="administradorNome"
                      value={dados.administradorNome}
                      onChange={event => atualizarCampo('administradorNome', event.target.value)}
                      autoComplete="name"
                      aria-invalid={Boolean(erros.administradorNome)}
                      aria-describedby={errorId('administradorNome', erros.administradorNome)}
                    />
                  </Field>
                  <Field
                    id="administradorEmail"
                    label="E-mail de acesso"
                    error={erros.administradorEmail}
                  >
                    <input
                      id="administradorEmail"
                      name="administradorEmail"
                      type="email"
                      value={dados.administradorEmail}
                      onChange={event => atualizarCampo('administradorEmail', event.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      aria-invalid={Boolean(erros.administradorEmail)}
                      aria-describedby={errorId('administradorEmail', erros.administradorEmail)}
                    />
                  </Field>
                  <Field
                    id="administradorTelefone"
                    label="Telefone"
                    error={erros.administradorTelefone}
                  >
                    <input
                      id="administradorTelefone"
                      name="administradorTelefone"
                      type="tel"
                      value={dados.administradorTelefone}
                      onChange={event => atualizarCampo('administradorTelefone', event.target.value)}
                      inputMode="tel"
                      autoComplete="tel"
                      aria-invalid={Boolean(erros.administradorTelefone)}
                      aria-describedby={errorId('administradorTelefone', erros.administradorTelefone)}
                    />
                  </Field>
                  <Field id="senha" label="Senha" error={erros.senha} hint="Use pelo menos 8 caracteres.">
                    <input
                      id="senha"
                      name="senha"
                      type="password"
                      value={dados.senha}
                      onChange={event => atualizarCampo('senha', event.target.value)}
                      autoComplete="new-password"
                      aria-invalid={Boolean(erros.senha)}
                      aria-describedby={describedBy('senha', erros.senha, true)}
                    />
                  </Field>
                  <Field id="confirmarSenha" label="Confirmar senha" error={erros.confirmarSenha}>
                    <input
                      id="confirmarSenha"
                      name="confirmarSenha"
                      type="password"
                      value={dados.confirmarSenha}
                      onChange={event => atualizarCampo('confirmarSenha', event.target.value)}
                      autoComplete="new-password"
                      aria-invalid={Boolean(erros.confirmarSenha)}
                      aria-describedby={errorId('confirmarSenha', erros.confirmarSenha)}
                    />
                  </Field>
                </div>
              </fieldset>
            )}

            {etapa === 2 && (
              <fieldset>
                <legend id="cadastro-etapa-2" tabIndex={-1}>Dados da empresa</legend>
                <p className="signup-form__intro">Use os dados do negócio que administrará o Servix.</p>
                <div className="signup-form__grid">
                  <Field id="nome" label="Nome da empresa" error={erros.nome} full>
                    <input
                      id="nome"
                      name="nome"
                      value={dados.nome}
                      onChange={event => atualizarNomeEmpresa(event.target.value)}
                      autoComplete="organization"
                      aria-invalid={Boolean(erros.nome)}
                      aria-describedby={errorId('nome', erros.nome)}
                    />
                  </Field>
                  <Field id="tipoNegocio" label="Tipo de negócio" error={erros.tipoNegocio}>
                    <select
                      id="tipoNegocio"
                      name="tipoNegocio"
                      value={dados.tipoNegocio}
                      onChange={event => atualizarCampo('tipoNegocio', event.target.value)}
                      aria-invalid={Boolean(erros.tipoNegocio)}
                      aria-describedby={errorId('tipoNegocio', erros.tipoNegocio)}
                    >
                      <option value="">Selecione</option>
                      <option>Assistência técnica</option>
                      <option>Oficina e manutenção</option>
                      <option>Instalação e reparos</option>
                      <option>Serviços profissionais</option>
                      <option>Outro</option>
                    </select>
                  </Field>
                  <Field id="cpfCnpj" label="CPF ou CNPJ" error={erros.cpfCnpj}>
                    <input
                      id="cpfCnpj"
                      name="cpfCnpj"
                      value={dados.cpfCnpj}
                      onChange={event => atualizarCampo('cpfCnpj', event.target.value)}
                      inputMode="numeric"
                      autoComplete="off"
                      aria-invalid={Boolean(erros.cpfCnpj)}
                      aria-describedby={errorId('cpfCnpj', erros.cpfCnpj)}
                    />
                  </Field>
                  <Field id="telefone" label="Telefone comercial (opcional)" error={erros.telefone}>
                    <input
                      id="telefone"
                      name="telefone"
                      type="tel"
                      value={dados.telefone}
                      onChange={event => atualizarCampo('telefone', event.target.value)}
                      inputMode="tel"
                      autoComplete="tel"
                      aria-invalid={Boolean(erros.telefone)}
                      aria-describedby={errorId('telefone', erros.telefone)}
                    />
                  </Field>
                  <Field id="email" label="E-mail comercial (opcional)" error={erros.email}>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={dados.email}
                      onChange={event => atualizarCampo('email', event.target.value)}
                      inputMode="email"
                      autoComplete="email"
                      aria-invalid={Boolean(erros.email)}
                      aria-describedby={errorId('email', erros.email)}
                    />
                  </Field>
                  <Field id="cidade" label="Cidade" error={erros.cidade}>
                    <input
                      id="cidade"
                      name="cidade"
                      value={dados.cidade}
                      onChange={event => atualizarCampo('cidade', event.target.value)}
                      autoComplete="address-level2"
                      aria-invalid={Boolean(erros.cidade)}
                      aria-describedby={errorId('cidade', erros.cidade)}
                    />
                  </Field>
                  <Field id="estado" label="Estado" error={erros.estado}>
                    <select
                      id="estado"
                      name="estado"
                      value={dados.estado}
                      onChange={event => atualizarCampo('estado', event.target.value)}
                      autoComplete="address-level1"
                      aria-invalid={Boolean(erros.estado)}
                      aria-describedby={errorId('estado', erros.estado)}
                    >
                      <option value="">UF</option>
                      {estados.map(estado => <option key={estado}>{estado}</option>)}
                    </select>
                  </Field>
                  <Field id="endereco" label="Endereço (opcional)" full>
                    <input
                      id="endereco"
                      name="endereco"
                      value={dados.endereco}
                      onChange={event => atualizarCampo('endereco', event.target.value)}
                      autoComplete="street-address"
                    />
                  </Field>
                  <Field
                    id="slug"
                    label="Identificação da empresa"
                    error={erros.slug}
                    hint={`Será usada no login: ${dados.slug || 'minha-empresa'}`}
                    full
                  >
                    <div className="slug-input">
                      <span aria-hidden="true">servix.com.br/</span>
                      <input
                        id="slug"
                        name="slug"
                        value={dados.slug}
                        onChange={event => atualizarCampo('slug', slugify(event.target.value))}
                        autoCapitalize="none"
                        spellCheck={false}
                        aria-invalid={Boolean(erros.slug)}
                        aria-describedby={describedBy('slug', erros.slug, true)}
                      />
                    </div>
                  </Field>
                </div>
              </fieldset>
            )}

            {etapa === 3 && (
              <fieldset>
                <legend id="cadastro-etapa-3" tabIndex={-1}>Plano e confirmações</legend>
                <p className="signup-form__intro">
                  Revise o plano que poderá ser contratado somente ao final do teste.
                </p>

                <article className="signup-plan-summary">
                  <div>
                    <span className="status-pill">
                      5 dias grátis
                    </span>
                    <h2>{SERVIX_PLAN.nome}</h2>
                    <p>Todos os recursos essenciais para começar.</p>
                  </div>
                  <div className="signup-plan-summary__price">
                    <strong>{formatarMoeda(SERVIX_PLAN.valorMensal)}</strong>
                    <span>/{SERVIX_PLAN.periodicidade}</span>
                  </div>
                  <ul>
                    {SERVIX_PLAN.recursos.map(resource => (
                      <li key={resource}><span aria-hidden="true">✓</span>{resource}</li>
                    ))}
                  </ul>
                </article>

                <div className="signup-acceptances">
                  <CheckboxField
                    id="aceitouTermos"
                    checked={dados.aceitouTermos}
                    error={erros.aceitouTermos}
                    onChange={checked => atualizarCampo('aceitouTermos', checked)}
                  >
                    Li e aceito os <Link to="/termos-de-uso" target="_blank" rel="noreferrer">Termos de Uso</Link>.
                  </CheckboxField>
                  <CheckboxField
                    id="aceitouPrivacidade"
                    checked={dados.aceitouPrivacidade}
                    error={erros.aceitouPrivacidade}
                    onChange={checked => atualizarCampo('aceitouPrivacidade', checked)}
                  >
                    Li a <Link to="/politica-de-privacidade" target="_blank" rel="noreferrer">Política de Privacidade</Link>.
                  </CheckboxField>
                  <CheckboxField
                    id="aceitouAmbienteTeste"
                    checked={dados.aceitouAmbienteTeste}
                    error={erros.aceitouAmbienteTeste}
                    onChange={checked => atualizarCampo('aceitouAmbienteTeste', checked)}
                  >
                    Entendo que o teste dura 5 dias, não exige cartão e não gera cobrança ou renovação automática.
                  </CheckboxField>
                </div>
              </fieldset>
            )}

            {erroApi && <p className="form-alert" role="alert">{erroApi}</p>}

            <div className="signup-form__actions">
              {etapa > 1 && (
                <button type="button" className="button button--ghost" onClick={voltarEtapa} disabled={enviando}>
                  Voltar
                </button>
              )}
              <button
                type="submit"
                className="button button--primary"
                disabled={enviando}
                aria-busy={enviando}
              >
                {etapa < 3
                  ? 'Continuar'
                  : enviando
                    ? 'Criando empresa...'
                    : 'Iniciar teste gratuito'}
              </button>
            </div>
          </form>
        </div>

        <aside className="signup-security-note">
          <strong>Cadastro seguro e separado</strong>
          <p>
            Seus dados ficam salvos na conta da própria empresa. A contratação
            do plano só será oferecida quando os 5 dias terminarem.
          </p>
          <Link to="/planos" className="text-link">Rever o plano</Link>
        </aside>
      </div>
    </section>
  )
}

interface FieldProps {
  id: string
  label: string
  error?: string
  hint?: string
  full?: boolean
  children: React.ReactNode
}

function Field({ id, label, error, hint, full, children }: FieldProps) {
  return (
    <div className={`signup-field${full ? ' signup-field--full' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}
    </div>
  )
}

interface CheckboxFieldProps {
  id: string
  checked: boolean
  error?: string
  onChange: (checked: boolean) => void
  children: React.ReactNode
}

function CheckboxField({ id, checked, error, onChange, children }: CheckboxFieldProps) {
  return (
    <div className="checkbox-field">
      <label>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={event => onChange(event.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span>{children}</span>
      </label>
      {error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}
    </div>
  )
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function somenteDigitos(value: string) {
  return value.replace(/\D/g, '')
}

function emailValido(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function errorId(id: string, error?: string) {
  return error ? `${id}-error` : undefined
}

function describedBy(id: string, error?: string, hasHint?: boolean) {
  return [hasHint ? `${id}-hint` : '', error ? `${id}-error` : '']
    .filter(Boolean)
    .join(' ') || undefined
}
