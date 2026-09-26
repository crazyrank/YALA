import * as Application from 'expo-application';
import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getMeta, setMeta, DEVICE_META_KEYS } from '../db';

/**
 * Stable device fingerprint:
 * 1. Prefer OS-provided stable IDs where available (Android ID / iOS vendor ID)
 * 2. Fall back to a once-generated UUID persisted in local meta
 * Combined string is hashed-length capped for the backend column.
 */
export async function getDeviceFingerprint() {
  const existing = await getMeta(DEVICE_META_KEYS.DEVICE_FINGERPRINT);
  if (existing) return existing;

  let hardwarePart = '';
  try {
    if (Platform.OS === 'android') {
      hardwarePart = Application.getAndroidId?.() || '';
    } else if (Platform.OS === 'ios') {
      hardwarePart = (await Application.getIosIdForVendorAsync?.()) || '';
    }
  } catch {
    hardwarePart = '';
  }

  const randomPart = uuidv4();
  const fingerprint = [hardwarePart, randomPart].filter(Boolean).join(':').slice(0, 120);
  await setMeta(DEVICE_META_KEYS.DEVICE_FINGERPRINT, fingerprint);
  return fingerprint;
}

export function getDeviceDisplayName() {
  if (Platform.OS === 'android') {
    return Application.applicationName || 'Android device';
  }
  return 'iOS device';
}
