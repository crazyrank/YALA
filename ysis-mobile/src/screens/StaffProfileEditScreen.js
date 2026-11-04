import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { radius } from '../theme/spacing';
import { api } from '../api/client';

export default function StaffProfileEditScreen({ navigation, route }) {
  const { colors } = useTheme();
  const profile = route.params.profile;
  const [fullName, setFullName] = useState(profile.fullName || '');
  const [email, setEmail] = useState(profile.email || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/staff-profiles/${profile.id}`, { fullName, email, phone });
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e.message || 'Please try again.');
    }
  };

  const field = (label, value, onChange, keyboard) => (
    <>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard || 'default'}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'}
        autoCorrect={false}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      />
    </>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.note, { color: colors.textMuted }]}>
        Correct the name, email or phone number. Role, status and class assignments are changed elsewhere.
      </Text>

      {field('FULL NAME', fullName, setFullName)}
      {field('EMAIL', email, setEmail, 'email-address')}
      {field('PHONE', phone, setPhone, 'phone-pad')}

      <Pressable
        disabled={saving}
        onPress={save}
        style={[styles.saveBtn, { backgroundColor: colors.gold, opacity: saving ? 0.6 : 1 }]}
      >
        {saving ? (
          <ActivityIndicator color="#0E1A2B" />
        ) : (
          <Text style={styles.saveText}>Save changes</Text>
        )}
      </Pressable>

      <Pressable onPress={() => navigation.goBack()} style={styles.cancelBtn}>
        <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  note: { fontFamily: fontFamily.body, fontSize: 13, marginBottom: 12, lineHeight: 19 },
  label: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: fontFamily.body,
    fontSize: 15,
  },
  saveBtn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveText: { fontFamily: fontFamily.bodyBold, fontSize: 15, color: '#0E1A2B' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { fontFamily: fontFamily.bodySemibold, fontSize: 14 },
});
