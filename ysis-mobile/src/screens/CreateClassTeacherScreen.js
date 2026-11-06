import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api } from '../api/client';
import { CLASS_ORDER } from '../utils/classProgression';
import { armRuleFor, armChoicesFor, divisionOfClass } from '../utils/studentRules';

// The Principal or Director creates a Class Teacher and gives them one class.
// The server checks the role and the class again. The temporary password is shown once.
const ARMS = ['Science', 'Arts', 'Commercial'];

export default function CreateClassTeacherScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [division, setDivision] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [arm, setArm] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const classChoices = CLASS_ORDER.filter((c) => divisionOfClass(c) === division);

  const submit = async () => {
    if (!fullName.trim() || !email.trim()) {
      Alert.alert('Missing details', 'Enter the full name and email.');
      return;
    }
    if (!division) {
      Alert.alert('Choose a division', 'Pick Primary or Secondary.');
      return;
    }
    if (!classLevel) {
      Alert.alert('Choose a class', 'Pick the one class this class teacher is responsible for.');
      return;
    }
    if (armRuleFor(classLevel).required && !arm) {
      Alert.alert('Choose an arm', 'This class needs an arm.');
      return;
    }
    setSaving(true);
    try {
      const result = await api.post('/users', {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        role: 'class_teacher',
        division,
        classLevel,
        arm: arm || undefined,
      });
      setCreated(result);
    } catch (err) {
      if (err.code === 'EMAIL_IN_USE') {
        Alert.alert('Email already in use', 'An account with this email already exists.');
      } else if (err.isNetworkError) {
        Alert.alert('Offline', 'Creating an account needs an internet connection. Try again once you are online.');
      } else {
        Alert.alert('Could not create the account', err.message || 'Something went wrong.');
      }
    } finally {
      setSaving(false);
    }
  };

  const copyCredential = async () => {
    await Clipboard.setStringAsync(created.tempCredential);
    Alert.alert('Copied', 'Temporary password copied to the clipboard.');
  };

  const done = () => {
    setCreated(null);
    navigation.goBack();
  };

  if (created) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{created.user.fullName} is set up</Text>
        <Text style={styles.body}>
          Give this temporary password to the class teacher. It is shown only once. They must change it at first login.
        </Text>
        <View style={styles.credentialBox}>
          <Text style={styles.credential} selectable>{created.tempCredential}</Text>
        </View>
        <Pressable style={styles.button} onPress={copyCredential}>
          <Text style={styles.buttonText}>Copy password</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={done}>
          <Text style={styles.secondaryText}>Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Full name</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} editable={!saving} />

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!saving}
      />

      <Text style={styles.label}>Phone (optional)</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!saving} />

      <Text style={styles.label}>Division</Text>
      <View style={styles.chips}>
        {[{ key: 'primary', label: 'Primary' }, { key: 'secondary', label: 'Secondary' }].map((d) => (
          <Pressable
            key={d.key}
            style={[styles.chip, division === d.key && styles.chipOn]}
            onPress={() => { setDivision(d.key); setClassLevel(''); setArm(''); }}
          >
            <Text style={[styles.chipText, division === d.key && styles.chipTextOn]}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      {division !== '' && (
        <>
          <Text style={styles.label}>Class</Text>
          <View style={styles.chips}>
            {classChoices.map((c) => (
              <Pressable
                key={c}
                style={[styles.chip, classLevel === c && styles.chipOn]}
                onPress={() => { setClassLevel(c); setArm(''); }}
              >
                <Text style={[styles.chipText, classLevel === c && styles.chipTextOn]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {classLevel !== '' && (
        <>
          <Text style={styles.label}>Arm</Text>
          <View style={styles.chips}>
            {armChoicesFor(classLevel).map((a) => (
              <Pressable key={a} style={[styles.chip, arm === a && styles.chipOn]} onPress={() => setArm(a)}>
                <Text style={[styles.chipText, arm === a && styles.chipTextOn]}>{a}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      <Pressable style={[styles.button, saving && styles.disabled]} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Create account</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: 18, paddingBottom: 40 },
  title: { fontSize: 18, fontWeight: '700', color: '#101828' },
  body: { fontSize: 14, color: '#5B6472', marginTop: 8, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#344054', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#FFFFFF' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderColor: '#D0D5DD', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FFFFFF' },
  chipOn: { borderColor: '#1D3557', backgroundColor: '#1D3557' },
  chipText: { fontSize: 13, color: '#344054' },
  chipTextOn: { color: '#FFFFFF', fontWeight: '700' },
  button: { backgroundColor: '#1D3557', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.6 },
  secondary: { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  secondaryText: { color: '#344054', fontWeight: '600', fontSize: 15 },
  credentialBox: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#D0D5DD', padding: 16, marginTop: 16 },
  credential: { fontSize: 20, fontWeight: '700', color: '#101828', textAlign: 'center', letterSpacing: 1 },
});
