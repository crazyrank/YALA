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
  const [blocks, setBlocks] = useState([]);
  const [blocksAvailable, setBlocksAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
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
    }

    // Blocked networks are for directors and principals only. Other roles
    // get a refusal, and the section stays hidden for them.
    try {
      const res = await api.get('/login-blocks');
      setBlocks(res.blocks || []);
      setBlocksAvailable(true);
    } catch (err) {
      setBlocks([]);
      setBlocksAvailable(false);
    }

    setLoading(false);
    setRefreshing(false);
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

  const unblockNetwork = (block) => {
    Alert.alert(
      'Unblock this network?',
      'Sign-ins from this network will be allowed again straight away. The unblock is recorded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await api.post('/login-blocks/unblock', { ip: block.ip });
              await load(false);
            } catch (err) {
              Alert.alert('Could not unblock', err.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderBlocks = () => {
    if (!blocksAvailable) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Blocked networks</Text>
        {blocks.length === 0 ? (
          <Text style={styles.sectionEmpty}>No networks are blocked right now.</Text>
        ) : (
          blocks.map((block) => (
            <View key={block.ip} style={styles.blockCard}>
              <View style={styles.blockText}>
                <Text style={styles.name}>{block.ip}</Text>
                <Text style={styles.meta}>Blocked after repeated failed sign-ins</Text>
              </View>
              <Pressable
                onPress={() => unblockNetwork(block)}
                style={({ pressed }) => [styles.button, styles.approveButton, pressed && styles.pressed]}
              >
                <Text style={styles.buttonText}>Unblock</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const waiting = item.status === 'pending_verification';
    const busy = busyId === item.id;
    const expanded = expandedId === item.id;
    return (
      <Pressable
        onPress={() => setExpandedId(expanded ? null : item.id)}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
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

        {expanded && (
          <View style={styles.details}>
            <DetailRow label="Account" value={item.full_name || 'Unknown'} styles={styles} />
            <DetailRow label="Role" value={ROLE_LABEL[item.role] || item.role || 'Unknown'} styles={styles} />
            <DetailRow label="Device name" value={item.device_name || 'Unnamed device'} styles={styles} />
            <DetailRow label="Status" value={STATUS_LABEL[item.status] || item.status} styles={styles} />
            <DetailRow label="Last used" value={formatWhen(item.last_seen_at)} styles={styles} />
            <DetailRow label="Last sign-in" value={formatWhen(item.last_login_at)} styles={styles} />
            <DetailRow label="Sign-in IP" value={item.last_login_ip || 'Not recorded yet'} styles={styles} />
          </View>
        )}

        <View style={styles.actions}>
          {waiting && (
            <Pressable
              onPress={() => approve(item)}
              disabled={busy}
              style={({ pressed }) => [styles.button, styles.approveButton, pressed && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.buttonText}>Approve</Text>
              )}
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
      </Pressable>
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
          ListHeaderComponent={renderBlocks()}
          ListEmptyComponent={<Text style={styles.empty}>No active devices.</Text>}
        />
      )}
    </View>
  );
}

function DetailRow({ label, value, styles }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: 16, paddingBottom: 32 },

    section: { marginBottom: 20 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    sectionEmpty: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
    blockCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginBottom: 10,
    },
    blockText: { flex: 1, marginRight: 10 },

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

    details: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
      gap: 12,
    },
    detailLabel: { fontSize: 13, color: colors.textSecondary },
    detailValue: {
      flexShrink: 1,
      textAlign: 'right',
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },

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
    buttonText: { color: colors.textInverse, fontWeight: '700' },
    pressed: { opacity: 0.7 },
    error: { color: colors.error, padding: 16 },
    empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  });
}
