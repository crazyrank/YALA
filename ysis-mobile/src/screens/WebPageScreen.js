import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Linking,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';

/**
 * One reusable web page screen. Open any page from a stack with:
 *
 *   navigation.navigate('WebPage', {
 *     title: 'Page title',
 *     subtitle: 'Optional line under the title',
 *     url: 'https://example.school.com/page',
 *     allowedHosts: ['example.school.com'],
 *   });
 *
 * Only https pages on allowedHosts (and their subdomains) open inside the app.
 * Any other link opens in the phone browser.
 */

export function isAllowedUrl(url, allowedHosts) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return allowedHosts.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith('.' + host)
    );
  } catch {
    return false;
  }
}

function SkeletonLine({ width, delay = 0, color }) {
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
  return (
    <Animated.View
      style={{
        width,
        height: 10,
        borderRadius: 5,
        marginTop: 10,
        backgroundColor: color,
        opacity,
      }}
    />
  );
}

export default function WebPageScreen({ navigation, route }) {
  const params = route?.params || {};
  const title = params.title || 'Web page';
  const subtitle = params.subtitle || '';
  const url = params.url || '';
  const allowedHosts = Array.isArray(params.allowedHosts) ? params.allowedHosts : [];
  const accessDenied = !!params.accessDenied;
  const deniedMessage = params.deniedMessage || 'This page is not available.';

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);
  const webRef = useRef(null);

  const validUrl = !accessDenied && isAllowedUrl(url, allowedHosts);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);

  const openInBrowser = () => {
    if (url.startsWith('https://')) Linking.openURL(url).catch(() => {});
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
  };

  const onShouldStartLoadWithRequest = (request) => {
    const next = request.url || '';
    if (next === 'about:blank') return true;
    if (isAllowedUrl(next, allowedHosts)) return true;
    if (next.startsWith('http://') || next.startsWith('https://')) {
      Linking.openURL(next).catch(() => {});
    }
    return false;
  };

  let body;
  if (accessDenied) {
    body = (
      <View style={styles.message}>
        <Ionicons name="lock-closed-outline" size={40} color={colors.textMuted} />
        <Text style={styles.messageTitle}>Access restricted</Text>
        <Text style={styles.messageText}>{deniedMessage}</Text>
        <Pressable onPress={() => navigation.goBack()} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  } else if (!validUrl) {
    body = (
      <View style={styles.message}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
        <Text style={styles.messageTitle}>Page unavailable</Text>
        <Text style={styles.messageText}>This page address is not valid.</Text>
      </View>
    );
  } else if (error) {
    body = (
      <View style={styles.message}>
        <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
        <Text style={styles.messageTitle}>Could not load the page</Text>
        <Text style={styles.messageText}>{error}</Text>
        <Pressable onPress={handleRetry} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Try again</Text>
        </Pressable>
        <Pressable onPress={openInBrowser} style={styles.linkBtn}>
          <Text style={styles.linkText}>Open in browser instead</Text>
        </Pressable>
      </View>
    );
  } else {
    body = (
      <>
        <WebView
          ref={webRef}
          source={{ uri: url }}
          style={styles.webview}
          originWhitelist={['https://*', 'about:blank']}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled={false}
          sharedCookiesEnabled={false}
          allowFileAccess={false}
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          startInLoadingState={false}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onLoadStart={() => {
            setLoading(true);
            setError(null);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={(e) => {
            setLoading(false);
            setError(e?.nativeEvent?.description || 'Network error while opening the page.');
          }}
          onHttpError={(e) => {
            const code = e?.nativeEvent?.statusCode;
            if (code >= 400) {
              setLoading(false);
              setError(`The page returned an error (${code}).`);
            }
          }}
          onNavigationStateChange={(nav) => setCanGoBack(!!nav.canGoBack)}
        />
        {loading && (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.goldDark} />
            <View style={styles.skeleton}>
              <SkeletonLine width={180} color={colors.border} />
              <SkeletonLine width={130} delay={150} color={colors.border} />
              <SkeletonLine width={160} delay={300} color={colors.border} />
            </View>
            <Text style={styles.loadingText}>Please wait while your request is processed</Text>
          </View>
        )}
      </>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textInverse} />
          </Pressable>

          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {!!subtitle && (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>

          <View style={styles.headerRight}>
            {validUrl && canGoBack && (
              <Pressable
                onPress={() => webRef.current?.goBack()}
                hitSlop={10}
                style={styles.headerBtn}
                accessibilityLabel="Page back"
              >
                <Ionicons name="chevron-back" size={22} color={colors.textInverse} />
              </Pressable>
            )}
            {validUrl && (
              <Pressable
                onPress={openInBrowser}
                hitSlop={10}
                style={styles.headerBtn}
                accessibilityLabel="Open in browser"
              >
                <Ionicons name="open-outline" size={20} color={colors.textInverse} />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      <View style={styles.body}>{body}</View>
    </View>
  );
}

function createStyles(colors, insets) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingBottom: insets.bottom,
    },
    header: {
      backgroundColor: colors.inkSoft,
      paddingTop: insets.top,
    },
    headerRow: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
    },
    headerBtn: {
      width: 38,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleWrap: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    title: {
      color: colors.textInverse,
      fontFamily: fontFamily.heading,
      fontSize: 16,
    },
    subtitle: {
      color: colors.textInverse,
      opacity: 0.8,
      fontSize: 12,
      marginTop: 2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    body: {
      flex: 1,
    },
    webview: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loading: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    skeleton: {
      alignItems: 'center',
      marginTop: spacing.md,
    },
    loadingText: {
      color: colors.textSecondary,
      marginTop: spacing.md,
      fontFamily: fontFamily.body,
      fontSize: 13,
    },
    message: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    messageTitle: {
      color: colors.textPrimary,
      fontFamily: fontFamily.heading,
      fontSize: 18,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    messageText: {
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    primaryBtn: {
      marginTop: spacing.lg,
      backgroundColor: colors.inkSoft,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: 10,
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontFamily: fontFamily.heading,
    },
    linkBtn: {
      marginTop: spacing.sm,
      padding: spacing.md,
    },
    linkText: {
      color: colors.textPrimary,
      fontFamily: fontFamily.heading,
    },
  });
}
