import { useEffect, useState } from 'react'
import { buscarCatalogoAssinaturas } from './site.service'
import type { CatalogoAssinaturasData } from './site.types'

export function useCatalogoAssinaturas() {
  const [catalogo, setCatalogo] = useState<CatalogoAssinaturasData | null>(null)
  const [erroCatalogo, setErroCatalogo] = useState('')
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    buscarCatalogoAssinaturas(controller.signal)
      .then(resultado => {
        setCatalogo(resultado)
        setErroCatalogo('')
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setErroCatalogo(
          error instanceof Error
            ? error.message
            : 'Não foi possível consultar o ambiente da assinatura.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregandoCatalogo(false)
      })

    return () => controller.abort()
  }, [])

  return { catalogo, erroCatalogo, carregandoCatalogo }
}
