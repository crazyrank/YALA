import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
  ScrollView,
  Animated,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import styles from './LoginStyles';

export default function LoginScreen() {
  const { login, unlock } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState('');

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(25)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slide, {
        toValue: 0,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const clearError = () => {
    setError('');
    errorAnim.setValue(0);
  };

  const showError = (message) => {
    setError(message);
    errorAnim.setValue(0);

    Animated.spring(errorAnim, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = async () => {
    clearError();

    if (!email.trim() || !password) {
      showError('Enter your email and password to continue.');
      return;
    }

    setLoading(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      showError(
        err.isNetworkError
          ? 'An internet connection is required for your first sign-in.'
          : err.message || 'We could not sign you in. Check your details.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    clearError();
    setBioLoading(true);

    try {
      const result = await unlock();

      if (!result.unlocked) {
        showError(
          result.reason === 'NO_BIOMETRIC_HARDWARE'
            ? 'No fingerprint or device PIN is available.'
            : 'Verification was unsuccessful. Please try again.'
        );
      }
    } catch {
      showError('Fingerprint verification could not be completed.');
    } finally {
      setBioLoading(false);
    }
  };

  const emailBox = [
    styles.inputBox,
    focused === 'email' && styles.inputFocus,
  ];

  const passwordBox = [
    styles.inputBox,
    focused === 'password' && styles.inputFocus,
  ];

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fade,
              transform: [{ translateY: slide }],
            },
          ]}
        >
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../../assets/yala-matrix-schools-logo.jpg')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View>
              <Text style={styles.brandName}>YALAMATRIX</Text>
              <Text style={styles.brandSub}>
                SCHOOL INFORMATION SYSTEM
              </Text>
            </View>
          </View>

          <View style={styles.intro}>
            <View style={styles.badge}>
              <View style={styles.dot} />
              <Text style={styles.badgeText}>SECURE ACCESS</Text>
            </View>

            <Text style={styles.title}>Welcome back.</Text>

            <Text style={styles.subtitle}>
              Sign in to access your school management workspace.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardSub}>
              Enter your account details below.
            </Text>

            <Text style={styles.label}>EMAIL ADDRESS</Text>

            <View style={emailBox}>
              <TextInput
                style={styles.input}
                placeholder="name@yalamatrix.edu"
                placeholderTextColor="#A0A8B3"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  clearError();
                }}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused('')}
              />
            </View>

            <Text style={styles.label}>PASSWORD</Text>

            <View style={passwordBox}>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#A0A8B3"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  clearError();
                }}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused('')}
              />

              <Pressable
                onPress={() => setShowPassword((value) => !value)}
                hitSlop={10}
              >
                <Text style={styles.show}>
                  {showPassword ? 'HIDE' : 'SHOW'}
                </Text>
              </Pressable>
            </View>

            {error ? (
              <Animated.View
                style={[
                  styles.error,
                  {
                    opacity: errorAnim,
                    transform: [
                      {
                        translateY: errorAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.errorIcon}>
                  <Text style={styles.errorMark}>!</Text>
                </View>

                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.login,
                pressed && styles.pressed,
                loading && styles.disabled,
              ]}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.loginText}>Signing in...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.loginText}>Sign in</Text>
                  <Text style={styles.arrow}>→</Text>
                </>
              )}
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>QUICK ACCESS</Text>
              <View style={styles.line} />
            </View>

            <Pressable
              onPress={handleBiometric}
              disabled={bioLoading}
              style={({ pressed }) => [
                styles.bio,
                pressed && styles.bioPressed,
              ]}
            >
              {bioLoading ? (
                <>
                  <ActivityIndicator color="#0B1F33" size="small" />
                  <Text style={styles.bioLoading}>Verifying...</Text>
                </>
              ) : (
                <>
                  <View style={styles.bioIcon}>
                    <View style={styles.bioInner} />
                  </View>

                  <View style={styles.bioInfo}>
                    <Text style={styles.bioTitle}>
                      Device authentication
                    </Text>

                    <Text style={styles.bioSub}>
                      Fingerprint or device PIN
                    </Text>
                  </View>

                  <Text style={styles.bioArrow}>→</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLine} />

            <Text style={styles.footerTitle}>YALA</Text>

            <Text style={styles.footerText}>
              Offline-first school information system
            </Text>

            <Text style={styles.footerSchool}>
              Yalamatrix Schools • Okitipupa
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
