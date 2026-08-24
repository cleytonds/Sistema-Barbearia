import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { RouteLoader } from '../components/ui/index.jsx';

export function ProtectedRoute({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (loading) return <RouteLoader label="Validando sessão" />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return children ?? <Outlet />;
}
