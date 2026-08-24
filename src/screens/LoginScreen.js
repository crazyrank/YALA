import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login, unlock } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fingerprintBusy, setFingerprintBusy] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err.isNetworkError) {
        setError('No internet connection. First login needs to happen online.');
      } else {
        setError(err.message || 'Could not sign in. Please check your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFingerprintLogin = async () => {
    setError(null);
    setFingerprintBusy(true);
    try {
      const result = await unlock();
      if (!result.unlocked) {
        if (result.reason === 'NO_BIOMETRIC_HARDWARE') {
          setError('No fingerprint or PIN set up on this device. Please sign in with your password.');
        } else {
          setError('Could not verify fingerprint. Please try again or sign in with your password.');
        }
      }
    } finally {
      setFingerprintBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>YALAMATRIX SIS</Text>
      <Text style={styles.subtitle}>Sign in to continue. This device will be remembered for daily fingerprint unlock.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#0d1f33" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable style={styles.fingerprintButton} onPress={handleFingerprintLogin} disabled={fingerprintBusy}>
        {fingerprintBusy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.fingerprintButtonText}>Sign in with fingerprint</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1f33', justifyContent: 'center', padding: 28 },
  title: { color: '#fff', fontSize: 26, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  subtitle: { color: '#a9b8c8', fontSize: 12.5, textAlign: 'center', marginBottom: 28, lineHeight: 18 },
  input: {
    backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, fontSize: 14,
  },
  error: { color: '#e0a05a', fontSize: 12.5, marginBottom: 10, textAlign: 'center' },
  button: { backgroundColor: '#c9a24b', paddingVertical: 14, borderRadius: 8, marginTop: 8 },
  buttonText: { textAlign: 'center', color: '#0d1f33', fontWeight: '700', fontSize: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2a3f57' },
  dividerText: { color: '#7a8ea3', fontSize: 12, marginHorizontal: 10 },
  fingerprintButton: {
    borderWidth: 1, borderColor: '#6fd3c7', paddingVertical: 14, borderRadius: 8,
  },
  fingerprintButtonText: { textAlign: 'center', color: '#6fd3c7', fontWeight: '600', fontSize: 14 },
});
