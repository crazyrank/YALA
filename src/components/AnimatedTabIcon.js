import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Tab icon with a smooth press/focus transition instead of an instant
 * color swap: the icon crossfades from inactive to active color and
 * gives a small bounce when it becomes focused.
 *
 * NOTE: we deliberately do NOT animate the icon's `color` prop via
 * Animated.createAnimatedComponent(Ionicons). Expo's Ionicons wraps the
 * underlying glyph in an async font-loading component, which breaks the
 * setNativeProps ref chain Animated relies on for non-native-driver
 * updates — causing "this._icon.setNativeProps is not a function".
 * Instead we crossfade two overlapping icons by opacity, which runs
 * entirely on the native driver and never touches setNativeProps.
 */
export default function AnimatedTabIcon({
  focused,
  activeName,
  inactiveName,
  activeColor,
  inactiveColor,
  size = 24,
}) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: focused ? 1 : 0,
      duration: 220,
      useNativeDriver: true, // opacity crossfade can use the native driver
    }).start();

    if (focused) {
      scale.setValue(0.8);
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }).start();
    }
  }, [focused]);

  const inactiveOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const activeOpacity = progress;

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        transform: [{ scale }],
      }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: inactiveOpacity }]}>
        <Ionicons name={inactiveName} size={size} color={inactiveColor} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: activeOpacity }]}>
        <Ionicons name={activeName} size={size} color={activeColor} />
      </Animated.View>
    </Animated.View>
  );
}
