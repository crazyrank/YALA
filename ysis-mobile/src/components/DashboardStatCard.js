import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { radius, shadow } from '../theme/spacing';

export default function DashboardStatCard({
  icon = 'ellipse',
  value,
  title,
  subtitle,
  color = '#17263B',
  bg = '#FFFFFF',
  delay = 0,
}) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const valueAnim = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(value);

  // Entrance animation (runs once on mount)
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 480,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  // Animate the number when the value prop changes
  useEffect(() => {
    const numeric = typeof value === 'number' ? value : parseFloat(value);
    if (Number.isNaN(numeric)) {
      setDisplayValue(value);
      return;
    }

    valueAnim.setValue(0);
    const start = typeof displayValue === 'number' ? displayValue : 0;
    const end = numeric;

    const listener = valueAnim.addListener(({ value: v }) => {
      setDisplayValue(Math.round(start + (end - start) * v));
    });

    Animated.timing(valueAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // we need the JS listener
    }).start(() => {
      valueAnim.removeListener(listener);
      setDisplayValue(end);
    });

    return () => valueAnim.removeListener(listener);
  }, [value]);

  const animatedStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  };

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor: colors.border,
        },
        animatedStyle,
      ]}
    >
      {/* Icon sits to the left, centred vertically, in a fixed-width slot so every card's text lines up */}
      <View style={styles.iconSlot}>
        <Ionicons name={icon} size={30} color={color} />
      </View>

      <View style={styles.textWrap}>
        <Text style={[styles.value, { color: colors.textPrimary }]} numberOfLines={1}>
          {displayValue}
        </Text>

        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>

        {!!subtitle && (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    minHeight: 88,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    ...shadow.card,
  },

  iconSlot: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  textWrap: {
    flex: 1,
  },

  value: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.8,
  },

  title: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 3,
  },

  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    marginTop: 2,
  },
});
