import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { hasPendingChanges, onSyncStatusChange } from '../services/syncEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MESSAGE = 'You have unsynced changes — connect to Wi-Fi or data when you can to save them.';

/**
 * Passive, generic, scrolling reminder — locked decision (Build Spec
 * Section 17): no live pending-operation count (avoids re-querying the
 * sync queue on every render), not a blocking banner, easy to ignore
 * mid-task but impossible to fully miss over a few days offline.
 */
export default function OfflineMarquee() {
  const [visible, setVisible] = useState(false);
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const pending = await hasPendingChanges();
      if (mounted) setVisible(pending);
    };
    check();

    const unsubscribe = onSyncStatusChange((s) => {
      if (s.state === 'idle') check();
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const animate = () => {
      translateX.setValue(SCREEN_WIDTH);
      Animated.timing(translateX, {
        toValue: -SCREEN_WIDTH * 2,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) animate();
      });
    };
    animate();
    return () => translateX.stopAnimation();
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Animated.Text style={[styles.text, { transform: [{ translateX }] }]}>
        {MESSAGE}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 26,
    backgroundColor: '#f4ead0',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    fontSize: 11.5,
    color: '#8a6a1f',
    fontWeight: '500',
    width: SCREEN_WIDTH * 2,
  },
});
