import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl, ActivityIndicator, StyleSheet } from 'react-native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';

function formatWhen(value) {
  return value ? new Date(value).toLocaleString() : '';
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await api.get('/notifications');
      setItems(res.notifications || []);
    } catch (err) {
      setError(
        err.isNetworkError
          ? 'An internet connection is needed to load notifications.'
          : err.message || 'Notifications could not be loaded.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const markRead = async (item) => {
    if (item.status !== 'unread') return;
    try {
      await api.patch(`/notifications/${item.id}`, { status: 'read' });
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, status: 'read' } : n)));
    } catch {
      // Leave the item unread if the update fails
    }
  };

  const renderItem = ({ item }) => {
    const unread = item.status === 'unread';
    return (
      <Pressable
        onPress={() => markRead(item)}
        style={({ pressed }) => [styles.card, unread && styles.cardUnread, pressed && styles.pressed]}
      >
        <Text style={[styles.title, unread && styles.titleUnread]}>{item.title}</Text>
        {!!item.body && <Text style={styles.body}>{item.body}</Text>}
        <Text style={styles.when}>{formatWhen(item.created_at)}</Text>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.gold} />
        }
        ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
      />
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
      marginBottom: 10,
    },
    cardUnread: { borderLeftWidth: 4, borderLeftColor: colors.gold },
    pressed: { opacity: 0.7 },
    title: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    titleUnread: { fontWeight: '800' },
    body: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    when: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
    error: { color: colors.error, padding: 16 },
    empty: { textAlign: 'center', color: colors.textSecondary, marginTop: 40 },
  });
}
