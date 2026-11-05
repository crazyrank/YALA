import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../api/client';
import { onSyncStatusChange } from './syncEngine';

// Show alerts as banners even when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// One Android channel per kind of alert, so users can silence sync noise
// without losing security alerts.
const CHANNELS = {
  security: { name: 'Security alerts', importance: Notifications.AndroidImportance.HIGH },
  sync: { name: 'Sync alerts', importance: Notifications.AndroidImportance.DEFAULT },
  general: { name: 'School alerts', importance: Notifications.AndroidImportance.DEFAULT },
};

let channelsReady = false;
async function ensureChannels() {
  if (Platform.OS !== 'android' || channelsReady) return;
  for (const [id, cfg] of Object.entries(CHANNELS)) {
    await Notifications.setNotificationChannelAsync(id, cfg);
  }
  channelsReady = true;
}

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

  await ensureChannels();

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.post('/push/token', { token });
  return token;
}

// Local alert when records could not be saved. At most one every 10 minutes.
const SYNC_ALERT_GAP_MS = 10 * 60 * 1000;
let syncAlertsStarted = false;
let lastSyncAlertAt = 0;

export function startSyncAlerts() {
  if (syncAlertsStarted) return;
  syncAlertsStarted = true;

  onSyncStatusChange(async (status) => {
    if (status.state !== 'attention_needed') return;
    if (Date.now() - lastSyncAlertAt < SYNC_ALERT_GAP_MS) return;
    lastSyncAlertAt = Date.now();

    const count = status.items?.length || 0;
    try {
      await ensureChannels();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Changes not saved',
          body:
            count === 1
              ? '1 change could not be saved. Open the app to review it.'
              : `${count} changes could not be saved. Open the app to review them.`,
          data: { category: 'sync' },
        },
        trigger: Platform.OS === 'android' ? { channelId: 'sync' } : null,
      });
    } catch (err) {
      console.warn('Sync alert skipped:', err.message);
    }
  });
}

/** Fire-and-forget registration after sign-in or unlock. Never blocks the UI. */
export function registerInBackground() {
  startSyncAlerts();
  registerForPushNotifications().catch((err) =>
    console.warn('Push registration skipped:', err.message)
  );
}
