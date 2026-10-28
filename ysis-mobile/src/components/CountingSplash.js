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
const GOLD = '#C9A24B';
const TEXT = '#F4F1EA';
const MUTED = '#8FA0BA';
const TRACK = 'rgba(255,255,255,0.12)';
const TOTAL_MS = 3200;

// Same size and position as the native splash logo, so the hand-off is seamless.
const CARD_W = 150;
const CARD_H = 132;
const CARD_RADIUS = 13;
const LOGO_W = 131;
const LOGO_H = 113;

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
      duration: 700,
      easing: Easing.out(Easing.cubic),
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

      {/* Logo sits at the exact centre, shown instantly. */}
      <View style={styles.center} pointerEvents="none">
        <View style={styles.card}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>
      </View>

      {/* Brand text sits just below the logo. */}
      <Animated.View style={[styles.brandBlock, { opacity: reveal }]}>
        <View style={styles.hairline} />
        <Text style={styles.brand}>YSIS</Text>
        <Text style={styles.sub}>STUDENT INFORMATION SYSTEM</Text>
      </Animated.View>

      {/* Counter and spinner at the bottom. */}
      <Animated.View style={[styles.bottom, { opacity: reveal }]}>
        <Text style={styles.count}>{count}</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, { width: fillWidth }]} />
        </View>
        <ActivityIndicator size="small" color={GOLD} style={styles.spinner} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: LOGO_W, height: LOGO_H },
  brandBlock: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: CARD_H / 2 + 36,
    alignItems: 'center',
  },
  hairline: {
    width: 28,
    height: 1,
    backgroundColor: GOLD,
    marginBottom: 20,
  },
  brand: {
    fontFamily: 'serif',
    color: TEXT,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: 10,
    paddingLeft: 10,
  },
  sub: {
    color: MUTED,
    fontSize: 9,
    letterSpacing: 4,
    marginTop: 10,
    paddingLeft: 4,
  },
  bottom: {
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  count: {
    color: TEXT,
    fontSize: 34,
    fontWeight: '200',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  track: {
    width: 120,
    height: 1,
    backgroundColor: TRACK,
    marginTop: 14,
    overflow: 'hidden',
  },
  fill: { height: 1, backgroundColor: GOLD },
  spinner: { marginTop: 18 },
});
