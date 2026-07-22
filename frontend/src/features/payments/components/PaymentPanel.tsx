import { useEffect, useState, type FormEvent } from 'react'
import {
  FORMA_PAGAMENTO_LABELS,
  type FormaPagamento,
  type OrdemServico,
} from '../../../shared/types/ordem.types'
import {
  estornarPagamento,
  listarPagamentos,
  PagamentoApiError,
  registrarPagamento,
} from '../services/payments.service'
import type { ListaPagamentosResposta } from '../types/payment.types'
import './PaymentPanel.css'

const FORMAS_REGISTRO = [
  'PIX',
  'DINHEIRO',
  'CARTAO_CREDITO',
  'CARTAO_DEBITO',
  'BOLETO',
  'OUTRO',
] as const satisfies readonly Exclude<FormaPagamento, 'NAO_INFORMADA'>[]

const STATUS_RESUMO_LABELS = {
  PENDENTE: 'Pendente',
  PARCIAL: 'Parcial',
  PAGO: 'Quitado',
  ESTORNADO: 'Estornado',
} as const

interface PaymentPanelProps {
  ordem: OrdemServico
  onChanged: () => void
}

export default function PaymentPanel({ ordem, onChanged }: PaymentPanelProps) {
  const [dados, setDados] = useState<ListaPagamentosResposta | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    void listarPagamentos(ordem.id, { signal: controller.signal })
      .then(resultado => setDados(resultado))
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErro(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os pagamentos.',
        )
      })
      .finally(() => setCarregando(false))

    return () => controller.abort()
  }, [ordem.id, tentativa])

  function recarregar() {
    setCarregando(true)
    setErro('')
    onChanged()
    setTentativa(valor => valor + 1)
  }

  async function handleRegistrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dados || salvando) return

    const formulario = event.currentTarget
    const formData = new FormData(formulario)
    const valor = Number(String(formData.get('valor')).replace(',', '.'))
    const formaPagamento = formData.get('formaPagamento') as
      Exclude<FormaPagamento, 'NAO_INFORMADA'>
    const pagoEm = String(formData.get('pagoEm') ?? '').trim()
    const observacao = String(formData.get('observacao') ?? '').trim()

    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um valor de pagamento maior que zero.')
      return
    }

    setSalvando(true)
    setErro('')

    try {
      const resultado = await registrarPagamento(ordem.id, {
        statusEsperado: dados.statusOrdem,
        versaoEsperada: dados.versaoOrdem,
        valor,
        formaPagamento,
        ...(pagoEm && { pagoEm: new Date(pagoEm).toISOString() }),
        ...(observacao && { observacao }),
      })

      setDados(atual => atual && ({
        pagamentos: [resultado.pagamento, ...atual.pagamentos],
        resumo: resultado.resumo,
        statusOrdem: atual.statusOrdem,
        versaoOrdem: resultado.versaoOrdem,
      }))
      formulario.reset()
      onChanged()
    } catch (error) {
      setErro(obterMensagemErro(error))
    } finally {
      setSalvando(false)
    }
  }

  async function handleEstornar(pagamentoId: number) {
    if (!dados || salvando) return

    const motivo = window.prompt('Informe o motivo do estorno:')?.trim()
    if (!motivo) return
    if (motivo.length < 3) {
      setErro('O motivo do estorno precisa ter ao menos 3 caracteres.')
      return
    }

    setSalvando(true)
    setErro('')

    try {
      const resultado = await estornarPagamento(ordem.id, pagamentoId, {
        statusEsperado: dados.statusOrdem,
        versaoEsperada: dados.versaoOrdem,
        motivo,
      })

      setDados(atual => atual && ({
        pagamentos: atual.pagamentos.map(pagamento =>
          pagamento.id === resultado.pagamento.id
            ? resultado.pagamento
            : pagamento,
        ),
        resumo: resultado.resumo,
        statusOrdem: atual.statusOrdem,
        versaoOrdem: resultado.versaoOrdem,
      }))
      onChanged()
    } catch (error) {
      setErro(obterMensagemErro(error))
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <div className="payment-panel__loading">Carregando pagamentos…</div>
  }

  if (!dados) {
    return (
      <div className="payment-panel__feedback" role="alert">
        <p>{erro || 'Não foi possível carregar os pagamentos.'}</p>
        <button type="button" onClick={recarregar}>
          Tentar novamente
        </button>
      </div>
    )
  }

  const finalizada =
    dados.statusOrdem === 'ENTREGUE' || dados.statusOrdem === 'CANCELADO'
  const podeRegistrar = !finalizada && dados.resumo.status !== 'PAGO'

  return (
    <div className="payment-panel">
      <div className="payment-panel__summary">
        <span className={`payment-panel__badge payment-panel__badge--${dados.resumo.status.toLowerCase()}`}>
          {STATUS_RESUMO_LABELS[dados.resumo.status]}
        </span>
        <dl>
          <div><dt>Total</dt><dd>{formatarMoeda(dados.resumo.valorTotal)}</dd></div>
          <div><dt>Pago</dt><dd>{formatarMoeda(dados.resumo.totalPago)}</dd></div>
          <div><dt>Saldo</dt><dd>{formatarMoeda(dados.resumo.saldo)}</dd></div>
        </dl>
      </div>

      {erro && (
        <div className="payment-panel__error" role="alert">
          <span>{erro}</span>
          <button type="button" onClick={recarregar}>
            Recarregar
          </button>
        </div>
      )}

      {podeRegistrar && (
        <form
          className="payment-panel__form"
          key={`${dados.versaoOrdem}-${dados.resumo.saldo}`}
          onSubmit={handleRegistrar}
        >
          <h3>Registrar pagamento</h3>
          <div className="payment-panel__form-grid">
            <label>
              <span>Valor</span>
              <input
                name="valor"
                type="number"
                min="0.01"
                max={dados.resumo.saldo}
                step="0.01"
                defaultValue={dados.resumo.saldo}
                required
              />
            </label>
            <label>
              <span>Forma</span>
              <select name="formaPagamento" defaultValue="PIX" required>
                {FORMAS_REGISTRO.map(forma => (
                  <option key={forma} value={forma}>
                    {FORMA_PAGAMENTO_LABELS[forma]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Pago em</span>
              <input name="pagoEm" type="datetime-local" />
            </label>
            <label className="payment-panel__form-observation">
              <span>Observação</span>
              <input name="observacao" type="text" maxLength={1000} />
            </label>
          </div>
          <button type="submit" disabled={salvando}>
            {salvando ? 'Registrando…' : 'Confirmar pagamento'}
          </button>
        </form>
      )}

      {finalizada && (
        <p className="payment-panel__closed">
          O histórico financeiro fica somente para consulta após a finalização.
        </p>
      )}

      <div className="payment-panel__ledger">
        <h3>Histórico financeiro</h3>
        {dados.pagamentos.length === 0 ? (
          <p className="payment-panel__empty">Nenhum pagamento registrado.</p>
        ) : (
          <ul>
            {dados.pagamentos.map(pagamento => (
              <li key={pagamento.id}>
                <div>
                  <strong>{formatarMoeda(pagamento.valor)}</strong>
                  <span>{FORMA_PAGAMENTO_LABELS[pagamento.formaPagamento]}</span>
                  <time dateTime={pagamento.pagoEm}>
                    {formatarDataHora(pagamento.pagoEm)}
                  </time>
                </div>
                <div className="payment-panel__ledger-status">
                  <span className={pagamento.status === 'ESTORNADO' ? 'is-refunded' : ''}>
                    {pagamento.status === 'ESTORNADO' ? 'Estornado' : 'Confirmado'}
                  </span>
                  {pagamento.status === 'CONFIRMADO' && !finalizada && (
                    <button
                      type="button"
                      disabled={salvando}
                      onClick={() => void handleEstornar(pagamento.id)}
                    >
                      Estornar
                    </button>
                  )}
                </div>
                {pagamento.motivoEstorno && (
                  <p>Motivo: {pagamento.motivoEstorno}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function obterMensagemErro(error: unknown) {
  if (error instanceof PagamentoApiError && error.status === 409) {
    return `${error.message} Recarregue os dados da ordem.`
  }
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatadorDataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatarMoeda(valor: string) {
  return formatadorMoeda.format(Number(valor))
}

function formatarDataHora(valor: string) {
  return formatadorDataHora.format(new Date(valor))
}
