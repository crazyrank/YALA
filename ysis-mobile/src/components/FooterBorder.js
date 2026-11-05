import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const CYCLE_MS = 14000; // one full lap, slow on purpose
const STROKE = 1.5;
const RADIUS = 27;
const SEGMENT_FRACTION = 0.22; // length of each moving highlight

export default function FooterBorder() {
  const { colors, isDark } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const { width, height } = size;
  const w = width - STROKE;
  const h = height - STROKE;

  // Approximate perimeter of the rounded rectangle
  const perimeter = 2 * (w - 2 * RADIUS + h - 2 * RADIUS) + 2 * Math.PI * RADIUS;
  const segment = perimeter * SEGMENT_FRACTION;
  const gap = perimeter - segment;

  // Two highlights, half a lap apart
  const offsetA = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -perimeter] });
  const offsetB = progress.interpolate({ inputRange: [0, 1], outputRange: [-perimeter / 2, -perimeter * 1.5] });

  // Light mode: navy and school blue. Dark mode: white and school blue.
  const colorA = isDark ? colors.textPrimary : colors.brandStrong;
  const colorB = colors.brand;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width: W, height: H } = e.nativeEvent.layout;
        if (W !== size.width || H !== size.height) setSize({ width: W, height: H });
      }}
    >
      {width > 0 && height > 0 && (
        <Svg width={width} height={height}>
          <Rect
            x={STROKE / 2} y={STROKE / 2} width={w} height={h}
            rx={RADIUS} ry={RADIUS} fill="none"
            stroke={colors.border} strokeWidth={STROKE}
          />
          <AnimatedRect
            x={STROKE / 2} y={STROKE / 2} width={w} height={h}
            rx={RADIUS} ry={RADIUS} fill="none"
            stroke={colorA} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={`${segment} ${gap}`} strokeDashoffset={offsetA}
          />
          <AnimatedRect
            x={STROKE / 2} y={STROKE / 2} width={w} height={h}
            rx={RADIUS} ry={RADIUS} fill="none"
            stroke={colorB} strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={`${segment} ${gap}`} strokeDashoffset={offsetB}
          />
        </Svg>
      )}
    </View>
  );
}
