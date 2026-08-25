import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { getDb } from './src/db';
import { startAutoSyncListener, triggerSync } from './src/services/syncEngine';
import { useAppFonts } from './src/theme';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
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

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  if (fontError) {
    console.warn('Font load failed:', fontError);
  }

  if (dbError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
        onLayout={onLayoutRootView}
      >
        <Text style={{ color: colors.error, fontWeight: '700', marginBottom: 8 }}>
          Startup error
        </Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
          {String(dbError.message || dbError)}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayoutRootView}>
      <AuthProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <RootNavigator />
      </AuthProvider>
    </View>
  );
}
