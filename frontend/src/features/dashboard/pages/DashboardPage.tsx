import type { UsuarioAutenticado } from "../../auth/types/auth.types"

interface DashboardPageProps {
    usuario: UsuarioAutenticado
    onLogout:()=> void
}


export default function DashboardPage({usuario,onLogout}:DashboardPageProps){

  return (
    <main>
      <h1>Dashboard</h1>

      <p>Olá, {usuario.nome}</p>
      <p>Empresa: {usuario.empresa.nome}</p>
      <p>Perfil: {usuario.papel}</p>

      <button type="button" onClick={onLogout}>
        Sair
      </button>
    </main>
  )
}