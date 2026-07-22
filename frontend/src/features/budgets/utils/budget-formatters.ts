const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const formatadorData = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const formatadorDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatarMoeda(valor: string | number) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? formatadorMoeda.format(numero) : '—'
}

export function formatarData(valor: string | null | undefined) {
  if (!valor) return 'Sem validade'
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? '—' : formatadorData.format(data)
}

export function formatarDataHora(valor: string | null | undefined) {
  if (!valor) return '—'
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? '—' : formatadorDataHora.format(data)
}

export function formatarNumeroOrcamento(numero: number) {
  return `#${String(numero).padStart(5, '0')}`
}

export function formatarTelefone(telefone: string) {
  if (telefone.length === 11) {
    return telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }

  if (telefone.length === 10) {
    return telefone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }

  return telefone
}
