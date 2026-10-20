import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../api/client';

// Show alerts as banners even when the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Asks for permission, gets this device's Expo push token and sends it to the server.
 * Returns the token, or null when push is unavailable (simulator, permission denied,
 * or Expo Go, which does not support remote push on Android).
 */
export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'School alerts',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.post('/push/token', { token });
  return token;
}

/** Fire-and-forget registration after sign-in or unlock. Never blocks the UI. */
export function registerInBackground() {
  registerForPushNotifications().catch((err) =>
    console.warn('Push registration skipped:', err.message)
  );
}
