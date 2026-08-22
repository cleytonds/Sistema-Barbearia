import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService.js';
import { authStorage } from '../utils/authStorage.js';
import { normalizeRoles } from '../routes/routeSecurity.js';

export const AuthContext = createContext(null);
export { normalizeRoles } from '../routes/routeSecurity.js';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    authStorage.clearLegacyToken();
    setUsuario(null);
  }, []);

  const applySession = useCallback((session) => {
    if (normalizeRoles(session?.usuario).length === 0) {
      throw new Error('Sessão autenticada inconsistente.');
    }
    setUsuario(session.usuario);
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    authStorage.clearLegacyToken();
    try {
      const response = await authService.me();
      if (normalizeRoles(response.usuario).length === 0)
        throw new Error('Sessão autenticada inconsistente.');
      setUsuario(response.usuario);
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, [clearSession]);

  useEffect(() => {
    initialize();
    const unauthorized = () => clearSession();
    window.addEventListener('auth:unauthorized', unauthorized);
    return () => window.removeEventListener('auth:unauthorized', unauthorized);
  }, [clearSession, initialize]);

  const login = useCallback(
    async (email, senha) => {
      const session = await authService.login(email, senha);
      applySession(session);
      return session.usuario;
    },
    [applySession],
  );

  const register = useCallback(
    async (data) => {
      const session = await authService.register(data);
      applySession(session);
      return session.usuario;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const changePassword = useCallback(
    async (data) => {
      const session = await authService.changePassword(data);
      applySession(session);
      return session.usuario;
    },
    [applySession],
  );

  const value = useMemo(() => {
    const papeis = normalizeRoles(usuario);
    return {
      usuario,
      papeis,
      papelPrincipal: usuario?.papelPrincipal ?? usuario?.perfil ?? null,
      loading,
      isAuthenticated: Boolean(usuario),
      initialize,
      login,
      logout,
      register,
      changePassword,
      forgotPassword: authService.forgotPassword,
      resetPassword: authService.resetPassword,
      hasRole: (role) => papeis.includes(role),
      hasAnyRole: (roles) => roles.some((role) => papeis.includes(role)),
    };
  }, [usuario, loading, initialize, login, logout, register, changePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
