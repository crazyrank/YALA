import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { api, setAccessToken, setRefreshToken } from '../api/client';
import { getDeviceFingerprint, getDeviceDisplayName } from './deviceId';
import { clearStoredProfilePhoto } from './profilePhoto';
import { wipeLocalData } from '../db';

const USER_CACHE_KEY = 'ysis_user_cache';
const HAS_LOGGED_IN_KEY = 'ysis_has_logged_in';

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
  if (result.refreshToken) {
    await setRefreshToken(result.refreshToken);
  }
  await SecureStore.setItemAsync(USER_CACHE_KEY, JSON.stringify(result.user));
  await SecureStore.setItemAsync(HAS_LOGGED_IN_KEY, 'true');

  return result.user;
}

export async function changePassword(oldPassword, newPassword) {
  const result = await api.post('/auth/change-password', {
    oldPassword,
    newPassword,
  });
  // Server invalidates all sessions; clear local tokens so UI forces re-login
  await setAccessToken(null);
  await setRefreshToken(null);
  return result;
}

export async function hasCompletedFirstLogin() {
  const flag = await SecureStore.getItemAsync(HAS_LOGGED_IN_KEY);
  return flag === 'true';
}

export async function getCachedUser() {
  const raw = await SecureStore.getItemAsync(USER_CACHE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function unlockWithBiometrics() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    return { unlocked: false, reason: 'NO_BIOMETRIC_HARDWARE' };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock YALAMATRIX SIS',
    fallbackLabel: 'Use device passcode',
    disableDeviceFallback: false,
  });

  return { unlocked: result.success, reason: result.success ? null : 'AUTH_FAILED' };
}

export async function logout(userId) {
  try {
    await api.post('/auth/logout', {});
  } catch {
    // best-effort; still clear local state
  }
  await setAccessToken(null);
  await setRefreshToken(null);
  await SecureStore.deleteItemAsync(USER_CACHE_KEY);
  await SecureStore.deleteItemAsync(HAS_LOGGED_IN_KEY);
  if (userId) await clearStoredProfilePhoto(userId);
  await wipeLocalData();
}
