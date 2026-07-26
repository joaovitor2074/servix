import { useEffect, useRef } from 'react'

export function useFinanceDialogBehavior(
  onClose: () => void,
  busy: boolean,
  initialRef: { current: HTMLElement | null },
) {
  const dialogRef = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  const busyRef = useRef(busy)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    busyRef.current = busy
  }, [busy])

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow
    const focoAnterior = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    document.body.style.overflow = 'hidden'
    const quadro = window.requestAnimationFrame(() => {
      const alvoInicial = initialRef.current ?? obterElementosFocaveis(dialogRef.current)[0]
      const destinoInicial = alvoInicial ?? dialogRef.current
      destinoInicial?.focus({ preventScroll: true })
    })

    function controlarTeclado(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focaveis = obterElementosFocaveis(dialogRef.current)
      if (focaveis.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault()
        const destino = event.shiftKey ? ultimo : primeiro
        destino.focus()
      } else if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', controlarTeclado)
    return () => {
      window.cancelAnimationFrame(quadro)
      document.body.style.overflow = overflowAnterior
      document.removeEventListener('keydown', controlarTeclado)
      focoAnterior?.focus({ preventScroll: true })
    }
  }, [initialRef])

  return dialogRef
}

function obterElementosFocaveis(container: HTMLElement | null) {
  if (!container) return []
  return Array.from(container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(elemento => !elemento.hidden && elemento.getAttribute('aria-hidden') !== 'true')
}
