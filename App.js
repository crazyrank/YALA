import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { getDb } from './src/db';
import { startAutoSyncListener, triggerSync } from './src/services/syncEngine';

export default function App() {
  useEffect(() => {
    let unsubscribe;
    (async () => {
      await getDb(); // ensures SQLite schema exists before any screen queries it
      unsubscribe = startAutoSyncListener();
      triggerSync(); // catch up on anything queued from a previous session
    })();
    return () => unsubscribe && unsubscribe.remove();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
