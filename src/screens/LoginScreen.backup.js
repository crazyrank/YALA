import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  StatusBar,
  ScrollView,
  Animated,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login, unlock } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bioLoading, setBioLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState('');

  const intro = useRef(new Animated.Value(0)).current;
  const card = useRef(new Animated.Value(0)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.spring(intro, {
        toValue: 1,
        useNativeDriver: true,
        tension: 55,
        friction: 8,
      }),
      Animated.spring(card, {
        toValue: 1,
        useNativeDriver: true,
        tension: 55,
        friction: 8,
      }),
    ]).start();
  }, []);

  const clearError = () => {
    if (error) {
      setError('');
      errorAnim.setValue(0);
    }
  };

  const showError = (message) => {
    setError(message);
    errorAnim.setValue(0);

    Animated.sequence([
      Animated.spring(errorAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 7,
      }),
    ]).start();
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
          ? 'An internet connection is required for your first password sign-in.'
          : err.message || 'We could not sign you in. Please check your details.'
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

  const fieldStyle = (name) => [
    styles.inputShell,
    focused === name && styles.inputShellFocused,
  ];

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FA" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          <Animated.View
            style={[
              styles.brand,
              {
                opacity: intro,
                transform: [{
                  translateY: intro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                }],
              },
            ]}
          >
            <View style={styles.logoBox}>
              <Image
                source={require('../../assets/yala-matrix-schools-logo.jpg')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <View>
              <Text style={styles.brandTitle}>YALAMATRIX</Text>
              <Text style={styles.brandSub}>SCHOOL INFORMATION SYSTEM</Text>
            </View>
          </Animated.View>

          <Animated.View
            style={[
              styles.intro,
              {
                opacity: intro,
                transform: [{
                  translateY: intro.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              },
            ]}
          >
            <View style={styles.badge}>
              <View style={styles.dot} />
              <Text style={styles.badgeText}>SECURE ACCESS</Text>
            </View>

            <Text style={styles.title}>Welcome back.</Text>

            <Text style={styles.subtitle}>
              Sign in to access your school management workspace.
            </Text>
          </Animated.View>          <Animated.View
            style={[
              styles.card,
              {
                opacity: card,
                transform: [{
                  translateY: card.interpolate({
                    inputRange: [0, 1],
                    outputRange: [28, 0],
                  }),
                }],
              },
            ]}
          >
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardHint}>
              Enter your account details below.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>

              <View style={fieldStyle('email')}>
                <TextInput
                  style={styles.input}
                  placeholder="name@yalamatrix.edu"
                  placeholderTextColor="#98A2B3"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    clearError();
                  }}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused('')}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>

              <View style={fieldStyle('password')}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#98A2B3"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    clearError();
                  }}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused('')}
                />

                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={10}
                  style={styles.showButton}
                >
                  <Text style={styles.showText}>
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {error ? (
              <Animated.View
                style={[
                  styles.errorBox,
                  {
                    opacity: errorAnim,
                    transform: [{
                      translateY: errorAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-8, 0],
                      }),
                    }],
                  },
                ]}
              >
                <View style={styles.errorIcon}>
                  <Text style={styles.errorIconText}>!</Text>
                </View>

                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            ) : null}

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginPressed,
                loading && styles.disabled,
              ]}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.loginText}>Signing in...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.loginText}>Sign in</Text>
                  <View style={styles.arrowCircle}>
                    <Text style={styles.arrow}>→</Text>
                  </View>
                </>
              )}
            </Pressable>            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>QUICK ACCESS</Text>
              <View style={styles.line} />
            </View>

            <Pressable
              onPress={handleBiometric}
              disabled={bioLoading}
              style={({ pressed }) => [
                styles.bioButton,
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

                  <View style={styles.bioText}>
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
          </Animated.View>

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

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  scroll: {
    flexGrow: 1,
  },

  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoBox: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6E8EC',
    overflow: 'hidden',
  },

  logo: {
    width: 48,
    height: 48,
  },

  brandTextArea: {
    marginLeft: 12,
  },

  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.8,
    color: '#0B1F33',
  },

  brandSub: {
    marginTop: 3,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#8A94A3',
  },

  intro: {
    marginTop: 42,
    marginBottom: 24,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#EEF7F5',
    marginBottom: 12,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#168C78',
    marginRight: 7,
  },

  badgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.3,
    color: '#168C78',
  },

  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: '#0B1F33',
  },

  subtitle: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: '#667085',
    maxWidth: 340,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E8EAEE',
    shadowColor: '#0B1F33',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    elevation: 4,
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0B1F33',
  },

  cardHint: {
    marginTop: 4,
    marginBottom: 22,
    fontSize: 11.5,
    color: '#8A94A3',
  },

  field: {
    marginBottom: 16,
  },

  label: {
    marginBottom: 7,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#475467',
  },

  inputShell: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9DDE3',
    backgroundColor: '#FAFBFC',
    flexDirection: 'row',
    alignItems: 'center',
  },

  inputShellFocused: {
    borderColor: '#C9A24B',
    backgroundColor: '#FFFDF8',
  },

  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 15,
    fontSize: 14,
    fontWeight: '600',
    color: '#0B1F33',
  },

  showButton: {
    paddingHorizontal: 13,
  },

  showText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#B18A35',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF6F5',
    borderWidth: 1,
    borderColor: '#F3C8C4',
    borderRadius: 13,
    padding: 11,
    marginBottom: 14,
  },

  errorIcon: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: '#FDE3E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  errorIconText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#B42318',
  },

  errorText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 17,
    color: '#B42318',
    fontWeight: '600',
  },

  loginButton: {
    height: 55,
    borderRadius: 15,
    backgroundColor: '#0B1F33',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loginPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },

  disabled: {
    opacity: 0.65,
  },

  loginText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },

  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#C9A24B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  arrow: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0B1F33',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E8EAEE',
  },

  dividerText: {
    marginHorizontal: 10,
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#98A2B3',
  },

  bioButton: {
    minHeight: 68,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D9DDE3',
    backgroundColor: '#FAFBFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  bioPressed: {
    backgroundColor: '#F1F3F5',
    transform: [{ scale: 0.99 }],
  },

  bioIcon: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: '#EEF1F4',
    borderWidth: 1,
    borderColor: '#D9DDE3',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bioInner: {
    width: 16,
    height: 22,
    borderWidth: 2,
    borderColor: '#0B1F33',
    borderRadius: 10,
  },

  bioText: {
    flex: 1,
    marginLeft: 12,
  },

  bioTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0B1F33',
  },

  bioSub: {
    marginTop: 3,
    fontSize: 10,
    color: '#98A2B3',
  },

  bioArrow: {
    fontSize: 19,
    color: '#667085',
  },

  bioLoading: {
    marginLeft: 9,
    fontSize: 12,
    fontWeight: '700',
    color: '#0B1F33',
  },

  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 28,
  },

  footerLine: {
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#C9A24B',
    marginBottom: 10,
  },

  footerTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#0B1F33',
  },

  footerText: {
    marginTop: 4,
    fontSize: 9,
    color: '#8A94A3',
  },

  footerSchool: {
    marginTop: 3,
    fontSize: 8,
    color: '#B0B7C3',
  },
});
