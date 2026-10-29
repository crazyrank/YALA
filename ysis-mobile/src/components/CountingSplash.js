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
const BAR = 'rgba(255,255,255,0.14)';
const TOTAL_MS = 3200;

const CARD_W = 150;
const CARD_H = 132;
const CARD_RADIUS = 13;
const LOGO_W = 131;
const LOGO_H = 113;

// One pulsing placeholder line. Kept local so the splash never depends on the app theme.
function SkeletonBar({ width, delay = 0 }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, delay]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  return <Animated.View style={[styles.bar, { width, opacity }]} />;
}

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

  // One centred column: logo, name, then progress. No absolute positioning, so the
  // logo always stays with the title and the counter on every screen size.
  return (
    <View style={styles.root} onLayout={onLayout}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <View style={styles.content}>
        <View style={styles.card}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>

        <Animated.View style={[styles.brandBlock, { opacity: reveal }]}>
          <View style={styles.hairline} />
          <Text style={styles.brand}>YSIS</Text>
          <Text style={styles.sub}>STUDENT INFORMATION SYSTEM</Text>
        </Animated.View>

        <Animated.View style={[styles.loadBlock, { opacity: reveal }]}>
          <Text style={styles.count}>{count}</Text>
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: fillWidth }]} />
          </View>
          <ActivityIndicator size="small" color={GOLD} style={styles.spinner} />
          <View style={styles.skeleton}>
            <SkeletonBar width={150} />
            <SkeletonBar width={110} delay={150} />
            <SkeletonBar width={130} delay={300} />
          </View>
        </Animated.View>
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
    alignItems: 'center',
    marginTop: 22,
  },
  hairline: {
    width: 28,
    height: 1,
    backgroundColor: GOLD,
    marginBottom: 16,
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
  loadBlock: {
    alignItems: 'center',
    marginTop: 44,
  },
  count: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  track: {
    width: 120,
    height: 1,
    backgroundColor: TRACK,
    marginTop: 10,
    overflow: 'hidden',
  },
  fill: { height: 1, backgroundColor: GOLD },
  spinner: { marginTop: 16 },
  message: {
    color: MUTED,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  skeleton: { marginTop: 14, alignItems: 'center' },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: BAR,
    marginTop: 8,
  },
});
