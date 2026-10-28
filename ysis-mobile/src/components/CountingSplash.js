import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';

const LOGO = require('../../assets/yala-matrix-schools-logo.jpg');

const BG = '#0E1A2B';
const ACCENT = '#2FA37A';
const TEXT = '#F4F1EA';
const MUTED = '#9FB0C8';
const TOTAL_MS = 3200;

export default function CountingSplash({ onDone, onLayout }) {
  const [count, setCount] = useState(1);
  const reveal = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    // Warm up the speech engine so the onboarding voice starts on time.
    try {
      Speech.getAvailableVoicesAsync().catch(() => {});
    } catch {}

    Animated.timing(reveal, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: TOTAL_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    let n = 1;
    let finishTimer;
    const timer = setInterval(() => {
      n += 1;
      setCount(n);
      if (n >= 100) {
        clearInterval(timer);
        finishTimer = setTimeout(() => {
          if (doneRef.current) doneRef.current();
        }, 500);
      }
    }, TOTAL_MS / 100);

    return () => {
      clearInterval(timer);
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, []);

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Animated.View style={[styles.inner, { opacity: reveal }]}>
        <View style={styles.logoPlate}>
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
        </View>

        <Text style={styles.brand}>YSIS</Text>
        <Text style={styles.sub}>STUDENT INFORMATION SYSTEM</Text>

        <View style={styles.progressBlock}>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: fillWidth }]} />
          </View>
          <Text style={styles.count}>{count}</Text>
          <ActivityIndicator size="small" color={ACCENT} style={styles.spinner} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoPlate: {
    width: 128,
    height: 128,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  logoImage: { width: '100%', height: '100%' },
  brand: {
    fontFamily: 'serif',
    color: TEXT,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 8,
  },
  sub: { color: MUTED, fontSize: 10, letterSpacing: 3, marginTop: 8 },
  progressBlock: {
    position: 'absolute',
    bottom: 70,
    width: '60%',
    alignItems: 'center',
  },
  track: {
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: '#3A3733',
    overflow: 'hidden',
  },
  fill: { height: 2, backgroundColor: ACCENT },
  count: {
    color: MUTED,
    fontSize: 14,
    letterSpacing: 2,
    marginTop: 14,
    fontVariant: ['tabular-nums'],
  },
  spinner: { marginTop: 14 },
});
