import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export function RoleRoute({ roles, children }) {
  const { loading, isAuthenticated, usuario } = useAuth();
  if (loading) return <main aria-busy="true">Validando permissões...</main>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!roles.includes(usuario.perfil)) return <Navigate to="/" replace />;
  return children ?? <Outlet />;
}
