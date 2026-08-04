import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (loading) return <main aria-busy="true">Validando sessão...</main>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children ?? <Outlet />;
}

