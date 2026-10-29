import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { getDb } from '../db';
import { fetchAndCacheAllStudents } from '../services/studentSync';
import { setConflictCount } from '../services/conflictBadge';
import { useTheme } from '../theme/ThemeContext';
import { type } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';

const FIELD_LABELS = {
  full_name: 'Student name',
  gender: 'Gender',
  division: 'Section',
  class_level: 'Class',
  arm: 'Arm',
  guardian_name: 'Guardian name',
  guardian_phone: 'Guardian phone',
  status: 'Student status',
};

function readObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value) || {}; } catch (e) { return {}; }
  }
  return value;
}

function showValue(v) {
  if (v === null || v === undefined || v === '') return 'Empty';
  const text = String(v);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Plain list of what would change: one row per field that is different.
function describeChanges(item) {
  const saved = readObject(item.server_state);
  const wanted = readObject(readObject(item.incoming_change).changes);
  return Object.keys(wanted)
    .filter((f) => FIELD_LABELS[f] && String(wanted[f] ?? '') !== String(saved[f] ?? ''))
    .map((f) => ({ label: FIELD_LABELS[f], saved: showValue(saved[f]), wanted: showValue(wanted[f]) }));
}

export default function ConflictsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/conflicts?status=open');
      setConflicts(res.conflicts);
      setConflictCount(res.conflicts.length);
    } catch (err) {
      Alert.alert('Could not load the list', 'Check your internet, then pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const finishResolve = async (item, resolution) => {
    try {
      await api.post(`/conflicts/${item.id}/resolve`, { resolution });
    } catch (err) {
      if (err?.code !== 'ALREADY_RESOLVED') {
        Alert.alert('Not saved', 'This did not work. Check your internet and try again.');
        return;
      }
    }

    // Remove the card and update the red badge straight away.
    const next = conflicts.filter((c) => c.id !== item.id);
    setConflicts(next);
    setConflictCount(next.length);

    // Clear the "needs attention" mark kept on this phone for this student.
    try {
      const db = await getDb();
      await db.runAsync(
        `UPDATE sync_operations
         SET status = 'synced', error_code = NULL, error_message = NULL
         WHERE entity_id = ? AND status = 'conflicted'`,
        [item.student_id]
      );
      await db.runAsync(
        `UPDATE students SET local_dirty = 0
         WHERE id = ?
           AND NOT EXISTS (
             SELECT 1 FROM sync_operations WHERE entity_id = ? AND status = 'pending'
           )`,
        [item.student_id, item.student_id]
      );
      fetchAndCacheAllStudents({ force: true }).catch(() => {});
    } catch (e) {
      // The server is already correct; the phone fixes itself on the next sync.
    }
  };

  const resolve = (item, resolution) => {
    const useNew = resolution === 'restore';
    Alert.alert(
      useNew ? 'Use the new change?' : 'Keep what is saved?',
      useNew
        ? `${item.full_name} will be updated with the new change.`
        : `${item.full_name} will stay exactly as it is now. The new change will be thrown away.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: useNew ? 'Use new change' : 'Keep saved', onPress: () => finishResolve(item, resolution) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.staticHeader, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.pageTitle}>Conflicts</Text>
        <Text style={styles.pageSub}>Student records that were changed twice</Text>
      </View>
    <FlatList
      style={styles.flatList}
      data={conflicts}
      refreshing={loading}
      onRefresh={load}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        conflicts.length === 0 ? styles.emptyListContent : styles.listContent,
        { paddingTop: 8 },
      ]}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.studentName}>{item.full_name}</Text>
          <Text style={styles.admissionNo}>{item.admission_no}</Text>
          <Text style={styles.summary}>
            Someone tried to change this student, but the record had already been changed. Choose which one to keep.
          </Text>

          {describeChanges(item).map((c) => (
            <View key={c.label} style={styles.changeRow}>
              <Text style={styles.compareLabel}>{c.label}</Text>
              <Text style={styles.changeLine}>Saved now: {c.saved}</Text>
              <Text style={styles.changeLine}>New change: {c.wanted}</Text>
            </View>
          ))}

          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={() => resolve(item, 'restore')}
            >
              <Text style={styles.buttonText}>Use new change</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonSecondary,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => resolve(item, 'keep_deleted')}
            >
              <Text style={styles.buttonText}>Keep saved</Text>
            </Pressable>
          </View>
        </View>
      )}
      ListHeaderComponent={
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Ionicons name="sync" size={18} color={colors.inkSoft} />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>System Status</Text>
            <Text style={styles.statusSub}>
              Your student records are stored safely on this device.
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusBadgeText}>READY</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        !loading && (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Nothing to check</Text>
            <Text style={styles.emptyText}>
              Nothing needs your attention. Problems with student records will show here.
            </Text>
          </View>
        )
      }
    />
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    listContent: {
      padding: spacing.lg,
    },

    emptyListContent: {
      flexGrow: 1,
      padding: spacing.lg,
    },

    staticHeader: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },

    flatList: {
      flex: 1,
    },

    pageHeader: {
      marginBottom: spacing.md,
    },

    pageTitle: {
      ...type.h1,
      fontSize: 28,
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },

    pageSub: {
      ...type.body,
      fontSize: 13,
      marginTop: 4,
      color: colors.textSecondary,
    },

    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow.raised,
    },

    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md + 2,
      marginBottom: spacing.lg,
      ...shadow.raised,
    },

    statusIcon: {
      width: 38,
      height: 38,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },

    statusInfo: { flex: 1 },

    statusTitle: {
      ...type.label,
      fontSize: 13,
      color: colors.textPrimary,
    },

    statusSub: {
      ...type.bodySmall,
      marginTop: 3,
      color: colors.textMuted,
    },

    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.successBg,
      borderRadius: radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },

    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
      marginRight: 5,
    },

    statusBadgeText: {
      ...type.overline,
      fontSize: 8,
      color: colors.success,
    },

    studentName: {
      ...type.h3,
      fontSize: 16,
      color: colors.textPrimary,
    },

    admissionNo: {
      ...type.bodySmall,
      color: colors.textMuted,
      marginBottom: spacing.sm,
    },

    summary: {
      ...type.body,
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },

    compareRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },

    compareCol: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      padding: spacing.sm,
    },

    compareLabel: {
      ...type.overline,
      fontSize: 9.5,
      color: colors.goldDark,
      marginBottom: spacing.xs,
    },

    changeRow: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },

    changeLine: {
      ...type.body,
      fontSize: 14,
      color: colors.textPrimary,
    },

    buttonRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },

    button: {
      flex: 1,
      backgroundColor: colors.inkSoft,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm + 2,
    },

    buttonSecondary: {
      backgroundColor: colors.error,
    },

    buttonPressed: {
      opacity: 0.85,
    },

    buttonText: {
      ...type.button,
      textAlign: 'center',
      color: colors.textInverse,
      fontSize: 12,
    },

    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },

    emptyTitle: {
      ...type.h3,
      fontSize: 15,
      marginTop: spacing.md,
      color: colors.textPrimary,
    },

    emptyText: {
      ...type.bodySmall,
      marginTop: spacing.xs,
      textAlign: 'center',
      color: colors.textMuted,
    },
  });
}
