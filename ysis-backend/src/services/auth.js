import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { api, setAccessToken } from '../api/client';
import { getDeviceFingerprint, getDeviceDisplayName } from './deviceId';

const USER_CACHE_KEY = 'ysis_user_cache';
const HAS_LOGGED_IN_KEY = 'ysis_has_logged_in';

/**
 * First login MUST be online. This also registers the device server-side.
 */
export async function loginOnline(email, password) {
  const deviceFingerprint = await getDeviceFingerprint();
  const deviceName = getDeviceDisplayName();

  const result = await api.post('/auth/login', {
    email,
    password,
    deviceFingerprint,
    deviceName,
  });

  await setAccessToken(result.accessToken);
  await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(result.user));
  await SecureStore.setItemAsync(HAS_LOGGED_IN_KEY, 'true');

  return result.user;
}

export async function hasCompletedFirstLogin() {
  const flag = await SecureStore.getItemAsync(HAS_LOGGED_IN_KEY);
  return flag === 'true';
}

export async function getCachedUser() {
  const raw = await SecureStore.getItemAsync(USER_CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}

/**
 * Daily unlock via biometrics. Does NOT talk to the server.
 */
export async function unlockWithBiometrics() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    return { unlocked: false, reason: 'NO_BIOMETRIC_HARDWARE' };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock YALAMATRIX SIS',
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: false,
  });

  return {
    unlocked: result.success,
    reason: result.success ? null : 'AUTH_FAILED',
  };
}

/**
 * Full logout — clears every local auth flag.
 */
export async function logout() {
  try {
    await api.post('/auth/logout', {});
  } catch {
    // Network failure must not block local logout
  }

  await setAccessToken(null);
  await SecureStore.deleteItemAsync(USER_CACHE_KEY);
  await SecureStore.deleteItemAsync(HAS_LOGGED_IN_KEY);
}
