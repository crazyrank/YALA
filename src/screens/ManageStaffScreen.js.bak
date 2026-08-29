import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { type } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';

/**
 * Lists the staff the caller manages (Director → Principals they created,
 * Principal → Head Teachers they created) via GET /users. Refetches every
 * time this screen comes into focus, since a freshly created account
 * (from CreateAccountScreen) needs to show up immediately on "Done".
 */
export default function ManageStaffScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { user } = useAuth();
  const staffLabel = user?.role === 'director' ? 'Principals' : 'Head Teachers';

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStaff = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = await api.get('/users');
      setStaff(result.users || []);
    } catch (err) {
      if (!err.isNetworkError) {
        Alert.alert('Could not load staff', err.message || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStaff();
    }, [loadStaff])
  );

  const toggleStatus = (member) => {
    const nextStatus = member.status === 'active' ? 'suspended' : 'active';
    const verb = nextStatus === 'suspended' ? 'Disable' : 'Re-enable';

    Alert.alert(
      `${verb} account?`,
      `${member.fullName} will ${nextStatus === 'suspended' ? 'no longer be able to sign in.' : 'be able to sign in again.'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          style: nextStatus === 'suspended' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const result = await api.patch(`/users/${member.id}/status`, { status: nextStatus });
              setStaff((prev) => prev.map((s) => (s.id === member.id ? result.user : s)));
            } catch (err) {
              Alert.alert('Could not update account', err.message || 'Something went wrong.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.createButton, pressed && styles.createButtonPressed]}
        onPress={() => navigation.navigate('CreateAccount')}
      >
        <Ionicons name="add-circle" size={18} color={colors.ink} />
        <Text style={styles.createButtonText}>
          Create {staffLabel === 'Principals' ? 'Principal' : 'Head Teacher'}
        </Text>
      </Pressable>

      <FlatList
        data={staff}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadStaff(true)}
            tintColor={colors.gold}
            colors={[colors.gold]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No {staffLabel.toLowerCase()} yet</Text>
              <Text style={styles.emptyText}>
                Tap "Create" above to add one.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.fullName || '?').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.fullName}</Text>
              <Text style={styles.email}>{item.email}</Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: item.status === 'active' ? colors.success : colors.error },
                  ]}
                />
                <Text
                  style={[
                    styles.status,
                    { color: item.status === 'active' ? colors.success : colors.error },
                  ]}
                >
                  {item.status === 'active' ? 'Active' : 'Suspended'}
                </Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.toggleButton,
                item.status === 'active' && styles.toggleButtonDanger,
                pressed && styles.toggleButtonPressed,
              ]}
              onPress={() => toggleStatus(item)}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  item.status === 'active' && styles.toggleButtonTextDanger,
                ]}
              >
                {item.status === 'active' ? 'Disable' : 'Enable'}
              </Text>
            </Pressable>
          </View>
        )}
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

    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.gold,
      margin: spacing.lg,
      paddingVertical: spacing.md + 2,
      borderRadius: radius.md,
      ...shadow.goldGlow,
    },

    createButtonPressed: {
      opacity: 0.88,
    },

    createButtonText: {
      ...type.button,
      color: colors.ink,
      fontSize: 15,
    },

    listContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxl,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md + 2,
      marginBottom: spacing.md,
      ...shadow.raised,
    },

    avatar: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      backgroundColor: colors.goldTint,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },

    avatarText: {
      ...type.h3,
      fontSize: 17,
      color: colors.goldDark,
    },

    name: {
      ...type.bodyMedium,
      fontSize: 15,
      color: colors.textPrimary,
    },

    email: {
      ...type.bodySmall,
      color: colors.textMuted,
      marginTop: 2,
    },

    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs + 2,
    },

    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 5,
    },

    status: {
      ...type.overline,
      fontSize: 9.5,
    },

    toggleButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.inkSoft,
      borderRadius: radius.sm,
    },

    toggleButtonDanger: {
      backgroundColor: colors.errorBg,
    },

    toggleButtonPressed: {
      opacity: 0.85,
    },

    toggleButtonText: {
      ...type.label,
      fontSize: 11.5,
      color: colors.textInverse,
    },

    toggleButtonTextDanger: {
      color: colors.error,
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
