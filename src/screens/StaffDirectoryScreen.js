import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import { type } from '../theme/typography';
import { spacing, radius, shadow } from '../theme/spacing';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// How much a card grows / lifts as it nears the center of the row, versus
// its resting state at the edges. Tuned to read as "raised", not "popping".
const COVERFLOW_SCALE = [0.88, 1.08];
const COVERFLOW_LIFT = 8; // px of translateY at rest vs peak
const COVERFLOW_ELEVATION = [2, 12]; // Android
const COVERFLOW_SHADOW_OPACITY = [0.15, 0.4]; // iOS

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

// Speed of the auto-slide, in px per animation frame. ~0.5 gives a slow,
// readable drift (~30px/sec) — fast enough to notice, slow enough to
// still read names as they pass.
const AUTO_SCROLL_SPEED = 0.5;

/**
 * A horizontal row that drifts right-to-left on its own, looping forever,
 * and pauses the moment the person touches it so a manual swipe or tap
 * never fights the animation. Looping is done by rendering the entries
 * twice back-to-back and snapping the offset back by one set's width the
 * instant we cross it — since set two is identical to set one, that jump
 * is invisible.
 */
function AutoScrollRow({ entries, cardWidth, itemGap, rowHeight, renderCard, addCardEl, emptyHint }) {
  const scrollRef = useRef(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef(null);
  // Tracks the same value as offsetRef, but as an Animated.Value so each
  // card's scale/lift/shadow can be interpolated straight off it -- during
  // both the auto-drift (set via rAF) and manual drags (set via onScroll).
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const itemStride = cardWidth + itemGap;
  const singleSetWidth = entries.length * itemStride;
  const canLoop = entries.length > 1;
  const loopEntries = canLoop ? [...entries, ...entries] : entries;
  const viewportWidth = Dimensions.get('window').width;

  useEffect(() => {
    if (!canLoop) return undefined;

    const step = () => {
      if (!pausedRef.current) {
        offsetRef.current += AUTO_SCROLL_SPEED;
        if (offsetRef.current >= singleSetWidth) {
          offsetRef.current -= singleSetWidth;
        }
        scrollRef.current?.scrollTo({ x: offsetRef.current, animated: false });
        scrollAnim.setValue(offsetRef.current);
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [canLoop, singleSetWidth]);

  if (entries.length === 0) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ height: rowHeight, flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: itemGap, alignItems: 'center' }}
      >
        {emptyHint}
        {addCardEl}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ height: rowHeight, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: itemGap }}
      scrollEventThrottle={16}
      onScroll={(e) => {
        scrollAnim.setValue(e.nativeEvent.contentOffset.x);
      }}
      onTouchStart={() => {
        pausedRef.current = true;
      }}
      onScrollEndDrag={(e) => {
        offsetRef.current = e.nativeEvent.contentOffset.x % (singleSetWidth || 1);
      }}
      onMomentumScrollEnd={(e) => {
        offsetRef.current = e.nativeEvent.contentOffset.x % (singleSetWidth || 1);
        pausedRef.current = false;
      }}
      onTouchEnd={() => {
        // If it was a tap (no momentum will fire), resume shortly after.
        setTimeout(() => {
          pausedRef.current = false;
        }, 150);
      }}
    >
      {loopEntries.map((item, idx) => {
        // The scroll offset at which THIS card sits exactly centered in
        // the viewport. Interpolating scrollAnim against that value is
        // what makes each card individually swell and lift as it drifts
        // through the middle, then settle back down toward the edges.
        const centerScrollValue = idx * itemStride + spacing.lg + cardWidth / 2 - viewportWidth / 2;
        const inputRange = [centerScrollValue - itemStride, centerScrollValue, centerScrollValue + itemStride];
        const cardAnimatedStyle = {
          transform: [
            {
              scale: scrollAnim.interpolate({
                inputRange,
                outputRange: [COVERFLOW_SCALE[0], COVERFLOW_SCALE[1], COVERFLOW_SCALE[0]],
                extrapolate: 'clamp',
              }),
            },
            {
              translateY: scrollAnim.interpolate({
                inputRange,
                outputRange: [COVERFLOW_LIFT, -COVERFLOW_LIFT, COVERFLOW_LIFT],
                extrapolate: 'clamp',
              }),
            },
          ],
          elevation: scrollAnim.interpolate({
            inputRange,
            outputRange: [COVERFLOW_ELEVATION[0], COVERFLOW_ELEVATION[1], COVERFLOW_ELEVATION[0]],
            extrapolate: 'clamp',
          }),
          shadowOpacity: scrollAnim.interpolate({
            inputRange,
            outputRange: [COVERFLOW_SHADOW_OPACITY[0], COVERFLOW_SHADOW_OPACITY[1], COVERFLOW_SHADOW_OPACITY[0]],
            extrapolate: 'clamp',
          }),
        };
        return renderCard(item, idx, cardAnimatedStyle);
      })}
      {addCardEl}
    </ScrollView>
  );
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
              <AutoScrollRow
                entries={entries}
                cardWidth={styles.cardWidthValue}
                itemGap={styles.itemGapValue}
                rowHeight={styles.rowHeightValue}
                emptyHint={
                  canCreate ? (
                    <Text style={styles.emptyHint}>No one here yet — tap + to add someone.</Text>
                  ) : null
                }
                renderCard={(item, idx, animatedStyle) => (
                  <AnimatedPressable
                    key={`${item.id}-${idx}`}
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed, animatedStyle]}
                    onPress={() => handleCardPress(section.key, item)}
                  >
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={styles.cardPhoto} />
                    ) : (
                      <View style={styles.cardAvatar}>
                        <Text style={styles.cardAvatarText}>{getInitials(item.fullName)}</Text>
                      </View>
                    )}
                    <View style={styles.cardTextBlock}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {item.fullName}
                      </Text>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                  </AnimatedPressable>
                )}
                addCardEl={
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
  // Responsive: size off the actual screen width so cards look right on
  // any phone, showing ~2.3 cards per row (matches the reference — one
  // full card, one full card, a peek of the next) instead of a fixed px.
  const screenWidth = Dimensions.get('window').width;
  const cardWidth = Math.round((screenWidth - spacing.lg * 2 - spacing.md * 2) / 2.3);
  const photoHeight = cardWidth; // square photo
  const textBlockHeight = 52;
  const cardHeight = photoHeight + textBlockHeight;

  const styleSheet = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingVertical: spacing.md,
      paddingBottom: spacing.lg,
    },
    sectionBlock: {
      marginBottom: spacing.sm,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xs,
    },
    sectionTitle: {
      ...type.overline,
      color: colors.textMuted,
    },
    card: {
      width: cardWidth,
      height: cardHeight,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      overflow: 'hidden', // clips the photo's square corners to the card's rounded top
      ...shadow.raised,
    },
    cardPressed: {
      opacity: 0.85,
    },
    // Photo fills the full width of the card and takes up the top half —
    // no padding around it, so it reads as a real photo, not a thumbnail.
    cardPhoto: {
      width: '100%',
      height: photoHeight,
      backgroundColor: colors.border,
    },
    cardAvatar: {
      width: '100%',
      height: photoHeight,
      backgroundColor: colors.goldTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardAvatarText: {
      ...type.h3,
      fontSize: Math.round(cardWidth * 0.22),
      color: colors.goldDark,
    },
    // Text sits below the photo in its own padded block, clearly separated.
    cardTextBlock: {
      height: textBlockHeight,
      paddingHorizontal: spacing.sm,
      justifyContent: 'center',
    },
    cardName: {
      ...type.bodyMedium,
      fontSize: 13,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    cardTitle: {
      ...type.caption,
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 2,
    },
    addCard: {
      width: cardWidth,
      height: cardHeight,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderStyle: 'dashed',
      borderRadius: radius.lg,
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
      paddingVertical: spacing.sm,
      maxWidth: cardWidth * 1.6,
    },
  });

  // Plain numbers AutoScrollRow needs for its own scroll-position math —
  // not style objects, so they live alongside the sheet rather than in it.
  styleSheet.cardWidthValue = cardWidth;
  styleSheet.itemGapValue = spacing.sm;
  styleSheet.rowHeightValue = cardHeight;

  return styleSheet;
}
