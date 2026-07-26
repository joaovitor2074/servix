import { useCallback, useEffect, useState } from 'react'
import { buscarFinanceiroPreview } from '../services/finance-preview.service'
import type { FinanceiroPreviewSnapshot } from '../types/finance.types'
import { obterMensagemErro } from '../utils/finance-formatters'

export function useFinanceiroPreview() {
  const [dados, setDados] = useState<FinanceiroPreviewSnapshot | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const recarregar = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true)
    setErro('')

    try {
      const snapshot = await buscarFinanceiroPreview({ signal })
      setDados(snapshot)
      return snapshot
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return null
      setErro(obterMensagemErro(error))
      return null
    } finally {
      if (!signal?.aborted) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    void buscarFinanceiroPreview({ signal: controller.signal })
      .then(snapshot => setDados(snapshot))
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setErro(obterMensagemErro(error))
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false)
      })

    return () => controller.abort()
  }, [])

  return {
    dados,
    carregando,
    erro,
    recarregar,
    atualizarDados: setDados,
  }
}
