import type { UsuarioAutenticado } from '../../auth/types/auth.types'

interface DashboardPageProps {
  usuario: UsuarioAutenticado
}

export default function DashboardPage({
  usuario,
}: DashboardPageProps) {
  return (
    <>
      <h1>Dashboard</h1>

      <p>Olá, {usuario.nome}</p>
      <p>Empresa: {usuario.empresa.nome}</p>
      <p>Perfil: {usuario.papel}</p>
    </>
  )
}