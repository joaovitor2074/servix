import { useEffect, useState } from 'react'
import { FORMA_PAGAMENTO_LABELS } from '../../../shared/types/ordem.types'
import { listarCobrancas } from '../services/charges.service'
import {
  STATUS_COBRANCA_LABELS,
  type CobrancaInterna,
} from '../types/charge.types'
import './ChargePanel.css'

interface ChargePanelProps {
  orcamentoId?: number
  ordemId?: number
}

export default function ChargePanel({
  orcamentoId,
  ordemId,
}: ChargePanelProps) {
  const [cobrancas, setCobrancas] = useState<CobrancaInterna[] | null>(null)
  const [erro, setErro] = useState('')
  const [tentativa, setTentativa] = useState(0)
  const [copiada, setCopiada] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    void listarCobrancas(
      { orcamentoId, ordemId, limite: 100 },
      { signal: controller.signal },
    )
      .then(resultado => {
        setCobrancas(resultado.cobrancas)
        setErro('')
      })
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErro(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar as cobranças.',
        )
      })

    return () => controller.abort()
  }, [orcamentoId, ordemId, tentativa])

  function recarregar() {
    setCobrancas(null)
    setErro('')
    setTentativa(valor => valor + 1)
  }

  async function copiarCodigo(cobranca: CobrancaInterna) {
    if (!cobranca.codigoPix) return

    try {
      await navigator.clipboard.writeText(cobranca.codigoPix)
      setCopiada(cobranca.id)
      window.setTimeout(() => setCopiada(null), 2000)
    } catch {
      setErro('Não foi possível copiar o código Pix automaticamente.')
    }
  }

  if (!cobrancas && !erro) {
    return <div className="charge-panel__loading">Carregando cobranças…</div>
  }

  if (!cobrancas) {
    return (
      <div className="charge-panel__feedback" role="alert">
        <p>{erro}</p>
        <button type="button" onClick={recarregar}>Tentar novamente</button>
      </div>
    )
  }

  if (cobrancas.length === 0) {
    return (
      <div className="charge-panel__empty">
        Nenhuma cobrança por gateway foi gerada para este orçamento.
      </div>
    )
  }

  return (
    <div className="charge-panel">
      {erro && (
        <div className="charge-panel__warning" role="alert">
          <span>{erro}</span>
          <button type="button" onClick={() => setErro('')}>Fechar</button>
        </div>
      )}

      <ul className="charge-panel__list">
        {cobrancas.map(cobranca => (
          <li className="charge-panel__item" key={cobranca.id}>
            <div className="charge-panel__heading">
              <div>
                <span>Cobrança #{cobranca.id}</span>
                <strong>{formatarMoeda(cobranca.valor)}</strong>
              </div>
              <span
                className={`charge-panel__status charge-panel__status--${cobranca.status.toLowerCase()}`}
              >
                {STATUS_COBRANCA_LABELS[cobranca.status]}
              </span>
            </div>

            <dl className="charge-panel__details">
              <div>
                <dt>Forma</dt>
                <dd>{FORMA_PAGAMENTO_LABELS[cobranca.formaPagamento]}</dd>
              </div>
              <div>
                <dt>Gerada em</dt>
                <dd>{formatarDataHora(cobranca.criadoEm)}</dd>
              </div>
              <div>
                <dt>{cobranca.status === 'PAGA' ? 'Paga em' : 'Vencimento'}</dt>
                <dd>
                  {formatarDataHora(
                    cobranca.status === 'PAGA'
                      ? cobranca.pagaEm
                      : cobranca.expiraEm,
                  )}
                </dd>
              </div>
            </dl>

            {cobranca.codigoPix && cobranca.status === 'PENDENTE' && (
              <div className="charge-panel__pix">
                <label htmlFor={`codigo-pix-${cobranca.id}`}>
                  Pix copia e cola
                </label>
                <div>
                  <input
                    id={`codigo-pix-${cobranca.id}`}
                    readOnly
                    value={cobranca.codigoPix}
                  />
                  <button
                    type="button"
                    onClick={() => void copiarCodigo(cobranca)}
                  >
                    {copiada === cobranca.id ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
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

function formatarDataHora(valor: string | null) {
  if (!valor) return 'Não informado'
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? 'Não informado' : formatadorDataHora.format(data)
}
