import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { onSyncStatusChange } from '../services/syncEngine';

/**
 * Passive, non-blocking banner for sync problems — same tone as
 * OfflineMarquee (Build Spec Section 17: informative, never blocking
 * local-first work), but surfaces TWO failure modes that were
 * previously silent:
 *
 *   1. pullError — the caller (e.g. StudentsListScreen) couldn't refresh
 *      from the server. Passed in as a prop along with a retry callback.
 *      Plain "offline" is NOT treated as an error here — that's expected
 *      and already covered by OfflineMarquee; only genuine failures
 *      (auth errors, 500s, bad responses) are surfaced.
 *
 *   2. push sync errors — queued local operations (student edits, new
 *      registrations) failed to reach the server for a reason other than
 *      being offline. syncEngine already emits this via onSyncStatusChange,
 *      but nothing in the UI listened for it before now.
 *
 * Both auto-clear once the underlying condition resolves.
 */
export default function SyncIssueBanner({ pullError, onRetryPull }) {
  const [pushError, setPushError] = useState(null);

  useEffect(() => {
    const unsubscribe = onSyncStatusChange((s) => {
      if (s.state === 'error') {
        setPushError(s.error || 'Something went wrong while syncing.');
      } else if (s.state === 'idle' || s.state === 'syncing') {
        setPushError(null);
      }
    });
    return unsubscribe;
  }, []);

  // Pull errors take priority — they're actionable right now via Retry.
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
