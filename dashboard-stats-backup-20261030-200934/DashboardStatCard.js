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
  color = '#7952C7',
  bg = '#FFFFFF',
  delay = 0,
}) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const valueAnim = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 480,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

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
      useNativeDriver: false,
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
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={23} color={color} />
      </View>

      <View style={styles.textWrap}>
        <Text
          style={[styles.value, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {displayValue}
        </Text>

        <Text
          style={[styles.title, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {title}
        </Text>

        {!!subtitle && (
          <Text
            style={[styles.subtitle, { color: colors.textMuted }]}
            numberOfLines={2}
          >
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
    minHeight: 100,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    ...shadow.card,
  },

  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: '#F0EAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    flexShrink: 0,
  },

  textWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },

  value: {
    fontFamily: fontFamily.display,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.8,
  },

  title: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 11,
    marginTop: 2,
  },

  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
});
