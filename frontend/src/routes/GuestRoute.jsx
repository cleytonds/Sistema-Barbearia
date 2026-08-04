import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { homeByRole, safeInternalPath } from './routeSecurity.js';
export function GuestRoute() {
  const { loading, isAuthenticated, usuario } = useAuth();
  const location = useLocation();
  if (loading) return <main aria-busy="true">Validando sessão…</main>;
  if (!isAuthenticated) return <Outlet />;
  const intended = safeInternalPath(location.state?.from?.pathname);
  const target = usuario?.perfil === 'cliente' && intended ? intended : homeByRole(usuario?.perfil);
  return <Navigate to={target} replace />;
}
