import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { type } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';

// Mirrors the backend's SECTION_CREATORS — used only to decide whether to
// show the "+" button. The server re-checks this on every write regardless.
const SECTION_CREATORS = {
  board: ['director'],
  management: ['director', 'principal'],
  class_teacher: ['director', 'principal', 'head_teacher'],
};

const SECTIONS = [
  { key: 'board', dataKey: 'board', label: 'Board of Directors', icon: 'shield-checkmark' },
  { key: 'management', dataKey: 'management', label: 'Management Team', icon: 'briefcase' },
  { key: 'class_teacher', dataKey: 'classTeachers', label: 'Class Teachers', icon: 'school' },
];

function getInitials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function StaffDirectoryScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user } = useAuth();

  const [data, setData] = useState({ board: [], management: [], classTeachers: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDirectory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = await api.get('/directory');
      setData({
        board: result.board || [],
        management: result.management || [],
        classTeachers: result.classTeachers || [],
      });
    } catch (err) {
      if (!err.isNetworkError) {
        Alert.alert('Could not load staff directory', err.message || 'Something went wrong.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDirectory();
    }, [loadDirectory])
  );

  const canCreateIn = (sectionKey) => (SECTION_CREATORS[sectionKey] || []).includes(user?.role);

  const handleCardPress = (sectionKey, entry) => {
    if (entry.linkedUserId) {
      Alert.alert(
        entry.fullName,
        `${entry.title} — this card follows their login account and can't be edited here.`
      );
      return;
    }
    if (!canCreateIn(sectionKey)) return;
    navigation.navigate('AddDirectoryEntry', { section: sectionKey, entry });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadDirectory(true)}
          tintColor={colors.gold}
          colors={[colors.gold]}
        />
      }
    >
      {SECTIONS.filter((s) => s.key === 'class_teacher' || (data[s.dataKey] || []).length > 0 || canCreateIn(s.key) || user?.role === 'director').map((section) => {
        // Visibility already comes filtered from the server (empty array =
        // either nothing yet, or not visible to this role) — director,
        // principal and head_teacher all just render what they got back.
        const entries = data[section.dataKey] || [];
        const canCreate = canCreateIn(section.key);

        return (
          <View key={section.key} style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon} size={16} color={colors.goldDark} />
              <Text style={styles.sectionTitle}>{section.label}</Text>
            </View>

            {entries.length === 0 && !canCreate ? null : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={entries}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.row}
                ListEmptyComponent={
                  canCreate ? (
                    <Text style={styles.emptyHint}>No one here yet — tap + to add someone.</Text>
                  ) : null
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                    onPress={() => handleCardPress(section.key, item)}
                  >
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={styles.cardPhoto} />
                    ) : (
                      <View style={styles.cardAvatar}>
                        <Text style={styles.cardAvatarText}>{getInitials(item.fullName)}</Text>
                      </View>
                    )}
                    <Text style={styles.cardName} numberOfLines={1}>
                      {item.fullName}
                    </Text>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </Pressable>
                )}
                ListFooterComponent={
                  canCreate ? (
                    <Pressable
                      style={({ pressed }) => [styles.addCard, pressed && styles.cardPressed]}
                      onPress={() => navigation.navigate('AddDirectoryEntry', { section: section.key })}
                    >
                      <Ionicons name="add" size={26} color={colors.goldDark} />
                      <Text style={styles.addCardText}>Add</Text>
                    </Pressable>
                  ) : null
                }
              />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors) {
  const cardWidth = 108;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingVertical: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    sectionBlock: {
      marginBottom: spacing.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    sectionTitle: {
      ...type.overline,
      color: colors.textMuted,
    },
    row: {
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    card: {
      width: cardWidth,
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      ...shadow.raised,
    },
    cardPressed: {
      opacity: 0.85,
    },
    cardPhoto: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.border,
      marginBottom: spacing.sm,
    },
    cardAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.goldTint,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    cardAvatarText: {
      ...type.h3,
      fontSize: 17,
      color: colors.goldDark,
    },
    cardName: {
      ...type.bodyMedium,
      fontSize: 12.5,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    cardTitle: {
      ...type.caption,
      fontSize: 10.5,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 2,
    },
    addCard: {
      width: cardWidth,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderStyle: 'dashed',
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
    },
    addCardText: {
      ...type.label,
      fontSize: 11,
      color: colors.goldDark,
      marginTop: spacing.xs,
    },
    emptyHint: {
      ...type.bodySmall,
      color: colors.textMuted,
      paddingVertical: spacing.md,
    },
  });
}
