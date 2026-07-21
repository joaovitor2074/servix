import { Navigate, Route, Routes } from 'react-router'
import DashboardPage from '../features/dashboard/pages/DashboardPage'
import LoginPage from '../features/auth/pages/LoginPage'
import ClientFormPage from '../features/clients/pages/ClientFormPage'
import ClientsPage from '../features/clients/pages/ClientsPage'
import OrdersPage from '../features/orders/pages/OrdersPage'
import NewOrderPage from '../features/orders/pages/NewOrderPage'
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
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="clientes/novo" element={<ClientFormPage />} />
        <Route path="clientes/:id/editar" element={<ClientFormPage />} />
        <Route path="ordens" element={<OrdersPage />} />
        <Route path="ordens/nova" element={<NewOrderPage />} />
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
