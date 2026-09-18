import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function UnlockScreen() {
  const { user, unlock, requirePasswordLogin } = useAuth();
  const [message, setMessage] = useState(null);

  useEffect(() => {
    attemptUnlock();
  }, []);

  const attemptUnlock = async () => {
    setMessage(null);
    const result = await unlock();
    if (!result.unlocked) {
      if (result.reason === 'NO_BIOMETRIC_HARDWARE') {
        setMessage('No fingerprint or PIN set up on this device. Please sign in with your password.');
      } else {
        setMessage('Could not verify. Try again, or sign in with your password.');
      }
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}</Text>
      <Text style={styles.subtitle}>Unlock with your fingerprint to continue</Text>

      {message && <Text style={styles.message}>{message}</Text>}

      <Pressable style={styles.button} onPress={attemptUnlock}>
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>

      <Pressable style={styles.linkButton} onPress={requirePasswordLogin}>
        <Text style={styles.linkText}>Use password instead</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1f33', justifyContent: 'center', alignItems: 'center', padding: 28 },
  greeting: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  subtitle: { color: '#a9b8c8', fontSize: 13, marginBottom: 24, textAlign: 'center' },
  message: { color: '#e0a05a', fontSize: 12.5, marginBottom: 20, textAlign: 'center', paddingHorizontal: 20 },
  button: { backgroundColor: '#c9a24b', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, marginBottom: 14 },
  buttonText: { textAlign: 'center', color: '#0d1f33', fontWeight: '700', fontSize: 15 },
  linkButton: { padding: 8 },
  linkText: { color: '#6fd3c7', fontSize: 13 },
});
