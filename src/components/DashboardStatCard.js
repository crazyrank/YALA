import React, { useEffect, useRef } from 'react';
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
  color = '#3157D5',
  bg = '#EAF2FF',
  delay = 0,
}) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, delay]);

  const animatedStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.94, 1],
        }),
      },
    ],
  };

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: bg, borderColor: colors.border },
        animatedStyle,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>

      <Text style={[styles.value, { color }]}>{value}</Text>

      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {title}
      </Text>

      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    minHeight: 132,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    ...shadow.raised,
  },

  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  value: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    letterSpacing: -0.5,
  },

  title: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 3,
  },

  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: 10.5,
    marginTop: 3,
  },
});
