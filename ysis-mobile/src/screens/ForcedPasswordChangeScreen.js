import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StatusBar } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Feather } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { changePassword } from '../services/auth';
import { validatePasswordStrength } from '../utils/passwordPolicy';
import { useTheme } from '../theme/ThemeContext';
import { createLoginStyles } from './LoginStyles';

export default function ForcedPasswordChangeScreen() {
  const { completePasswordChange } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createLoginStyles(colors), [colors]);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');

  const submit = async () => {
    setError('');

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Fill in all three fields.');
      return;
    }
    const strength = validatePasswordStrength(newPassword);
    if (!strength.ok) {
      setError(strength.message);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    if (newPassword === oldPassword) {
      setError('Choose a password that is different from the current one.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(oldPassword, newPassword);
      await completePasswordChange();
    } catch (err) {
      setError(
        err.isNetworkError
          ? 'An internet connection is required to change your password.'
          : err.message || 'Your password could not be changed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fieldBox = (name) => [styles.inputBox, focused === name && styles.inputFocus];

  const renderField = (name, label, icon, value, setValue, placeholder) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={fieldBox(name)}>
        <Feather
          name={icon}
          size={18}
          color={focused === name ? colors.goldDark : colors.textMuted}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          onChangeText={(text) => {
            setValue(text);
            setError('');
          }}
          onFocus={() => setFocused(name)}
          onBlur={() => setFocused('')}
        />
      </View>
    </>
  );

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bottomOffset={24}
      >
        <View style={styles.container}>
          <View style={styles.intro}>
            <View style={styles.badge}>
              <View style={styles.dot} />
              <Text style={styles.badgeText}>PASSWORD REQUIRED</Text>
            </View>
            <Text style={styles.title}>Set a new password.</Text>
            <Text style={styles.subtitle}>
              Your account needs a new password before you can continue. Use at least 10
              characters, with an uppercase letter, a lowercase letter and a number.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Change password</Text>
            <Text style={styles.cardSub}>You will sign in again with the new password.</Text>

            {renderField('old', 'CURRENT PASSWORD', 'lock', oldPassword, setOldPassword, 'Current or temporary password')}
            {renderField('new', 'NEW PASSWORD', 'key', newPassword, setNewPassword, 'New password')}
            {renderField('confirm', 'CONFIRM NEW PASSWORD', 'check', confirmPassword, setConfirmPassword, 'Type the new password again')}

            {!!error && (
              <View style={styles.error}>
                <Feather name="alert-circle" size={16} color={colors.error} style={styles.errorIcon} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              onPress={submit}
              disabled={loading}
              style={({ pressed }) => [styles.login, pressed && styles.pressed, loading && styles.disabled]}
            >
              {loading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.loginText}>Save new password</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
