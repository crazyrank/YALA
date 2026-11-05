import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StatusBar, StyleSheet, Text, View } from 'react-native';

const LOGO = require('../../assets/yala-matrix-schools-logo.jpg');

// Same size as the logo on the native splash, so the two screens line up.
const LOGO_W = 220;
const LOGO_H = 191;
const BG = '#FFFFFF';
const TRACK_COLOR = '#E6E8EC';
const FILL_COLOR = '#1C2D46';
const TEXT_COLOR = '#1C2D46';
const TOTAL_MS = 3200;

/**
 * Launch loader: school logo, a straight line that fills, and the count 1 to 100.
 * When the count reaches 100 and the app is ready, onDone is called.
 */
export default function CountingSplash({ ready = false, onDone, onLayout }) {
  const [count, setCount] = useState(1);
  const [counted, setCounted] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: TOTAL_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    let n = 1;
    const timer = setInterval(() => {
      n += 1;
      setCount(n);
      if (n >= 100) {
        clearInterval(timer);
        setCounted(true);
      }
    }, TOTAL_MS / 100);

    return () => clearInterval(timer);
  }, [progress]);

  useEffect(() => {
    if (!counted || !ready) return undefined;
    const t = setTimeout(() => {
      if (doneRef.current) doneRef.current();
    }, 300);
    return () => clearTimeout(t);
  }, [counted, ready]);

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <View style={styles.content}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: fillWidth }]} />
        </View>
        <Text style={styles.count}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logo: { width: LOGO_W, height: LOGO_H },
  track: {
    width: LOGO_W,
    height: 2,
    backgroundColor: TRACK_COLOR,
    marginTop: 28,
    overflow: 'hidden',
  },
  fill: { height: 2, backgroundColor: FILL_COLOR },
  count: {
    color: TEXT_COLOR,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    fontVariant: ['tabular-nums'],
  },
});
