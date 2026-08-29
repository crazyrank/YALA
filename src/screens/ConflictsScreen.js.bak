import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { type } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';

export default function ConflictsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/conflicts?status=open');
      setConflicts(res.conflicts);
    } catch (err) {
      Alert.alert('Could not load conflicts', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resolve = async (conflictId, resolution) => {
    try {
      await api.post(`/conflicts/${conflictId}/resolve`, { resolution });
      load();
    } catch (err) {
      Alert.alert('Could not resolve', err.message);
    }
  };

  return (
    <FlatList
      style={styles.container}
      data={conflicts}
      refreshing={loading}
      onRefresh={load}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.studentName}>{item.full_name}</Text>
          <Text style={styles.admissionNo}>{item.admission_no}</Text>
          <Text style={styles.summary}>{item.conflict_summary}</Text>

          <View style={styles.compareRow}>
            <View style={styles.compareCol}>
              <Text style={styles.compareLabel}>Current on server</Text>
              <Text style={styles.compareValue}>{JSON.stringify(item.server_state, null, 2)}</Text>
            </View>
            <View style={styles.compareCol}>
              <Text style={styles.compareLabel}>Attempted change</Text>
              <Text style={styles.compareValue}>{JSON.stringify(item.incoming_change, null, 2)}</Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              onPress={() => resolve(item.id, 'restore')}
            >
              <Text style={styles.buttonText}>Apply the Change</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.buttonSecondary,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => resolve(item.id, 'keep_deleted')}
            >
              <Text style={styles.buttonText}>Keep Current</Text>
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
            <Text style={styles.emptyTitle}>No open conflicts</Text>
            <Text style={styles.emptyText}>
              Everything is in sync. New conflicts will show up here.
            </Text>
          </View>
        )
      }
    />
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

    compareValue: {
      fontSize: 10,
      color: colors.textSecondary,
      fontFamily: 'monospace',
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
      alignItems: 'center',
      paddingTop: spacing.xxl * 2,
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
