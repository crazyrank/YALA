import React, { useState } from 'react';
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
} from 'react-native';
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

    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    setLoading(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      if (err.isNetworkError) {
        setError(
          'An internet connection is required for your first password sign-in.'
        );
      } else {
        setError(
          err.message ||
            'We could not sign you in. Please check your details.'
        );
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
          setError(
            'No fingerprint or device PIN is available. Sign in with your password.'
          );
        } else {
          setError(
            'Verification was unsuccessful. Please try again or use your password.'
          );
        }
      }
    } catch (err) {
      setError(
        'Fingerprint verification could not be completed. Please use your password.'
      );
    } finally {
      setFingerprintBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F6F7F9"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>

          {/* TOP BRAND */}
          <View style={styles.brandArea}>
            <Image
              source={require('../../assets/yala-matrix-schools-logo.jpg')}
              style={styles.schoolLogo}
              resizeMode="contain"
            />

            <View style={styles.brandTextArea}>
              <Text style={styles.brandTitle}>
                YALAMATRIX
              </Text>

              <Text style={styles.brandSubtitle}>
                SCHOOL INFORMATION SYSTEM
              </Text>
            </View>
          </View>

          {/* WELCOME */}
          <View style={styles.introduction}>
            <Text style={styles.eyebrow}>
              SECURE ACCESS
            </Text>

            <Text style={styles.title}>
              Welcome back.
            </Text>

            <Text style={styles.subtitle}>
              Sign in to access your school management workspace.
            </Text>
          </View>

          {/* LOGIN CARD */}
          <View style={styles.card}>

            <View style={styles.field}>
              <Text style={styles.label}>
                EMAIL ADDRESS
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#98A2B3"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                PASSWORD
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#98A2B3"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error && (
              <View style={styles.errorBox}>
                <View style={styles.errorMark}>
                  <Text style={styles.errorMarkText}>
                    !
                  </Text>
                </View>

                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && styles.loginButtonPressed,
                loading && styles.disabledButton,
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>
                    Sign in
                  </Text>

                  <Text style={styles.loginArrow}>
                    →
                  </Text>
                </>
              )}
            </Pressable>

            {/* DIVIDER */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>
                QUICK ACCESS
              </Text>
              <View style={styles.dividerLine} />
            </View>

            {/* BIOMETRIC */}
            <Pressable
              style={({ pressed }) => [
                styles.fingerprintButton,
                pressed && styles.fingerprintPressed,
              ]}
              onPress={handleFingerprintLogin}
              disabled={fingerprintBusy}
            >
              {fingerprintBusy ? (
                <ActivityIndicator color="#101828" />
              ) : (
                <>
                  <View style={styles.fingerprintIcon}>
                    <View style={styles.fingerprintInner} />
                  </View>

                  <View style={styles.fingerprintTextArea}>
                    <Text style={styles.fingerprintTitle}>
                      Use device authentication
                    </Text>

                    <Text style={styles.fingerprintSubtitle}>
                      Fingerprint or device PIN
                    </Text>
                  </View>

                  <Text style={styles.fingerprintArrow}>
                    →
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerTitle}>
              YALA
            </Text>

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
    backgroundColor: '#F6F7F9',
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
  },

  brandArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  schoolLogo: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  brandTextArea: {
    marginLeft: 12,
  },

  brandTitle: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#101828',
  },

  brandSubtitle: {
    marginTop: 3,
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#98A2B3',
  },

  introduction: {
    marginTop: 42,
    marginBottom: 24,
  },

  eyebrow: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.7,
    color: '#667085',
    marginBottom: 10,
  },

  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1,
    color: '#101828',
  },

  subtitle: {
    marginTop: 10,
    maxWidth: 350,
    fontSize: 14,
    lineHeight: 21,
    color: '#667085',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAECF0',
    shadowColor: '#101828',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },

  field: {
    marginBottom: 17,
  },

  label: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#475467',
    marginBottom: 7,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 13,
    paddingHorizontal: 15,
    fontSize: 14,
    color: '#101828',
    backgroundColor: '#FCFCFD',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 11,
    marginBottom: 14,
  },

  errorMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 9,
  },

  errorMarkText: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '900',
  },

  errorText: {
    flex: 1,
    color: '#B42318',
    fontSize: 11.5,
    lineHeight: 17,
  },

  loginButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#101828',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loginButtonPressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

  disabledButton: {
    opacity: 0.65,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  loginArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    marginLeft: 12,
    fontWeight: '300',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EAECF0',
  },

  dividerText: {
    marginHorizontal: 10,
    color: '#98A2B3',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 1,
  },

  fingerprintButton: {
    minHeight: 68,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FCFCFD',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  fingerprintPressed: {
    backgroundColor: '#F2F4F7',
  },

  fingerprintIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2F4F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },

  fingerprintInner: {
    width: 16,
    height: 21,
    borderWidth: 2,
    borderColor: '#101828',
    borderRadius: 10,
  },

  fingerprintTextArea: {
    flex: 1,
    marginLeft: 12,
  },

  fingerprintTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#101828',
  },

  fingerprintSubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: '#98A2B3',
  },

  fingerprintArrow: {
    fontSize: 19,
    color: '#667085',
  },

  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 24,
  },

  footerTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#101828',
  },

  footerText: {
    marginTop: 4,
    fontSize: 9,
    color: '#98A2B3',
  },

  footerSchool: {
    marginTop: 3,
    fontSize: 8,
    color: '#B0B7C3',
  },
});
