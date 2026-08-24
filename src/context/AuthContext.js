import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  loginOnline,
  hasCompletedFirstLogin,
  getCachedUser,
  unlockWithBiometrics,
  logout as logoutService,
} from '../services/auth';

const AuthContext = createContext(null);
const ONBOARDING_SEEN_KEY = 'ysis_onboarding_seen';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const resolvePostOnboardingStatus = useCallback(async () => {
    const completed = await hasCompletedFirstLogin();

    if (!completed) {
      setStatus('needsFirstLogin');
      return;
    }

    const cachedUser = await getCachedUser();
    setUser(cachedUser);
    setStatus('needsUnlock');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const onboardingSeen = await SecureStore.getItemAsync(
          ONBOARDING_SEEN_KEY
        );

        if (onboardingSeen !== 'true') {
          setStatus('onboarding');
          return;
        }

        await resolvePostOnboardingStatus();
      } catch (error) {
        console.warn('Auth initialization failed:', error);
        setStatus('needsFirstLogin');
      }
    })();
  }, [resolvePostOnboardingStatus]);

  const finishOnboarding = useCallback(async () => {
    await SecureStore.setItemAsync(ONBOARDING_SEEN_KEY, 'true');
    await resolvePostOnboardingStatus();
  }, [resolvePostOnboardingStatus]);

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
    <AuthContext.Provider
      value={{
        user,
        status,
        login,
        unlock,
        logout,
        requirePasswordLogin,
        finishOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}
