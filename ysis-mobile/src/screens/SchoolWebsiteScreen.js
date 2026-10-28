import React, { useMemo, useRef, useState } from 'react';
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
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';

const SCHOOL_URL = 'https://www.yalamatrixschools.org';
const ALLOWED_HOST = 'www.yalamatrixschools.org';

function isAllowedUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === ALLOWED_HOST ||
        parsed.hostname === 'yalamatrixschools.org')
    );
  } catch {
    return false;
  }
}

export default function SchoolWebsiteScreen({ navigation }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(colors, insets),
    [colors, insets],
  );
  const webRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const openInBrowser = () => Linking.openURL(SCHOOL_URL);

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
            Yalamatrix Schools
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Official School Website
          </Text>
        </View>

        <View style={styles.headerRight}>
          {canGoBack && (
            <Pressable
              onPress={() => webRef.current?.goBack()}
              hitSlop={10}
              style={styles.headerBtn}
              accessibilityLabel="Website back"
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={colors.textInverse}
              />
            </Pressable>
          )}
          <Pressable
            onPress={openInBrowser}
            hitSlop={10}
            style={styles.headerBtn}
            accessibilityLabel="Open website in browser"
          >
            <Ionicons
              name="open-outline"
              size={21}
              color={colors.textInverse}
            />
          </Pressable>
        </View>
      </View>

      {loading && !error && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.goldDark} />
          <Text style={styles.loadingText}>Loading school website…</Text>
        </View>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons
            name="cloud-offline-outline"
            size={42}
            color={colors.textMuted}
          />
          <Text style={styles.errorTitle}>Website unavailable</Text>
          <Text style={styles.errorBody}>
            Check your internet connection and try again.
          </Text>
          <Pressable
            onPress={() => {
              setError(false);
              setLoading(true);
              webRef.current?.reload();
            }}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
          <Pressable onPress={openInBrowser} style={styles.browserBtn}>
            <Text style={styles.retryText}>Open in browser</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: SCHOOL_URL }}
          style={styles.webview}
          originWhitelist={['https://*']}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          setSupportMultipleWindows={false}
          onLoadStart={() => {
            setLoading(true);
            setError(false);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 400) {
              setLoading(false);
              setError(true);
            }
          }}
          onNavigationStateChange={(state) => {
            setCanGoBack(state.canGoBack);
          }}
          onShouldStartLoadWithRequest={(request) => {
            if (isAllowedUrl(request.url)) return true;

            if (
              request.url.startsWith('https://') ||
              request.url.startsWith('http://')
            ) {
              Linking.openURL(request.url).catch(() => {});
            }
            return false;
          }}
          allowsBackForwardNavigationGestures
        />
      )}
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
      minHeight: 62,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inkSoft,
    },
    headerBtn: {
      width: 38,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitleWrap: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    headerTitle: {
      color: colors.textInverse,
      fontFamily: fontFamily.heading,
      fontSize: 16,
    },
    headerSubtitle: {
      color: colors.textInverse,
      opacity: 0.8,
      fontSize: 12,
      marginTop: 2,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    webview: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    loadingText: {
      color: colors.textPrimary,
      marginTop: spacing.md,
      fontFamily: fontFamily.body,
    },
    errorBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    errorTitle: {
      color: colors.textPrimary,
      fontFamily: fontFamily.heading,
      fontSize: 18,
      marginTop: spacing.md,
    },
    errorBody: {
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    retryBtn: {
      marginTop: spacing.lg,
      backgroundColor: colors.inkSoft,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: 10,
    },
    browserBtn: {
      marginTop: spacing.sm,
      padding: spacing.md,
    },
    retryText: {
      color: colors.textInverse,
      fontFamily: fontFamily.heading,
    },
  });
}
