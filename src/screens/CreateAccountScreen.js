import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

/**
 * Director creates a Principal, or Principal creates a Head Teacher — the
 * target role is inferred server-side from the caller's own role (never
 * sent from here), matching the backend's privilege-escalation guard.
 * This screen is only reachable for director/principal (see RootNavigator).
 *
 * This is an ONLINE-ONLY action (unlike student registration) — account
 * creation always hits the server directly, no local-first queue, since
 * the temp credential must come from the server and be shown exactly once.
 */
export default function CreateAccountScreen({ navigation }) {
  const { user } = useAuth();
  const creatingRole = user?.role === 'director' ? 'Principal' : 'Head Teacher';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // { user, tempCredential } — shown once

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim()) {
      Alert.alert('Missing details', 'Full name and email are required.');
      return;
    }

    setSaving(true);
    try {
      const result = await api.post('/users', {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
      });
      setCreated(result);
    } catch (err) {
      if (err.code === 'EMAIL_IN_USE') {
        Alert.alert('Email already in use', 'An account with this email already exists.');
      } else if (err.isNetworkError) {
        Alert.alert('Offline', 'Creating an account requires an internet connection. Please try again once you\'re online.');
      } else {
        Alert.alert('Could not create account', err.message || 'Something went wrong.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCredential = async () => {
    await Clipboard.setStringAsync(created.tempCredential);
    Alert.alert('Copied', 'Temporary password copied to clipboard.');
  };

  const handleDone = () => {
    setCreated(null);
    setFullName('');
    setEmail('');
    setPhone('');
    navigation.goBack();
  };

  // Success state: show the one-time temp credential, same discipline as
  // the existing password-reset flow — this never appears again.
  if (created) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Account Created</Text>
        <Text style={styles.hint}>
          Share these details with {created.user.fullName} so they can sign in. This temporary
          password is shown only once — write it down or copy it now.
        </Text>

        <View style={styles.credentialCard}>
          <Text style={styles.credentialLabel}>Email</Text>
          <Text style={styles.credentialValue}>{created.user.email}</Text>
          <Text style={[styles.credentialLabel, { marginTop: 14 }]}>Temporary Password</Text>
          <Text style={styles.credentialValueLarge}>{created.tempCredential}</Text>
        </View>

        <Pressable style={styles.secondaryButton} onPress={handleCopyCredential}>
          <Text style={styles.secondaryButtonText}>Copy Password</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleDone}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create {creatingRole} Account</Text>
      <Text style={styles.hint}>
        A temporary password will be generated and shown once. The new {creatingRole.toLowerCase()}{' '}
        will be required to set their own password on first login.
      </Text>

      <Field label="Full Name *" value={fullName} onChangeText={setFullName} placeholder="Full name" />
      <Field
        label="Email *"
        value={email}
        onChangeText={setEmail}
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Optional" keyboardType="phone-pad" />

      <Pressable style={styles.button} onPress={handleCreate} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Creating...' : `Create ${creatingRole}`}</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', color: '#16324f', marginBottom: 6 },
  hint: { fontSize: 12, color: '#7a8a99', lineHeight: 17, marginBottom: 20 },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#16324f', marginBottom: 6 },
  input: { backgroundColor: '#f4f2ec', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  button: { backgroundColor: '#c9a24b', paddingVertical: 14, borderRadius: 8, marginTop: 10 },
  buttonText: { textAlign: 'center', color: '#0d1f33', fontWeight: '700', fontSize: 15 },
  secondaryButton: { backgroundColor: '#f4f2ec', paddingVertical: 14, borderRadius: 8, marginTop: 14 },
  secondaryButtonText: { textAlign: 'center', color: '#16324f', fontWeight: '700', fontSize: 15 },
  credentialCard: { backgroundColor: '#16324f', borderRadius: 12, padding: 18, marginTop: 6 },
  credentialLabel: { color: '#9fb3c8', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  credentialValue: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 4 },
  credentialValueLarge: { color: '#c9a24b', fontSize: 26, fontWeight: '800', letterSpacing: 2, marginTop: 4 },
});
