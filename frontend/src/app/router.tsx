import { Navigate, Route, Routes } from 'react-router'
import DashboardPage from '../features/dashboard/pages/DashboardPage'
import LoginPage from '../features/auth/pages/LoginPage'
import ClientFormPage from '../features/clients/pages/ClientFormPage'
import ClientsPage from '../features/clients/pages/ClientsPage'
import BudgetDetailsPage from '../features/budgets/pages/BudgetDetailsPage'
import BudgetFormPage from '../features/budgets/pages/BudgetFormPage'
import BudgetsPage from '../features/budgets/pages/BudgetsPage'
import PublicBudgetPage from '../features/budgets/pages/PublicBudgetPage'
import EditOrderPage from '../features/orders/pages/EditOrderPage'
import NewOrderPage from '../features/orders/pages/NewOrderPage'
import OrderDetailsPage from '../features/orders/pages/OrderDetailsPage'
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
      <Route path="/orcamento/:token" element={<PublicBudgetPage />} />

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
        <Route path="orcamentos" element={<BudgetsPage />} />
        <Route path="orcamentos/novo" element={<BudgetFormPage />} />
        <Route path="orcamentos/:id/editar" element={<BudgetFormPage />} />
        <Route path="orcamentos/:id" element={<BudgetDetailsPage />} />
        <Route path="ordens" element={<OrdersPage />} />
        <Route path="ordens/nova" element={<NewOrderPage />} />
        <Route path="ordens/:id/editar" element={<EditOrderPage />} />
        <Route path="ordens/:id" element={<OrderDetailsPage />} />
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
