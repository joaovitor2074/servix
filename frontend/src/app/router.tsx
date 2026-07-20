import { Navigate, Route, Routes } from 'react-router';
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import LoginPage from '../features/auth/pages/LoginPage';
import type { UsuarioAutenticado } from '../features/auth/types/auth.types';

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
        path="/dashboard"
        element={
          usuario ? (
            <DashboardPage usuario={usuario} onLogout={onLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="*"
        element={
          <Navigate to={usuario ? '/dashboard' : '/login'} replace />
        }
      />
    </Routes>
  );
}
