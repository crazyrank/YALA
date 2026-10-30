import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Linking,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { confirmIdentity } from '../services/portalAccess';

/**
 * One reusable web page screen. Open any page from a stack with:
 *
 *   navigation.navigate('WebPage', {
 *     title: 'Page title',
 *     subtitle: 'Optional line under the title',
 *     url: 'https://example.school.com/page',
 *     allowedHosts: ['example.school.com'],
 *     credentialsKey: 'optional-key-for-saved-login',
 *     autoLogin: false,
 *   });
 *
 * Only https pages on allowedHosts (and their subdomains) open inside the app.
 * Any other link opens in the phone browser.
 *
 * With credentialsKey set, a login the person submits can be saved on this phone
 * (encrypted with SecureStore). With autoLogin also set, the saved login is filled
 * in and sent automatically, at most once per visit to the screen.
 */

// Finds the password field, and the username field in the same form.
const FIND_FIELDS =
  "(function(){var p=document.querySelector('input[type=password]');if(!p)return null;" +
  "var s=p.form||document;" +
  "var u=s.querySelector('input[type=email],input[type=text],input:not([type])');" +
  "return {u:u,p:p};})()";

// Reports a login the person submits by hand, so it can be offered for saving.
const CAPTURE_SCRIPT = `(function(){
  if (window.__ysisCapture) return true;
  window.__ysisCapture = true;
  function send() {
    var f = ${FIND_FIELDS};
    if (!f || !f.u || !f.u.value || !f.p.value) return;
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'login', u: f.u.value, p: f.p.value })
    );
  }
  document.addEventListener('submit', send, true);
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('button[type=submit], input[type=submit]')) send();
  }, true);
  return true;
})();`;

// Fills empty fields with the saved login. When submit is true it also sends the form.
function fillScript(creds, submit) {
  return `(function(){
    var f = ${FIND_FIELDS};
    var found = !!(f && f.u && f.p);
    if (found) {
      var c = ${JSON.stringify(creds)};
      var setVal = function (el, v) {
        if (el.value) return;
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setVal(f.u, c.u);
      setVal(f.p, c.p);
      if (${JSON.stringify(!!submit)}) {
        var form = f.p.form;
        var btn = form && form.querySelector('button[type=submit], input[type=submit]');
        if (btn) btn.click();
        else if (form && form.requestSubmit) form.requestSubmit();
        else if (form) form.submit();
      }
    }
    window.scrollTo(0, 0);
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'autofill', found: found }));
    return true;
  })();`;
}

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
  const credentialsKey = params.credentialsKey || null;
  const autoLogin = !!params.autoLogin;
  const onAutoLogin = typeof params.onAutoLogin === 'function' ? params.onAutoLogin : null;

  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);
  const webRef = useRef(null);

  const validUrl = !accessDenied && isAllowedUrl(url, allowedHosts);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [credsLoaded, setCredsLoaded] = useState(!credentialsKey);

  const credsRef = useRef(null);
  const askingRef = useRef(false);
  const autoAttemptsRef = useRef(0);

  // Read the saved login before the page loads, so auto-login has it ready.
  useEffect(() => {
    if (!credentialsKey) {
      setCredsLoaded(true);
      return;
    }
    SecureStore.getItemAsync(credentialsKey)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.u && parsed.p) {
          credsRef.current = parsed;
          setHasSaved(true);
        }
      })
      .catch(() => {})
      .finally(() => setCredsLoaded(true));
  }, [credentialsKey]);

  const runAutoLogin = async () => {
    if (!autoLogin || !credentialsKey || !credsRef.current || !webRef.current) return;
    // One attempt per visit. A failed check or wrong password never causes repeat attempts.
    if (autoAttemptsRef.current >= 1) return;
    autoAttemptsRef.current += 1;

    // The saved login is sent only after the person confirms with fingerprint, face or PIN.
    const confirmed = await confirmIdentity('Confirm it is you to open the results');
    if (!confirmed) return;

    if (onAutoLogin) onAutoLogin();
    webRef.current?.injectJavaScript(fillScript(credsRef.current, true));
  };

  const onMessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (!data) return;

    if (data.type === 'autofill') {
      // No login form on this page, so the next login page may try again.
      if (!data.found) autoAttemptsRef.current = 0;
      return;
    }

    if (!credentialsKey || askingRef.current) return;
    if (data.type !== 'login' || !data.u || !data.p) return;

    const u = String(data.u).slice(0, 200);
    const p = String(data.p).slice(0, 200);
    const current = credsRef.current;
    if (current && current.u === u && current.p === p) return;

    askingRef.current = true;
    Alert.alert(
      'Save this login?',
      'It is stored on this phone only. Next time it is filled in and sent automatically.',
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => {
            askingRef.current = false;
          },
        },
        {
          text: 'Save',
          onPress: async () => {
            askingRef.current = false;
            try {
              await SecureStore.setItemAsync(credentialsKey, JSON.stringify({ u, p }));
              credsRef.current = { u, p };
              setHasSaved(true);
            } catch {
              Alert.alert('Could not save', 'The login could not be saved on this phone.');
            }
          },
        },
      ]
    );
  };

  const forgetLogin = () => {
    Alert.alert(
      'Forget saved login?',
      'The next login will need the username and password typed again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync(credentialsKey).catch(() => {});
            credsRef.current = null;
            setHasSaved(false);
          },
        },
      ]
    );
  };

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
        {credsLoaded && (
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
            onMessage={onMessage}
            onLoadStart={() => {
              setLoading(true);
              setError(null);
            }}
            onLoadEnd={() => {
              setLoading(false);
              if (credentialsKey) {
                webRef.current?.injectJavaScript(CAPTURE_SCRIPT);
                runAutoLogin();
              }
            }}
            onLoadProgress={({ nativeEvent }) => {
              if (nativeEvent?.progress >= 0.9) setLoading(false);
            }}
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
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
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
            {validUrl && hasSaved && (
              <Pressable
                onPress={forgetLogin}
                hitSlop={10}
                style={styles.headerBtn}
                accessibilityLabel="Forget saved login"
              >
                <Ionicons name="key-outline" size={20} color={colors.textPrimary} />
              </Pressable>
            )}
            {validUrl && canGoBack && (
              <Pressable
                onPress={() => webRef.current?.goBack()}
                hitSlop={10}
                style={styles.headerBtn}
                accessibilityLabel="Page back"
              >
                <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
              </Pressable>
            )}
            {validUrl && (
              <Pressable
                onPress={openInBrowser}
                hitSlop={10}
                style={styles.headerBtn}
                accessibilityLabel="Open in browser"
              >
                <Ionicons name="open-outline" size={20} color={colors.textPrimary} />
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
      backgroundColor: colors.background,
      paddingTop: insets.top + 6,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 14,
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
      color: colors.textPrimary,
      fontFamily: fontFamily.display,
      fontSize: 28,
      letterSpacing: -0.6,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
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
      top: 0,
      bottom: 0,
      zIndex: 2,
      elevation: 2,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.background,
    },
    skeleton: {
      alignItems: 'center',
      marginTop: spacing.md,
    },
    loadingText: {
      textAlign: 'center',
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
