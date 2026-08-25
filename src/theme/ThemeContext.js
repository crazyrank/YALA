import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from './colors';

const ThemeContext = createContext({
  colors: lightColors,
  scheme: 'light',
  isDark: false,
});

/**
 * Wraps the app and automatically follows the device's system theme
 * (Settings > Display > Dark theme on Android). No manual toggle needed —
 * if the phone is in dark mode, the app renders in dark mode.
 */
export function ThemeProvider({ children }) {
  const scheme = useColorScheme(); // 'light' | 'dark' | null

  const value = useMemo(() => {
    const isDark = scheme === 'dark';
    return {
      colors: isDark ? darkColors : lightColors,
      scheme: isDark ? 'dark' : 'light',
      isDark,
    };
  }, [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
