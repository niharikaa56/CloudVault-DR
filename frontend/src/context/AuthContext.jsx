import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  authApi,
  healthApi,
  setInMemoryAuthToken,
  setUnauthorizedHandler,
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [dbStatus, setDbStatus] = useState({ configured: true, connected: true, checked: false });
  const [loadingHealth, setLoadingHealth] = useState(true);

  const checkHealth = useCallback(async (retry = false) => {
    try {
      const data = await healthApi.check(retry);
      setDbStatus({ ...data.db, checked: true });
      return data.db;
    } catch {
      const fallback = { configured: false, connected: false, checked: true, error: 'Server unreachable' };
      setDbStatus(fallback);
      return fallback;
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  const logout = useCallback(() => {
    setInMemoryAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    checkHealth();
  }, [checkHealth, logout]);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    setInMemoryAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await authApi.register({ name, email, password });
    setInMemoryAuthToken(data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const refreshProfile = useCallback(async () => {
    const data = await authApi.getMe();
    setUser(data.user);
    return data.user;
  }, []);

  const updateSettings = useCallback(async (payload) => {
    const data = await authApi.updateSettings(payload);
    setUser(data.user);
    return data;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        dbStatus,
        loadingHealth,
        checkHealth,
        login,
        register,
        logout,
        refreshProfile,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
