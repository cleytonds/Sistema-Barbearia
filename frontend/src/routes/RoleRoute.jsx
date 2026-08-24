import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { RouteLoader } from '../components/ui/index.jsx';

export function RoleRoute({ roles, children }) {
  const { loading, isAuthenticated, hasAnyRole } = useAuth();
  if (loading) return <RouteLoader label="Validando permissões" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasAnyRole(roles)) return <Navigate to="/acesso-negado" replace />;
  return children ?? <Outlet />;
}
