import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  loginOnline, hasCompletedFirstLogin, getCachedUser, unlockWithBiometrics, logout as logoutService,
} from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | needsFirstLogin | needsUnlock | authenticated

  useEffect(() => {
    (async () => {
      const completed = await hasCompletedFirstLogin();
      if (!completed) {
        setStatus('needsFirstLogin');
        return;
      }
      const cachedUser = await getCachedUser();
      setUser(cachedUser);
      setStatus('needsUnlock');
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const loggedInUser = await loginOnline(email, password);
    setUser(loggedInUser);
    setStatus('authenticated');
    return loggedInUser;
  }, []);

  const unlock = useCallback(async () => {
    const result = await unlockWithBiometrics();
    if (result.unlocked) {
      setStatus('authenticated');
    }
    return result;
  }, []);

  const requirePasswordLogin = useCallback(() => {
    setStatus('needsFirstLogin');
  }, []);

  const logout = useCallback(async () => {
    await logoutService();
    setUser(null);
    setStatus('needsFirstLogin');
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, unlock, logout, requirePasswordLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
