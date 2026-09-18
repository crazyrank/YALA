import * as Application from 'expo-application';
import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getMeta, setMeta, DEVICE_META_KEYS } from '../db';

/**
 * Generates a stable device fingerprint once, persists it locally, and
 * reuses it forever after. We don't rely purely on OS-provided device
 * IDs (inconsistent across Android versions / iOS privacy restrictions),
 * so we generate our own UUID on first run and treat that as the
 * fingerprint, matching what the backend's `devices.device_fingerprint`
 * expects.
 */
export async function getDeviceFingerprint() {
  const existing = await getMeta(DEVICE_META_KEYS.DEVICE_FINGERPRINT);
  if (existing) return existing;

  const fingerprint = uuidv4();
  await setMeta(DEVICE_META_KEYS.DEVICE_FINGERPRINT, fingerprint);
  return fingerprint;
}

export function getDeviceDisplayName() {
  if (Platform.OS === 'android') {
    return Application.applicationName || 'Android device';
  }
  return 'iOS device';
}
