import React, { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import CountingSplash from './src/components/CountingSplash';
import { getDb } from './src/db';
import { startAutoSyncListener, triggerSync } from './src/services/syncEngine';
import { useAppFonts } from './src/theme';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

// Keep the native splash (school logo) up until the loader is on screen.
SplashScreen.preventAutoHideAsync().catch(() => {});

if (global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('[GLOBAL ERROR]', isFatal ? 'FATAL' : 'non-fatal', error?.message, error?.stack);
    defaultHandler(error, isFatal);
  });
}

export default function App() {
  return (
    <KeyboardProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppInner />
        </ThemeProvider>
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}

function AppInner() {
  const { colors, scheme } = useTheme();
  const { fontsLoaded, fontError } = useAppFonts();
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(null);
  const [loaderDone, setLoaderDone] = useState(false);

  useEffect(() => {
    let unsubscribe;
    (async () => {
      try {
        await getDb(); // ensures SQLite schema exists before any screen queries it
        unsubscribe = startAutoSyncListener();
        triggerSync(); // catch up on anything queued from a previous session
      } catch (err) {
        console.warn('DB init failed:', err);
        setDbError(err);
      } finally {
        setDbReady(true);
      }
    })();
    return () => unsubscribe && unsubscribe.remove();
  }, []);

  const appReady = (fontsLoaded || fontError) && dbReady;

  // Hides the native splash once the loader has drawn, so the logo does not flicker.
  const hideNativeSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const handleLoaderDone = useCallback(() => setLoaderDone(true), []);

  // The loader stays until the count reaches 100 AND the app is ready.
  if (!appReady || !loaderDone) {
    return (
      <CountingSplash
        ready={appReady}
        onDone={handleLoaderDone}
        onLayout={hideNativeSplash}
      />
    );
  }

  if (fontError) {
    console.warn('Font load failed:', fontError);
  }

  if (dbError) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text style={{ color: colors.error, fontWeight: '700', marginBottom: 8 }}>
          Startup error
        </Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
          {String(dbError.message || dbError)}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <AuthProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaView>
  );
}
