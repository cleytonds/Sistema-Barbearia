import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { resolvePostLoginDestination } from './routeSecurity.js';
export function GuestRoute() {
  const { loading, isAuthenticated, usuario } = useAuth();
  const location = useLocation();
  if (loading) return <main aria-busy="true">Validando sessão…</main>;
  if (!isAuthenticated) return <Outlet />;
  const target = resolvePostLoginDestination(usuario, location.state?.from?.pathname);
  return <Navigate to={target} replace />;
}
