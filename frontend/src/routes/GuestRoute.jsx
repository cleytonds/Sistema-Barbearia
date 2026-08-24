import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { resolvePostLoginDestination } from './routeSecurity.js';
import { RouteLoader } from '../components/ui/index.jsx';
export function GuestRoute() {
  const { loading, isAuthenticated, usuario } = useAuth();
  const location = useLocation();
  if (loading) return <RouteLoader label="Validando sessão" />;
  if (!isAuthenticated) return <Outlet />;
  const target = resolvePostLoginDestination(usuario, location.state?.from?.pathname);
  return <Navigate to={target} replace />;
}
