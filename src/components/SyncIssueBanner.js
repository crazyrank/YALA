import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { onSyncStatusChange, getSyncFailures } from '../services/syncEngine';

/**
 * Passive, non-blocking banner for sync problems. Shows three things:
 *
 *   1. pullError: the server could not be checked for updates. Retry button.
 *   2. Parked failures: operations that were rejected or gave up after
 *      several tries. These stay until someone resolves them, so the
 *      count is read from the local queue, not from a single event.
 *   3. pushError: the last sync run failed for a non-offline reason.
 *
 * Offline is not shown here. OfflineMarquee covers that.
 */
export default function SyncIssueBanner({ pullError, onRetryPull, onPressAttention }) {
  const [pushError, setPushError] = useState(null);
  const [failureCount, setFailureCount] = useState(0);

  const refreshFailures = useCallback(async () => {
    try {
      const failures = await getSyncFailures();
      setFailureCount(failures.length);
    } catch {
      // Reading the queue must never break the screen.
    }
  }, []);

  useEffect(() => {
    refreshFailures();

    const unsubscribe = onSyncStatusChange((s) => {
      if (s.state === 'error') {
        setPushError(s.error || 'Something went wrong while syncing.');
      } else if (s.state === 'syncing') {
        setPushError(null);
      } else if (s.state === 'attention_needed') {
        refreshFailures();
      } else if (s.state === 'idle') {
        setPushError(null);
        refreshFailures();
      }
    });

    return unsubscribe;
  }, [refreshFailures]);

  if (pullError) {
    return (
      <View style={styles.container} accessibilityRole="alert">
        <Text style={styles.text}>Couldn't check for updates. Showing your last saved data.</Text>
        <Pressable onPress={onRetryPull} hitSlop={8}>
          <Text style={styles.retry}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (failureCount > 0) {
    const label = failureCount === 1
      ? '1 change could not be saved to the server.'
      : `${failureCount} changes could not be saved to the server.`;
    return (
      <Pressable
        onPress={onPressAttention}
        disabled={!onPressAttention}
        style={styles.container}
        accessibilityRole="alert"
      >
        <Text style={styles.text}>{label} Tap to review.</Text>
      </Pressable>
    );
  }

  if (pushError) {
    return (
      <View style={styles.container} accessibilityRole="alert">
        <Text style={styles.text}>Some changes haven't synced yet. We'll keep trying automatically.</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fbe4e0', paddingHorizontal: 14, paddingVertical: 8,
  },
  text: { flex: 1, fontSize: 11.5, color: '#9a3b2f', fontWeight: '500' },
  retry: { fontSize: 12, fontWeight: '700', color: '#16324f', marginLeft: 10 },
});
