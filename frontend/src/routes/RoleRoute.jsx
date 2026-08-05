import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export function RoleRoute({ roles, children }) {
  const { loading, isAuthenticated, hasAnyRole } = useAuth();
  if (loading) return <main aria-busy="true">Validando permissões...</main>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasAnyRole(roles)) return <Navigate to="/acesso-negado" replace />;
  return children ?? <Outlet />;
}
