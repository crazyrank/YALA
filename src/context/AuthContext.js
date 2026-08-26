import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  loginOnline,
  hasCompletedFirstLogin,
  getCachedUser,
  unlockWithBiometrics,
  logout as logoutService,
} from '../services/auth';
import {
  getStoredProfilePhotoUri,
  saveProfilePhoto,
  clearStoredProfilePhoto,
} from '../services/profilePhoto';

const AuthContext = createContext(null);
const ONBOARDING_SEEN_KEY = 'ysis_onboarding_seen';
const USER_CACHE_KEY = 'ysis_user_cache';

async function withLocalPhoto(user) {
  if (!user?.id) return user;
  const localUri = await getStoredProfilePhotoUri(user.id);
  if (localUri) {
    return { ...user, photo_url: localUri };
  }
  return user;
}

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
    const enriched = await withLocalPhoto(cachedUser);
    setUser(enriched);
    setStatus('needsUnlock');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const onboardingSeen = await SecureStore.getItemAsync(ONBOARDING_SEEN_KEY);

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
    const enriched = await withLocalPhoto(loggedInUser);
    setUser(enriched);
    setStatus('authenticated');
    return enriched;
  }, []);

  const unlock = useCallback(async () => {
    const result = await unlockWithBiometrics();

    if (result.unlocked) {
      const cachedUser = await getCachedUser();
      const enriched = await withLocalPhoto(cachedUser);
      setUser(enriched);
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

  /**
   * All roles (director, principal, head_teacher) may set/change
   * their own profile photo. Stored on-device; ready to sync later.
   */
  const updateProfilePhoto = useCallback(
    async (sourceUri) => {
      if (!user?.id) {
        throw new Error('Not signed in.');
      }
      const dest = await saveProfilePhoto(user.id, sourceUri);
      const next = { ...user, photo_url: dest };
      setUser(next);
      await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(next));
      return dest;
    },
    [user]
  );

  const removeProfilePhoto = useCallback(async () => {
    if (!user?.id) return;
    await clearStoredProfilePhoto(user.id);
    const next = { ...user };
    delete next.photo_url;
    setUser(next);
    await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(next));
  }, [user]);

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
        updateProfilePhoto,
        removeProfilePhoto,
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
