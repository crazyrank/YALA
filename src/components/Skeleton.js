/**
 * Skeleton (shimmer) placeholders — the grey/pulse blocks YouTube, TradingView,
 * and most modern apps show while real content is still loading.
 *
 * Usage:
 *   <Skeleton width={120} height={16} />
 *   <Skeleton.Circle size={40} />
 *   <Skeleton.Card />          // dashboard stat card shape
 *   <Skeleton.StudentRow />    // student list row shape
 *   <Skeleton.Dashboard />     // full dashboard placeholder block
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { radius, shadow, spacing } from '../theme/spacing';

function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return anim;
}

/**
 * Base skeleton block. Opacity pulses between \~0.35 and \~0.85.
 */
export function Skeleton({
  width = '100%',
  height = 14,
  borderRadius = radius.sm,
  style,
  ...rest
}) {
  const { colors, isDark } = useTheme();
  const anim = useShimmer();

  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.85],
  });

  const baseColor = isDark ? colors.surfaceAlt : '#E4E8EF';

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          opacity,
        },
        style,
      ]}
      {...rest}
    />
  );
}

export function SkeletonCircle({ size = 40, style }) {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
    />
  );
}

/** Matches DashboardStatCard proportions (48% width, minHeight \~118). */
export function SkeletonStatCard({ style }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Skeleton width={36} height={36} borderRadius={12} style={{ marginBottom: 12 }} />
      <Skeleton width={48} height={28} borderRadius={8} style={{ marginBottom: 8 }} />
      <Skeleton width="70%" height={11} borderRadius={6} style={{ marginBottom: 6 }} />
      <Skeleton width="50%" height={10} borderRadius={6} />
    </View>
  );
}

/** Matches StudentCard row layout. */
export function SkeletonStudentRow({ style }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.studentRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <SkeletonCircle size={44} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="62%" height={15} borderRadius={6} style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height={12} borderRadius={6} style={{ marginBottom: 6 }} />
        <Skeleton width="28%" height={11} borderRadius={6} />
      </View>
      <Skeleton width={18} height={18} borderRadius={6} />
    </View>
  );
}

/**
 * Full dashboard skeleton: 4 stat cards + a few student rows.
 * Drop this in while the first local DB query (and optional server pull)
 * is still in flight so the screen never looks empty/blank.
 */
export function SkeletonDashboard({ rowCount = 5 }) {
  return (
    <View style={styles.dashboard}>
      <View style={styles.statsGrid}>
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </View>

      <Skeleton width={110} height={12} borderRadius={6} style={{ marginBottom: 12, marginTop: 4 }} />

      {Array.from({ length: rowCount }).map((_, i) => (
        <SkeletonStudentRow key={i} />
      ))}
    </View>
  );
}

/** Compact skeleton for ClassesScreen list items. */
export function SkeletonClassRow({ style }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.classRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Skeleton width={44} height={44} borderRadius={12} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="45%" height={15} borderRadius={6} style={{ marginBottom: 8 }} />
        <Skeleton width="30%" height={12} borderRadius={6} />
      </View>
      <Skeleton width={12} height={20} borderRadius={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    width: '48%',
    minHeight: 118,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    ...shadow.card,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...shadow.raised,
  },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    marginHorizontal: 16,
    ...shadow.raised,
  },
  dashboard: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});

// Named default for convenient import: import Skeleton from '...'
Skeleton.Circle = SkeletonCircle;
Skeleton.StatCard = SkeletonStatCard;
Skeleton.StudentRow = SkeletonStudentRow;
Skeleton.Dashboard = SkeletonDashboard;
Skeleton.ClassRow = SkeletonClassRow;

export default Skeleton;
