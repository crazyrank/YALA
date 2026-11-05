import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

/**
 * Create a staff account.
 *
 * Route params (optional):
 *   targetRole: 'principal' | 'head_teacher'  (default inferred from caller)
 *   division:   'primary' | 'secondary'       (required when creating HT)
 *
 * Director may create Principal (no division) or Head Teacher (with division).
 * Principal may only create Head Teacher (with division).
 *
 * Role is still enforced server-side — the client never escalates privilege.
 * Online-only: temp credential comes from the server and is shown once.
 */
export default function CreateAccountScreen({ navigation, route }) {
  const { user } = useAuth();
  const paramRole = route?.params?.targetRole;
  const paramDivision = route?.params?.division;

  // Resolve what we are creating.
  const isHeadTeacher =
    paramRole === 'head_teacher' ||
    user?.role === 'principal' ||
    (user?.role === 'director' && !!paramDivision);

  const creatingRole = isHeadTeacher
    ? paramDivision === 'primary'
      ? 'Primary school HT'
      : paramDivision === 'secondary'
        ? 'Secondary school HT'
        : 'Head Teacher'
    : 'Principal';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // Pre-select division from route when director taps Primary/Secondary HT.
  const [division, setDivision] = useState(
    paramDivision === 'primary' || paramDivision === 'secondary' ? paramDivision : ''
  );
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null); // { user, tempCredential }

  const needsDivisionPicker = isHeadTeacher && !paramDivision;

  const handleCreate = async () => {
    if (!fullName.trim() || !email.trim()) {
      Alert.alert('Missing details', 'Full name and email are required.');
      return;
    }

    if (isHeadTeacher && !['primary', 'secondary'].includes(division)) {
      Alert.alert('Choose a division', 'Pick Primary school HT or Secondary school HT.');
      return;
    }

    setSaving(true);
    try {
      // Always send explicit role. Server enforces what the caller may create.
      const result = await api.post('/users', {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        role: isHeadTeacher ? 'head_teacher' : 'principal',
        division: isHeadTeacher ? division : undefined,
      });
      setCreated(result);
    } catch (err) {
      if (err.code === 'EMAIL_IN_USE') {
        Alert.alert('Email already in use', 'An account with this email already exists.');
      } else if (err.isNetworkError) {
        Alert.alert(
          'Offline',
          "Creating an account requires an internet connection. Please try again once you're online."
        );
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
      <Text style={styles.title}>Create {creatingRole}</Text>
      <Text style={styles.hint}>
        A temporary password will be generated and shown once. The new account holder will be
        required to set their own password on first login.
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
      <Field
        label="Phone"
        value={phone}
        onChangeText={setPhone}
        placeholder="Optional"
        keyboardType="phone-pad"
      />

      {needsDivisionPicker && (
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.label}>Division *</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { key: 'primary', label: 'Primary school HT' },
              { key: 'secondary', label: 'Secondary school HT' },
            ].map((d) => (
              <Pressable
                key={d.key}
                onPress={() => setDivision(d.key)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#D9DEE5',
                  backgroundColor: division === d.key ? '#1D3557' : '#FFFFFF',
                }}
              >
                <Text
                  style={{
                    fontWeight: '600',
                    fontSize: 13,
                    textAlign: 'center',
                    color: division === d.key ? '#FFFFFF' : '#1F2933',
                  }}
                >
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* When division was passed via route, show it as read-only context */}
      {isHeadTeacher && paramDivision && (
        <View style={styles.divisionChip}>
          <Text style={styles.divisionChipText}>
            {paramDivision === 'primary' ? 'Primary school HT' : 'Secondary school HT'}
          </Text>
        </View>
      )}

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
  title: { fontSize: 20, fontWeight: '700', color: '#17263B', marginBottom: 6 },
  hint: { fontSize: 12, color: '#7a8a99', lineHeight: 17, marginBottom: 20 },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: '#17263B', marginBottom: 6 },
  input: {
    backgroundColor: '#f4f2ec',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  button: { backgroundColor: '#2FA37A', paddingVertical: 14, borderRadius: 8, marginTop: 10 },
  buttonText: { textAlign: 'center', color: '#0d1f33', fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    backgroundColor: '#f4f2ec',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 14,
  },
  secondaryButtonText: { textAlign: 'center', color: '#17263B', fontWeight: '700', fontSize: 15 },
  credentialCard: { backgroundColor: '#17263B', borderRadius: 12, padding: 18, marginTop: 6 },
  credentialLabel: {
    color: '#9fb3c8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  credentialValue: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 4 },
  credentialValueLarge: {
    color: '#2FA37A',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 4,
  },
  divisionChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8EEF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  divisionChipText: { fontSize: 13, fontWeight: '600', color: '#1D3557' },
});
