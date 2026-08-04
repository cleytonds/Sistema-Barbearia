import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext.jsx';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}
