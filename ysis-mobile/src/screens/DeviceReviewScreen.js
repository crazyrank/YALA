import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

const STATUS_RANK = { pending_verification: 0, trusted: 1 };
const STATUS_LABEL = { pending_verification: 'Waiting for approval', trusted: 'Trusted' };
const ROLE_LABEL = { director: 'Director', principal: 'Principal', head_teacher: 'Head Teacher' };

function formatWhen(value) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

export default function DeviceReviewScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await api.get('/devices');
      const list = (res.devices || []).filter((d) => d.status !== 'revoked');
      list.sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));
      setDevices(list);
    } catch (err) {
      setError(
        err.isNetworkError
          ? 'An internet connection is needed to load devices.'
          : err.message || 'Devices could not be loaded.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const approve = async (device) => {
    setBusyId(device.id);
    try {
      await api.post(`/devices/${device.id}/approve`, {});
      await load(false);
    } catch (err) {
      Alert.alert('Could not approve', err.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const revokeNow = async (device) => {
    setBusyId(device.id);
    try {
      await api.delete(`/devices/${device.id}`);
      await load(false);
    } catch (err) {
      Alert.alert('Could not revoke', err.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmRevoke = (device) => {
    Alert.alert(
      'Revoke this device?',
      `${device.device_name || 'This device'} belonging to ${device.full_name || 'this user'} will be signed out and cannot be used again. If it is the phone you are using, you will be signed out too.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => revokeNow(device) },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const waiting = item.status === 'pending_verification';
    const busy = busyId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.name}>{item.full_name || 'Unknown user'}</Text>
            <Text style={styles.meta}>{ROLE_LABEL[item.role] || item.role || ''}</Text>
          </View>
          <View style={[styles.badge, waiting ? styles.badgeWarn : styles.badgeOk]}>
            <Text style={[styles.badgeText, { color: waiting ? colors.warning : colors.success }]}>
              {STATUS_LABEL[item.status] || item.status}
            </Text>
          </View>
        </View>
        <Text style={styles.meta}>Device: {item.device_name || 'Unnamed device'}</Text>
        <Text style={styles.meta}>Last used: {formatWhen(item.last_seen_at)}</Text>

        <View style={styles.actions}>
          {waiting && (
            <Pressable
              onPress={() => approve(item)}
              disabled={busy}
              style={({ pressed }) => [styles.button, styles.approveButton, pressed && styles.pressed]}
            >
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Approve</Text>}
            </Pressable>
          )}
          <Pressable
            onPress={() => confirmRevoke(item)}
            disabled={busy}
            style={({ pressed }) => [styles.button, styles.revokeButton, pressed && styles.pressed]}
          >
            <Text style={[styles.buttonText, { color: colors.error }]}>Revoke</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {!!error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />
          }
          ListEmptyComponent={<Text style={styles.empty}>No active devices.</Text>}
        />
      )}
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: 16, paddingBottom: 32 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
    cardTitleWrap: { flex: 1 },
    name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    meta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
    badgeWarn: { backgroundColor: colors.warningBg },
    badgeOk: { backgroundColor: colors.successBg },
    badgeText: { fontSize: 12, fontWeight: '600' },
    actions: { flexDirection: 'row', marginTop: 12 },
    button: {
      flex: 1,
      height: 42,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    approveButton: { backgroundColor: colors.success },
    revokeButton: { backgroundColor: colors.errorBg },
    buttonText: { color: '#FFFFFF', fontWeight: '700' },
    pressed: { opacity: 0.7 },
    error: { color: colors.error, padding: 16 },
    empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  });
}
