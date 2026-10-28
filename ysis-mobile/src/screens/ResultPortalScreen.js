import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';

const RESULTS_URL =
  'https://yalav1.yalamatrixschools.com/dapp/view-student-results.php';

const ALLOWED_HOST = 'yalav1.yalamatrixschools.com';

const ALLOWED_ROLES = new Set(['director', 'principal', 'head_teacher']);

export function canAccessResultPortal(role) {
  return ALLOWED_ROLES.has(role);
}

function isAllowedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return (
      parsed.hostname === ALLOWED_HOST ||
      parsed.hostname.endsWith('.' + ALLOWED_HOST)
    );
  } catch {
    return false;
  }
}

export default function ResultPortalScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);
  const webRef = useRef(null);

  const allowed = canAccessResultPortal(user?.role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);

  const onShouldStartLoadWithRequest = useCallback((request) => {
    const url = request.url || '';
    if (url === 'about:blank') return true;
    if (isAllowedUrl(url)) return true;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      Linking.openURL(url).catch(() => {});
    }
    return false;
  }, []);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    webRef.current?.reload();
  };

  const openInBrowser = () => {
    Linking.openURL(RESULTS_URL).catch(() => {});
  };

  if (!allowed) {
    return (
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textInverse} />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Check Student Results</Text>
          </View>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.deniedBox}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.textMuted} />
          <Text style={styles.deniedTitle}>Access restricted</Text>
          <Text style={styles.deniedBody}>
            Only the Director, Principal, and Head Teachers can open the Check Student Results.
          </Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textInverse} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Check Student Results
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Access student results through the external results system
          </Text>
        </View>

        <View style={styles.headerRight}>
          {canGoBack && (
            <Pressable
              onPress={() => webRef.current?.goBack()}
              hitSlop={10}
              style={styles.headerBtn}
              accessibilityLabel="Page back"
            >
              <Ionicons name="chevron-back" size={22} color={colors.textInverse} />
            </Pressable>
          )}
          <Pressable
            onPress={openInBrowser}
            hitSlop={10}
            style={styles.headerBtn}
            accessibilityLabel="Open in browser"
          >
            <Ionicons name="open-outline" size={20} color={colors.textInverse} />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
            <Text style={styles.errorTitle}>Could not load the portal</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable onPress={handleRetry} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
            <Pressable onPress={openInBrowser} style={styles.linkBtn}>
              <Text style={styles.linkText}>Open in browser instead</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={webRef}
            source={{ uri: RESULTS_URL }}
            style={styles.webview}
            onLoadStart={() => {
              setLoading(true);
              setError(null);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              setLoading(false);
              setError(
                e?.nativeEvent?.description ||
                  'Network error while opening the results portal.'
              );
            }}
            onHttpError={(e) => {
              const code = e?.nativeEvent?.statusCode;
              if (code >= 400) {
                setLoading(false);
                setError(`The portal returned an error (${code}).`);
              }
            }}
            onNavigationStateChange={(nav) => {
              setCanGoBack(!!nav.canGoBack);
            }}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            originWhitelist={['https://*']}
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled={false}
            sharedCookiesEnabled={false}
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            mixedContentMode="never"
            geolocationEnabled={false}
            startInLoadingState
          />
        )}

        {loading && !error && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.gold} />
            <Text style={styles.loadingText}>Loading results portal…</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function createStyles(colors, insets) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: insets.top,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.ink,
      paddingHorizontal: spacing.sm,
      paddingVertical: 12,
      gap: 4,
    },
    headerBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitleWrap: {
      flex: 1,
      paddingHorizontal: 4,
    },
    headerTitle: {
      fontFamily: fontFamily.heading,
      fontSize: 17,
      color: colors.textInverse,
    },
    headerSubtitle: {
      fontFamily: fontFamily.body,
      fontSize: 11,
      color: 'rgba(255,255,255,0.65)',
      marginTop: 1,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    body: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    webview: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      gap: 12,
    },
    loadingText: {
      fontFamily: fontFamily.body,
      fontSize: 13,
      color: colors.textSecondary,
    },
    errorBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 8,
    },
    errorTitle: {
      fontFamily: fontFamily.heading,
      fontSize: 16,
      color: colors.textPrimary,
      marginTop: 8,
    },
    errorBody: {
      fontFamily: fontFamily.body,
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 12,
    },
    deniedBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 10,
    },
    deniedTitle: {
      fontFamily: fontFamily.heading,
      fontSize: 18,
      color: colors.textPrimary,
      marginTop: 8,
    },
    deniedBody: {
      fontFamily: fontFamily.body,
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 12,
    },
    retryBtn: {
      backgroundColor: colors.ink,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 10,
      marginTop: 4,
    },
    retryText: {
      fontFamily: fontFamily.bodySemibold,
      color: colors.textInverse,
      fontSize: 14,
    },
    linkBtn: {
      paddingVertical: 12,
      marginTop: 4,
    },
    linkText: {
      fontFamily: fontFamily.body,
      color: colors.goldDark,
      fontSize: 13,
    },
  });
}
