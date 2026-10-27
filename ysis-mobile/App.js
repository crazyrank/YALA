import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { getDb } from './src/db';
import { startAutoSyncListener, triggerSync } from './src/services/syncEngine';
import { useAppFonts } from './src/theme';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

// Hide the native logo splash on the first frame. The app's own loader
// (SplashLoader in IntroScreen) is the only splash the user sees.
SplashScreen.preventAutoHideAsync().catch(() => {});

const LOADING_BG = '#0E1A2B';

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

  // Called as soon as the first view lays out, whether or not the app is ready.
  const hideNativeSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!appReady) {
    return <View style={{ flex: 1, backgroundColor: LOADING_BG }} onLayout={hideNativeSplash} />;
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
        onLayout={hideNativeSplash}
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} onLayout={hideNativeSplash}>
      <AuthProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaView>
  );
}
