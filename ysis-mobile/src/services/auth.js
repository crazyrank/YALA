import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { api, setAccessToken } from '../api/client';
import { getDeviceFingerprint, getDeviceDisplayName } from './deviceId';

const USER_CACHE_KEY = 'ysis_user_cache';
const HAS_LOGGED_IN_KEY = 'ysis_has_logged_in';

/**
 * First login MUST be online (Build Spec Section 4). This also registers
 * the device server-side. Subsequent unlocks use biometrics instead
 * (see unlockWithBiometrics below) — no daily password typing.
 */
export async function loginOnline(email, password) {
  const deviceFingerprint = await getDeviceFingerprint();
  const deviceName = getDeviceDisplayName();

  const result = await api.post('/auth/login', { email, password, deviceFingerprint, deviceName });

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
 * Daily unlock via fingerprint/PIN, no server round-trip needed for the
 * unlock itself — the existing access/refresh token pair (and the
 * device's already-trusted status) carries the session. If the refresh
 * token has genuinely expired, the next API call's silent-refresh
 * attempt will fail and the app falls back to loginOnline.
 */
export async function unlockWithBiometrics() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    // No fingerprint/PIN set up on this device — fall back to requiring
    // password login every time rather than silently skipping the check.
    return { unlocked: false, reason: 'NO_BIOMETRIC_HARDWARE' };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock YALAMATRIX SIS',
    fallbackLabel: 'Use PIN',
  });

  return { unlocked: result.success, reason: result.success ? null : 'AUTH_FAILED' };
}

export async function logout() {
  try {
    await api.post('/auth/logout', {});
  } catch {
    // Even if the network call fails, clear local session — the person
    // asked to log out, that intent should win locally regardless.
  }
  await setAccessToken(null);
  await SecureStore.deleteItemAsync(USER_CACHE_KEY);
}
