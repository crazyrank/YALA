import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import {
  getParkedOperations,
  requeueTransientFailures,
  discardParkedOperations,
  discardMissingRecordOperations,
} from '../services/syncRecovery';

const OP_LABELS = {
  create_student: 'New student',
  edit_student: 'Student edit',
  upload_photo: 'Photo upload',
  promote_student: 'Promotion',
};

/**
 * Lists changes this device could not save to the server, with the reason
 * for each. Retry resends only the ones that can succeed without a change.
 * Anything that can never succeed can be discarded.
 */
export default function ParkedOperationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await getParkedOperations());
    } catch (err) {
      Alert.alert('Could not load changes', err.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const retryTransient = async () => {
    setBusy(true);
    try {
      const count = await requeueTransientFailures();
      Alert.alert(
        'Retrying',
        count === 0 ? 'Nothing can be retried automatically.' : `${count} change(s) queued for another try.`
      );
      await load();
    } catch (err) {
      Alert.alert('Retry failed', err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDiscard = (item) => {
    Alert.alert(
      'Discard this change?',
      'It will be removed from this device and will not be sent to the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            try {
              await discardParkedOperations(item.operation_ids);
              await load();
            } catch (err) {
              Alert.alert('Could not discard', err.message);
            }
          },
        },
      ]
    );
  };

  const missingCount = items.filter((i) => i.error_code === 'NOT_FOUND').length;

  const confirmDiscardMissing = () => {
    Alert.alert(
      'Discard missing-record changes?',
      `${missingCount} change(s) belong to students that are no longer on the server. They can never be saved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard all',
          style: 'destructive',
          onPress: async () => {
            try {
              await discardMissingRecordOperations();
              await load();
            } catch (err) {
              Alert.alert('Could not discard', err.message);
            }
          },
        },
      ]
    );
  };

  const retryableCount = items.filter((i) => i.retryable).length;

  const tagLabel = (item) => {
    if (item.retryable) return 'Can be retried';
    if (item.error_code === 'NOT_FOUND') return 'Missing on server';
    return 'Needs a correction';
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.full_name || 'Unknown record'}</Text>
      <Text style={styles.meta}>
        {OP_LABELS[item.op_type] || item.op_type}
        {item.admission_no ? `  ${item.admission_no}` : ''}
        {item.duplicates > 1 ? `  (x${item.duplicates})` : ''}
      </Text>
      <Text style={styles.reason}>{item.reason}</Text>
      <View style={styles.cardFooter}>
        <Text style={item.retryable ? styles.tagRetry : styles.tagFix}>{tagLabel(item)}</Text>
        <Pressable
          onPress={() => confirmDiscard(item)}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={styles.discard}>Discard</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sub}>
        {items.length === 0
          ? 'Everything on this device has reached the server.'
          : `${items.length} change(s) could not be saved yet.`}
      </Text>

      {retryableCount > 0 && (
        <Pressable
          onPress={retryTransient}
          disabled={busy}
          accessibilityRole="button"
          style={[styles.button, busy && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>
            {busy ? 'Retrying...' : `Retry ${retryableCount} automatically`}
          </Text>
        </Pressable>
      )}

      {missingCount > 0 && (
        <Pressable
          onPress={confirmDiscardMissing}
          accessibilityRole="button"
          style={styles.buttonOutline}
        >
          <Text style={styles.buttonOutlineText}>
            {`Discard ${missingCount} missing-record change(s)`}
          </Text>
        </Pressable>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.operation_ids[0]}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshing={busy}
        onRefresh={load}
      />
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20, paddingTop: 16 },
    sub: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
    button: {
      backgroundColor: colors.gold,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 12,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
    buttonOutline: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.warning,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 16,
    },
    buttonOutlineText: { color: colors.warning, fontSize: 14, fontWeight: '700' },
    list: { paddingBottom: 40, gap: 12 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    reason: { fontSize: 13, color: colors.textPrimary, marginTop: 8 },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    tagRetry: { fontSize: 12, fontWeight: '700', color: colors.success },
    tagFix: { fontSize: 12, fontWeight: '700', color: colors.warning },
    discard: { fontSize: 13, fontWeight: '700', color: colors.error },
  });
}
