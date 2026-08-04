import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService.js';
import { authStorage } from '../utils/authStorage.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    authStorage.clear();
    setToken(null);
    setUsuario(null);
  }, []);

  const applySession = useCallback((session) => {
    authStorage.setToken(session.accessToken);
    setToken(session.accessToken);
    setUsuario(session.usuario);
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    const storedToken = authStorage.getToken();
    if (!storedToken) {
      clearSession();
      setLoading(false);
      return;
    }
    setToken(storedToken);
    try {
      const response = await authService.me();
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

  const login = useCallback(async (email, senha) => {
    const session = await authService.login(email, senha);
    applySession(session);
    return session.usuario;
  }, [applySession]);

  const register = useCallback(async (data) => {
    const session = await authService.register(data);
    applySession(session);
    return session.usuario;
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      if (authStorage.getToken()) await authService.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const changePassword = useCallback(async (data) => {
    const session = await authService.changePassword(data);
    applySession(session);
    return session.usuario;
  }, [applySession]);

  const value = useMemo(() => ({
    usuario,
    token,
    loading,
    isAuthenticated: Boolean(usuario && token),
    initialize,
    login,
    logout,
    register,
    changePassword,
    forgotPassword: authService.forgotPassword,
    resetPassword: authService.resetPassword
  }), [usuario, token, loading, initialize, login, logout, register, changePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

