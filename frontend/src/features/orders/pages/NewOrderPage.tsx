import { Navigate } from 'react-router'

// Compatibilidade para favoritos e links antigos: novas ordens agora nascem
// exclusivamente da conversão de um orçamento aprovado.
export default function NewOrderPage() {
  return <Navigate to="/orcamentos/novo" replace />
}
