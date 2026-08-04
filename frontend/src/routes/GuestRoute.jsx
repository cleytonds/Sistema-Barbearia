import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const internalPath = (value) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
export function GuestRoute() {
  const { loading, isAuthenticated, usuario } = useAuth();
  const location = useLocation();
  if (loading) return <main aria-busy="true">Validando sessão…</main>;
  if (!isAuthenticated) return <Outlet />;
  const intended = location.state?.from?.pathname;
  const target =
    usuario?.perfil === 'cliente' && internalPath(intended)
      ? intended
      : usuario?.perfil === 'cliente'
        ? '/meus-agendamentos'
        : '/';
  return <Navigate to={target} replace />;
}
