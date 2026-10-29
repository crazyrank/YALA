import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export function portalLoginKey(userId) {
  return `portal-login-${userId}`;
}

/**
 * Asks the person to prove they are at the phone (fingerprint, face or device PIN)
 * before a saved login is sent. Returns false when the phone has no screen lock,
 * so a saved login is never sent on an unprotected phone.
 */
export async function confirmIdentity(promptMessage) {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use device PIN',
      disableDeviceFallback: false,
    });
    return !!result.success;
  } catch {
    return false;
  }
}

/** Removes the saved results-portal login for this staff account on this phone. */
export async function clearPortalLogins(userId) {
  if (!userId) return;
  await SecureStore.deleteItemAsync(portalLoginKey(userId)).catch(() => {});
}
