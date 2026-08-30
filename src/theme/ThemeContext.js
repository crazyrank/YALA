import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { lightColors, darkColors } from './colors';

const THEME_PREFERENCE_KEY = 'ysis_theme_preference';

const ThemeContext = createContext({
  colors: lightColors,
  scheme: 'light',
  isDark: false,
  preference: 'system',
  setPreference: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [preference, setPreferenceState] = useState('system'); // 'system' | 'light' | 'dark'

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(THEME_PREFERENCE_KEY);
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      } catch (error) {
        console.warn('Could not load theme preference:', error);
      }
    })();
  }, []);

  const setPreference = useCallback(async (next) => {
    setPreferenceState(next);
    try {
      await SecureStore.setItemAsync(THEME_PREFERENCE_KEY, next);
    } catch (error) {
      console.warn('Could not save theme preference:', error);
    }
  }, []);

  const value = useMemo(() => {
    const effectiveScheme = preference === 'system' ? systemScheme : preference;
    const isDark = effectiveScheme === 'dark';
    return {
      colors: isDark ? darkColors : lightColors,
      scheme: isDark ? 'dark' : 'light',
      isDark,
      preference,
      setPreference,
    };
  }, [preference, systemScheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
