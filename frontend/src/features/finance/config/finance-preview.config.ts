// Fail-closed: a área só existe quando o ambiente declara explicitamente PREVIEW.
export const FINANCEIRO_PREVIEW_HABILITADO =
  import.meta.env.VITE_FINANCEIRO_PREVIEW_MODE?.trim().toUpperCase() === 'PREVIEW'
