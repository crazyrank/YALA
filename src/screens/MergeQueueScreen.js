import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { type } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';

/**
 * Resolves admission_no collisions from the two-step registration flow
 * (Build Spec Section 6). Principal sees both records side by side and
 * picks which one survives — the other is hard-deleted server-side,
 * since it was never a real second student.
 */
export default function MergeQueueScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/conflicts/admission-merge-queue/list?status=open');
      setItems(res.mergeQueue);
    } catch (err) {
      Alert.alert('Could not load', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resolve = async (item, canonicalId, discardedId) => {
    try {
      await api.post(`/conflicts/admission-merge-queue/${item.id}/resolve`, { canonicalId, discardedId });
      load();
      if (items.length <= 1) navigation.goBack();
    } catch (err) {
      Alert.alert('Could not resolve', err.message);
    }
  };

  return (
    <FlatList
      style={styles.container}
      data={items}
      refreshing={loading}
      onRefresh={load}
      keyExtractor={(item) => item.id}
      contentContainerStyle={items.length === 0 ? styles.emptyListContent : styles.listContent}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.admissionNo}>Admission No: {item.admission_no}</Text>
          <Text style={styles.hint}>
            Both of these were registered independently while offline. Confirm they're the
            same student and choose which record to keep.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            onPress={() => resolve(item, item.record_a_id, item.record_b_id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.optionName}>{item.record_a_name}</Text>
              <Text style={styles.optionMeta}>{item.record_a_class}</Text>
            </View>
            <Text style={styles.optionAction}>Keep this one</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.success} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            onPress={() => resolve(item, item.record_b_id, item.record_a_id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.optionName}>{item.record_b_name}</Text>
              <Text style={styles.optionMeta}>{item.record_b_class}</Text>
            </View>
            <Text style={styles.optionAction}>Keep this one</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.success} />
          </Pressable>
        </View>
      )}
      ListEmptyComponent={
        !loading && (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No duplicate registrations</Text>
            <Text style={styles.emptyText}>
              Everything's reconciled. New duplicates will show up here.
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

    emptyListContent: {
      flexGrow: 1,
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

    admissionNo: {
      ...type.h3,
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },

    hint: {
      ...type.bodySmall,
      color: colors.textMuted,
      marginBottom: spacing.md,
    },

    option: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },

    optionPressed: {
      opacity: 0.85,
    },

    optionName: {
      ...type.bodyMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },

    optionMeta: {
      ...type.caption,
      color: colors.textMuted,
      marginTop: 2,
    },

    optionAction: {
      ...type.label,
      fontSize: 11.5,
      color: colors.success,
      marginRight: spacing.xs,
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
