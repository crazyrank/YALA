import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';

/**
 * Blocks Principal/Director dashboard actions while open conflicts or
 * admission-merge items exist.
 *
 * Important UX rule: do NOT blank the screen on every tab focus.
 * Only show a full-screen spinner on the very first check. Later checks
 * refresh counts in the background and keep the current UI visible.
 */
export default function ConflictBlocker({ navigation, children }) {
  const [loading, setLoading] = useState(true); // first check only
  const [openCount, setOpenCount] = useState(0);
  const [mergeCount, setMergeCount] = useState(0);
  const hasCheckedOnce = useRef(false);

  const check = useCallback(async () => {
    // Only block UI the first time. Re-focus should not flash white.
    if (!hasCheckedOnce.current) {
      setLoading(true);
    }

    try {
      const [conflicts, merges] = await Promise.all([
        api.get('/conflicts?status=open'),
        api.get('/conflicts/admission-merge-queue/list?status=open'),
      ]);
      setOpenCount(conflicts.conflicts?.length || 0);
      setMergeCount(merges.mergeQueue?.length || 0);
    } catch {
      // Offline / network error: fail open (don't trap Principal).
      setOpenCount(0);
      setMergeCount(0);
    } finally {
      hasCheckedOnce.current = true;
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      check();
    }, [check])
  );

  // First visit only — brief spinner while we learn conflict state.
  if (loading && !hasCheckedOnce.current) {
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
          {openCount > 0 &&
            `\( {openCount} conflicting student record \){openCount > 1 ? 's' : ''}`}
          {openCount > 0 && mergeCount > 0 && ' and '}
          {mergeCount > 0 &&
            `\( {mergeCount} duplicate registration \){mergeCount > 1 ? 's' : ''} to reconcile`}
          {'. '}
          Other dashboard actions are paused until these are resolved.
        </Text>
        {openCount > 0 && (
          <Pressable
            style={styles.button}
            onPress={() => navigation.navigate('ConflictsTab')}
          >
            <Text style={styles.buttonText}>Review Conflicts</Text>
          </Pressable>
        )}
        {mergeCount > 0 && (
          <Pressable
            style={[styles.button, styles.buttonSecondary]}
            onPress={() =>
              navigation.navigate('MoreTab', { screen: 'MergeQueue' })
            }
          >
            <Text style={styles.buttonText}>Review Duplicate Registrations</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F8FC',
  },
  blockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    backgroundColor: '#0d1f33',
  },
  blockTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  blockBody: {
    color: '#cfd9e4',
    fontSize: 13.5,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#c9a24b',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    marginBottom: 10,
    width: '100%',
  },
  buttonSecondary: {
    backgroundColor: '#16324f',
  },
  buttonText: {
    textAlign: 'center',
    color: '#0d1f33',
    fontWeight: '700',
    fontSize: 14,
  },
});
