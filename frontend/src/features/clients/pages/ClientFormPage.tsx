import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { clienteSchema } from '../schemas/client.schema'
import {
  atualizarCliente,
  buscarCliente,
  criarCliente,
} from '../services/clients.service'
import type { Cliente } from '../types/client.types'
import './ClientFormPage.css'

export default function ClientFormPage() {
  const { id: idParam } = useParams()
  const navigate = useNavigate()
  const editando = idParam !== undefined
  const clienteId = Number(idParam)
  const idValido = Number.isInteger(clienteId) && clienteId > 0

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregando, setCarregando] = useState(editando)
  const [erroCarga, setErroCarga] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erroApi, setErroApi] = useState('')
  const [errosCampos, setErrosCampos] = useState<
    Record<string, string[] | undefined>
  >({})

  useEffect(() => {
    if (!editando || !idValido) return

    const controller = new AbortController()

    // Na edição buscamos a versão atual antes de preencher os campos. Cancelar
    // a chamada evita atualizar a tela se o usuário navegar para outro lugar.
    void buscarCliente(clienteId, { signal: controller.signal })
      .then(resultado => {
        setCliente(resultado)
        setErroCarga('')
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErroCarga(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar o cliente',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false)
      })

    return () => controller.abort()
  }, [clienteId, editando, idValido, tentativa])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErroApi('')

    const formData = new FormData(event.currentTarget)
    const dadosRecebidos = {
      nome: formData.get('nome'),
      telefone: formData.get('telefone'),
      email: formData.get('email'),
      cpfCnpj: formData.get('cpfCnpj'),
      endereco: formData.get('endereco'),
      observacoes: formData.get('observacoes'),
    }

    // O safeParse mantém os valores digitados na tela e devolve os erros por
    // campo sem lançar exceção, facilitando a apresentação acessível no form.
    const validacao = clienteSchema.safeParse(dadosRecebidos)

    if (!validacao.success) {
      setErrosCampos(validacao.error.flatten().fieldErrors)
      return
    }

    setErrosCampos({})
    setSalvando(true)

    try {
      if (editando) {
        await atualizarCliente(clienteId, validacao.data)
      } else {
        await criarCliente(validacao.data)
      }

      // A mensagem via state aparece uma vez na listagem sem poluir a URL.
      navigate('/clientes', {
        replace: true,
        state: {
          mensagem: editando
            ? 'Cliente atualizado com sucesso.'
            : 'Cliente cadastrado com sucesso.',
        },
      })
    } catch (error) {
      setErroApi(
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro inesperado',
      )
    } finally {
      setSalvando(false)
    }
  }

  if (editando && !idValido) {
    return (
      <FormFeedback
        title="Cliente inválido"
        message="O endereço informado não possui um identificador válido."
      />
    )
  }

  if (carregando) {
    return <ClientFormSkeleton />
  }

  if (editando && erroCarga) {
    return (
      <FormFeedback
        title="Não foi possível carregar o cliente"
        message={erroCarga}
        onRetry={() => {
          setCarregando(true)
          setErroCarga('')
          setTentativa(valor => valor + 1)
        }}
      />
    )
  }

  return (
    <div className="client-form-page">
      <header className="client-form-page__header">
        <Link to="/clientes" aria-label="Voltar para clientes">
          <ArrowLeftIcon />
        </Link>
        <div>
          <span className="client-form-page__eyebrow">Clientes</span>
          <h1>{editando ? 'Editar cliente' : 'Novo cliente'}</h1>
          <p>
            {editando
              ? 'Atualize os dados de contato e identificação.'
              : 'Cadastre os dados necessários para iniciar um atendimento.'}
          </p>
        </div>
      </header>

      <form className="client-form" onSubmit={handleSubmit} noValidate>
        <section className="client-form__section">
          <div className="client-form__section-header">
            <div className="client-form__section-icon">
              <UserIcon />
            </div>
            <div>
              <h2>Informações principais</h2>
              <p>Nome e telefone são obrigatórios.</p>
            </div>
          </div>

          <div className="client-form__grid">
            <FormField
              id="nome"
              label="Nome completo"
              required
              error={errosCampos.nome?.[0]}
            >
              <input
                id="nome"
                name="nome"
                type="text"
                defaultValue={cliente?.nome ?? ''}
                placeholder="Ex.: Maria da Silva"
                maxLength={120}
                autoComplete="name"
                required
                aria-invalid={Boolean(errosCampos.nome?.[0])}
                aria-describedby={campoDescribedBy('nome', errosCampos.nome?.[0])}
              />
            </FormField>

            <FormField
              id="telefone"
              label="Telefone"
              required
              hint="Use DDD e número. A máscara é opcional."
              error={errosCampos.telefone?.[0]}
            >
              <input
                id="telefone"
                name="telefone"
                type="tel"
                defaultValue={cliente?.telefone ?? ''}
                placeholder="(11) 99999-9999"
                maxLength={25}
                autoComplete="tel"
                required
                aria-invalid={Boolean(errosCampos.telefone?.[0])}
                aria-describedby={campoDescribedBy(
                  'telefone',
                  errosCampos.telefone?.[0],
                  true,
                )}
              />
            </FormField>

            <FormField
              id="email"
              label="E-mail"
              error={errosCampos.email?.[0]}
            >
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={cliente?.email ?? ''}
                placeholder="cliente@email.com"
                maxLength={254}
                autoComplete="email"
                aria-invalid={Boolean(errosCampos.email?.[0])}
                aria-describedby={campoDescribedBy('email', errosCampos.email?.[0])}
              />
            </FormField>

            <FormField
              id="cpfCnpj"
              label="CPF ou CNPJ"
              hint="Informe 11 dígitos para CPF ou 14 para CNPJ."
              error={errosCampos.cpfCnpj?.[0]}
            >
              <input
                id="cpfCnpj"
                name="cpfCnpj"
                type="text"
                inputMode="numeric"
                defaultValue={cliente?.cpfCnpj ?? ''}
                placeholder="000.000.000-00"
                maxLength={18}
                aria-invalid={Boolean(errosCampos.cpfCnpj?.[0])}
                aria-describedby={campoDescribedBy(
                  'cpfCnpj',
                  errosCampos.cpfCnpj?.[0],
                  true,
                )}
              />
            </FormField>
          </div>
        </section>

        <section className="client-form__section">
          <div className="client-form__section-header">
            <div className="client-form__section-icon client-form__section-icon--secondary">
              <LocationIcon />
            </div>
            <div>
              <h2>Informações adicionais</h2>
              <p>Dados opcionais para facilitar o atendimento.</p>
            </div>
          </div>

          <div className="client-form__grid client-form__grid--single">
            <FormField
              id="endereco"
              label="Endereço"
              error={errosCampos.endereco?.[0]}
            >
              <input
                id="endereco"
                name="endereco"
                type="text"
                defaultValue={cliente?.endereco ?? ''}
                placeholder="Rua, número, bairro e cidade"
                maxLength={300}
                autoComplete="street-address"
                aria-invalid={Boolean(errosCampos.endereco?.[0])}
                aria-describedby={campoDescribedBy(
                  'endereco',
                  errosCampos.endereco?.[0],
                )}
              />
            </FormField>

            <FormField
              id="observacoes"
              label="Observações"
              hint="Até 1.000 caracteres."
              error={errosCampos.observacoes?.[0]}
            >
              <textarea
                id="observacoes"
                name="observacoes"
                defaultValue={cliente?.observacoes ?? ''}
                placeholder="Preferências de contato ou informações úteis..."
                maxLength={1000}
                rows={5}
                aria-invalid={Boolean(errosCampos.observacoes?.[0])}
                aria-describedby={campoDescribedBy(
                  'observacoes',
                  errosCampos.observacoes?.[0],
                  true,
                )}
              />
            </FormField>
          </div>
        </section>

        {erroApi && (
          <div className="client-form__api-error" role="alert">
            <WarningIcon />
            <span>{erroApi}</span>
          </div>
        )}

        <div className="client-form__actions">
          <Link to="/clientes">Cancelar</Link>
          <button type="submit" disabled={salvando} aria-busy={salvando}>
            {salvando
              ? 'Salvando...'
              : editando
                ? 'Salvar alterações'
                : 'Cadastrar cliente'}
          </button>
        </div>
      </form>
    </div>
  )
}

interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}

function FormField({
  id,
  label,
  required = false,
  hint,
  error,
  children,
}: FormFieldProps) {
  return (
    <div className="client-form__field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small className="client-form__field-error" id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
    </div>
  )
}

interface FormFeedbackProps {
  title: string
  message: string
  onRetry?: () => void
}

function FormFeedback({ title, message, onRetry }: FormFeedbackProps) {
  return (
    <section className="client-form-feedback" role="alert">
      <div className="client-form-feedback__icon">
        <WarningIcon />
      </div>
      <h1>{title}</h1>
      <p>{message}</p>
      <div>
        <Link to="/clientes">Voltar para clientes</Link>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        )}
      </div>
    </section>
  )
}

function ClientFormSkeleton() {
  return (
    <div className="client-form-page client-form-page--loading" aria-busy="true">
      <span className="sr-only">Carregando formulário do cliente</span>
      <div className="client-form-skeleton client-form-skeleton--title" />
      <div className="client-form-skeleton client-form-skeleton--section" />
      <div className="client-form-skeleton client-form-skeleton--section" />
    </div>
  )
}

function campoDescribedBy(
  id: string,
  error?: string,
  hasHint = false,
) {
  if (error) return `${id}-error`
  return hasHint ? `${id}-hint` : undefined
}

interface IconProps {
  children: ReactNode
}

function Icon({ children }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  )
}

function ArrowLeftIcon() {
  return <Icon><path d="m15 18-6-6 6-6" /></Icon>
}

function UserIcon() {
  return <Icon><circle cx="12" cy="8" r="4" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></Icon>
}

function LocationIcon() {
  return <Icon><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></Icon>
}

function WarningIcon() {
  return <Icon><path d="M10.3 3.6 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 8v5M12 17h.01" /></Icon>
}
