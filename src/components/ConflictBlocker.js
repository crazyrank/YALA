import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

/**
 * Locked decision (this conversation, "Choose the first"): an open
 * conflict BLOCKS other dashboard actions until it's resolved, not just
 * acknowledged/dismissed. Wrap this around Principal-only dashboard
 * screens — it renders its children ONLY when there are zero open
 * conflicts and zero open admission-merge-queue items; otherwise it
 * shows the blocking screen with a way to navigate to resolution.
 */
export default function ConflictBlocker({ navigation, children }) {
  const [loading, setLoading] = useState(true);
  const [openCount, setOpenCount] = useState(0);
  const [mergeCount, setMergeCount] = useState(0);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const [conflicts, merges] = await Promise.all([
        api.get('/conflicts?status=open'),
        api.get('/conflicts/admission-merge-queue/list?status=open'),
      ]);
      setOpenCount(conflicts.conflicts?.length || 0);
      setMergeCount(merges.mergeQueue?.length || 0);
    } catch {
      // If the check itself fails (e.g. offline), don't block the
      // Principal from their dashboard — fail open here, since the
      // blocking behavior is meant to force a decision on a KNOWN
      // conflict, not punish a connectivity gap.
      setOpenCount(0);
      setMergeCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { check(); }, [check]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const totalOpen = openCount + mergeCount;

  if (totalOpen > 0) {
    return (
      <View style={styles.blockContainer}>
        <Text style={styles.blockTitle}>Unresolved records need your decision</Text>
        <Text style={styles.blockBody}>
          {openCount > 0 && `${openCount} conflicting student record${openCount > 1 ? 's' : ''}`}
          {openCount > 0 && mergeCount > 0 && ' and '}
          {mergeCount > 0 && `${mergeCount} duplicate registration${mergeCount > 1 ? 's' : ''} to reconcile`}
          {'. '}Other dashboard actions are paused until these are resolved.
        </Text>
        {openCount > 0 && (
          <Pressable style={styles.button} onPress={() => navigation.navigate('ConflictsTab')}>
            <Text style={styles.buttonText}>Review Conflicts</Text>
          </Pressable>
        )}
        {mergeCount > 0 && (
          <Pressable style={[styles.button, styles.buttonSecondary]} onPress={() => navigation.navigate('MoreTab', { screen: 'MergeQueue' })}>
            <Text style={styles.buttonText}>Review Duplicate Registrations</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  blockContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: '#0d1f33',
  },
  blockTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  blockBody: { color: '#cfd9e4', fontSize: 13.5, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  button: {
    backgroundColor: '#c9a24b', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 6, marginBottom: 10, width: '100%',
  },
  buttonSecondary: { backgroundColor: '#16324f' },
  buttonText: { textAlign: 'center', color: '#0d1f33', fontWeight: '700', fontSize: 14 },
});
