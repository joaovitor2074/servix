import { Navigate, Route, Routes } from 'react-router'
import DashboardPage from '../features/dashboard/pages/DashboardPage'
import LoginPage from '../features/auth/pages/LoginPage'
import OrdersPage from '../features/orders/pages/OrdersPage'
import type { UsuarioAutenticado } from '../features/auth/types/auth.types'
import AppLayout from '../shared/layouts/AppLayout'

interface AppRouterProps {
  usuario: UsuarioAutenticado | null
  onLogin: (usuario: UsuarioAutenticado) => void
  onLogout: () => void
}

export default function AppRouter({
  usuario,
  onLogin,
  onLogout,
}: AppRouterProps) {
  const dashboard = usuario ? (
    <DashboardPage usuario={usuario} />
  ) : null

  return (
    <Routes>
      <Route
        path="/login"
        element={
          usuario ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage onLogin={onLogin} />
          )
        }
      />

      <Route
        element={
          usuario ? (
            <AppLayout
              usuario={usuario}
              onLogout={onLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="dashboard" element={dashboard} />
        <Route path="ordens" element={<OrdersPage />} />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={usuario ? '/dashboard' : '/login'}
            replace
          />
        }
      />
    </Routes>
  )
}
