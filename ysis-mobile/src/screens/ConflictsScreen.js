import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api/client';
import { setConflictCount } from '../services/conflictBadge';
import { useTheme } from '../theme/ThemeContext';
import { type } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';

export default function ConflictsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/conflicts?status=open');
      const list = res.conflicts || [];
      setConflicts(list);
      setConflictCount(list.length);
    } catch {
      setConflicts([]);
      setConflictCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const resolve = async (id, resolution) => {
    setActingId(id);
    try {
      await api.post(`/conflicts/${id}/resolve`, { resolution });
      // Remove the card and update the red badge straight away.
      setConflicts((prev) => {
        const next = prev.filter((c) => c.id !== id);
        setConflictCount(next.length);
        return next;
      });
    } catch {
      // leave the card; user can retry
    } finally {
      setActingId(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Conflicts</Text>
        <Text style={styles.subtitle}>Student records that were changed twice</Text>
      </View>

      <FlatList
        data={conflicts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={
          conflicts.length === 0 ? styles.emptyListContent : styles.listContent
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.studentName}>{item.student_name || 'Student'}</Text>
            <Text style={styles.admissionNo}>{item.admission_no || item.student_id}</Text>

            <View style={styles.diffBlock}>
              <Text style={styles.diffLabel}>On this device</Text>
              <Text style={styles.diffValue}>{item.local_summary || '—'}</Text>
            </View>
            <View style={styles.diffBlock}>
              <Text style={styles.diffLabel}>On the server</Text>
              <Text style={styles.diffValue}>{item.server_summary || '—'}</Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                style={[styles.button, styles.keepLocal]}
                disabled={actingId === item.id}
                onPress={() => resolve(item.id, 'keep_local')}
              >
                {actingId === item.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Keep this device</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.button, styles.keepServer]}
                disabled={actingId === item.id}
                onPress={() => resolve(item.id, 'keep_server')}
              >
                <Text style={styles.buttonText}>Keep saved</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.statusCard}>
            <View style={styles.statusIcon}>
              <Ionicons name="sync" size={18} color={colors.success} />
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

    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },

    title: {
      ...type.h1,
      fontSize: 28,
      color: colors.textPrimary,
    },

    subtitle: {
      ...type.bodySmall,
      color: colors.textSecondary,
      marginTop: 4,
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
      backgroundColor: colors.mode === 'dark' ? 'rgba(125, 187, 165, 0.18)' : colors.successBg,
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
      backgroundColor: colors.mode === 'dark' ? 'rgba(125, 187, 165, 0.22)' : colors.successBg,
      borderRadius: radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderWidth: colors.mode === 'dark' ? 1 : 0,
      borderColor: colors.mode === 'dark' ? 'rgba(125, 187, 165, 0.45)' : 'transparent',
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
      fontSize: 9,
      letterSpacing: 0.6,
      color: colors.mode === 'dark' ? '#A8D5C4' : colors.success,
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

    diffBlock: {
      marginTop: spacing.sm,
    },

    diffLabel: {
      ...type.overline,
      fontSize: 10,
      color: colors.textMuted,
      marginBottom: 2,
    },

    diffValue: {
      ...type.body,
      fontSize: 14,
      color: colors.textPrimary,
    },

    actions: {
      flexDirection: 'row',
      marginTop: spacing.md,
      gap: spacing.sm,
    },

    button: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },

    keepLocal: {
      backgroundColor: colors.inkSoft,
    },

    keepServer: {
      backgroundColor: colors.goldDark || colors.gold,
    },

    buttonText: {
      ...type.label,
      fontSize: 13,
      color: '#FFFFFF',
    },

    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingTop: 48,
    },

    emptyTitle: {
      ...type.h3,
      color: colors.textPrimary,
      marginTop: spacing.md,
    },

    emptyText: {
      ...type.bodySmall,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });
}
