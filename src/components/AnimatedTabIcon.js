import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

/**
 * Tab icon with a smooth press/focus transition instead of an instant
 * color swap: the icon crossfades from inactive to active color and
 * gives a small bounce when it becomes focused.
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
      useNativeDriver: false, // color interpolation can't use the native driver
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

  const color = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <AnimatedIonicons
        name={focused ? activeName : inactiveName}
        size={size}
        color={color}
      />
    </Animated.View>
  );
}
