import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import type { UsuarioAutenticado } from '../features/auth/types/auth.types'
import { FINANCEIRO_PREVIEW_HABILITADO } from '../features/finance/config/finance-preview.config'

const AppLayout = lazy(() => import('../shared/layouts/AppLayout'))
const PublicLayout = lazy(() => import('../shared/layouts/PublicLayout'))
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'))
const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'))
const FinanceLayout = lazy(() => import('../features/finance/layouts/FinanceLayout'))
const FinanceCashFlowPage = lazy(() => import('../features/finance/pages/FinanceCashFlowPage'))
const FinanceDashboardPage = lazy(() => import('../features/finance/pages/FinanceDashboardPage'))
const FinanceEntriesPage = lazy(() => import('../features/finance/pages/FinanceEntriesPage'))
const FinanceMovementsPage = lazy(() => import('../features/finance/pages/FinanceMovementsPage'))
const FinanceRegistriesPage = lazy(() => import('../features/finance/pages/FinanceRegistriesPage'))
const ClientFormPage = lazy(() => import('../features/clients/pages/ClientFormPage'))
const ClientsPage = lazy(() => import('../features/clients/pages/ClientsPage'))
const BudgetDetailsPage = lazy(() => import('../features/budgets/pages/BudgetDetailsPage'))
const BudgetFormPage = lazy(() => import('../features/budgets/pages/BudgetFormPage'))
const BudgetsPage = lazy(() => import('../features/budgets/pages/BudgetsPage'))
const PublicBudgetPage = lazy(() => import('../features/budgets/pages/PublicBudgetPage'))
const EditOrderPage = lazy(() => import('../features/orders/pages/EditOrderPage'))
const NewOrderPage = lazy(() => import('../features/orders/pages/NewOrderPage'))
const OrderDetailsPage = lazy(() => import('../features/orders/pages/OrderDetailsPage'))
const OrdersPage = lazy(() => import('../features/orders/pages/OrdersPage'))
const PublicTrackingPage = lazy(() => import('../features/tracking/pages/PublicTrackingPage'))
const DemoPage = lazy(() => import('../features/demo/pages/DemoPage'))
const PaymentSettingsPage = lazy(() => import('../features/settings/payments/pages/PaymentSettingsPage'))
const SubscriptionSettingsPage = lazy(() => import('../features/settings/subscription/pages/SubscriptionSettingsPage'))
const CadastroConcluidoPage = lazy(() => import('../features/site/pages/CadastroConcluidoPage'))
const CadastroEmpresaPage = lazy(() => import('../features/site/pages/CadastroEmpresaPage'))
const CheckoutPage = lazy(() => import('../features/site/pages/CheckoutPage'))
const ContatoPage = lazy(() => import('../features/site/pages/ContatoPage'))
const HomePage = lazy(() => import('../features/site/pages/HomePage'))
const PlanosPage = lazy(() => import('../features/site/pages/PlanosPage'))
const AssinaturaSuspensaPage = lazy(() => import('../features/site/pages/AssinaturaSuspensaPage'))
const PoliticaPrivacidadePage = lazy(() => import('../features/site/pages/PoliticaPrivacidadePage'))
const PublicNotFoundPage = lazy(() => import('../features/site/pages/PublicNotFoundPage'))
const SuportePage = lazy(() => import('../features/site/pages/SuportePage'))
const TermosUsoPage = lazy(() => import('../features/site/pages/TermosUsoPage'))

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
    <Suspense fallback={<div className="route-loading" role="status">Carregando...</div>}>
      <Routes>
      <Route path="/demonstracao" element={<DemoPage />} />
      <Route path="/orcamento/:token" element={<PublicBudgetPage />} />
      <Route path="/acompanhar/:token" element={<PublicTrackingPage />} />

      <Route
        path="/login"
        element={
          usuario ? (
            <Navigate
              to={usuario.empresa.status === 'ATIVA' ? '/dashboard' : '/assinatura-suspensa'}
              replace
            />
          ) : (
            <LoginPage onLogin={onLogin} />
          )
        }
      />

      <Route
        element={
          usuario?.empresa.status === 'ATIVA' ? (
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
        <Route
          path="financeiro"
          element={
            FINANCEIRO_PREVIEW_HABILITADO && usuario?.papel === 'ADMIN' ? (
              <FinanceLayout />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        >
          <Route index element={<FinanceDashboardPage />} />
          <Route path="contas-a-receber" element={<FinanceEntriesPage tipo="RECEITA" />} />
          <Route path="contas-a-pagar" element={<FinanceEntriesPage tipo="DESPESA" />} />
          <Route path="movimentacoes" element={<FinanceMovementsPage />} />
          <Route path="fluxo-de-caixa" element={<FinanceCashFlowPage />} />
          <Route path="cadastros" element={<FinanceRegistriesPage />} />
        </Route>
        <Route
          path="configuracoes"
          element={
            usuario?.papel === 'ADMIN' ? (
              <Navigate to="/configuracoes/pagamentos" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="configuracoes/pagamentos"
          element={
            usuario?.papel === 'ADMIN' ? (
              <PaymentSettingsPage />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
        <Route
          path="configuracoes/assinatura"
          element={
            usuario?.papel === 'ADMIN' ? (
              <SubscriptionSettingsPage />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          }
        />
      </Route>

      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="planos" element={<PlanosPage />} />
        <Route
          path="assinatura-suspensa"
          element={
            <AssinaturaSuspensaPage
              usuario={usuario}
              onUsuarioAtualizado={onLogin}
              onLogout={onLogout}
            />
          }
        />
        <Route path="cadastro" element={<CadastroEmpresaPage />} />
        <Route path="cadastro/concluido" element={<CadastroConcluidoPage />} />
        <Route
          path="cadastro/concluido/:checkoutToken"
          element={<CadastroConcluidoPage />}
        />
        <Route path="checkout/:token" element={<CheckoutPage />} />
        <Route path="contato" element={<ContatoPage />} />
        <Route path="suporte" element={<SuportePage />} />
        <Route path="politica-de-privacidade" element={<PoliticaPrivacidadePage />} />
        <Route path="termos-de-uso" element={<TermosUsoPage />} />
        <Route path="*" element={<PublicNotFoundPage />} />
      </Route>
      </Routes>
    </Suspense>
  )
}
