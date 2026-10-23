import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { getParkedOperations, requeueTransientFailures } from '../services/syncRecovery';

const OP_LABELS = {
  create_student: 'New student',
  edit_student: 'Student edit',
  upload_photo: 'Photo upload',
  promote_student: 'Promotion',
};

/**
 * Lists changes this device could not save to the server, with the reason
 * for each. Retry resends only the ones that can succeed without a change.
 * Everything else needs the record corrected first.
 */
export default function ParkedOperationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
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

  const retryableCount = items.filter((i) => i.retryable).length;

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.full_name || 'Unknown record'}</Text>
      <Text style={styles.meta}>
        {OP_LABELS[item.op_type] || item.op_type}
        {item.admission_no ? `  ${item.admission_no}` : ''}
      </Text>
      <Text style={styles.reason}>{item.error_message || item.error_code || 'No reason recorded'}</Text>
      <Text style={item.retryable ? styles.tagRetry : styles.tagFix}>
        {item.retryable ? 'Can be retried' : 'Needs a correction'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Changes not saved</Text>
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

      <FlatList
        data={items}
        keyExtractor={(item) => item.operation_id}
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
    container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
    title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
    sub: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
    button: {
      backgroundColor: colors.gold,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 16,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
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
    tagRetry: { fontSize: 12, fontWeight: '700', color: colors.success, marginTop: 8 },
    tagFix: { fontSize: 12, fontWeight: '700', color: colors.warning, marginTop: 8 },
  });
}
