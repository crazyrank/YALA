import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert, Animated, Easing, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { confirmIdentity } from '../services/portalAccess';

const SCHOOL_LOGO = require('../../assets/yala-matrix-schools-logo.jpg');

// If the page has not shown anything after this long, stop and offer a retry.
const LOAD_TIMEOUT_MS = 20000;

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
  const [attempt, setAttempt] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [credsLoaded, setCredsLoaded] = useState(!credentialsKey);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const credsRef = useRef(null);
  const askingRef = useRef(false);
  const autoAttemptsRef = useRef(0);
  const contentShownRef = useRef(false);

  // Show loader until we decide the page is ready
  const showLoader = validUrl && !error && (loading || !credsLoaded || loaderVisible);

  // The logo ring: a gold arc (top and right edges) that spins around the logo.
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!showLoader) return undefined;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin, showLoader]);

  const spinStyle = {
    transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
  };

  // Fade animation for the loader
  const fade = useRef(new Animated.Value(1)).current;

  const hideLoader = () => {
    if (contentShownRef.current) return;
    contentShownRef.current = true;
    setLoading(false);

    Animated.timing(fade, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setLoaderVisible(false);
    });
  };

  // If nothing shows within the time limit, stop and offer a retry.
  useEffect(() => {
    if (!showLoader) return undefined;
    const timer = setTimeout(() => {
      setLoading(false);
      setLoaderVisible(false);
      setError('The school website took too long to respond. Check your internet connection and try again.');
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [showLoader, attempt]);

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
    contentShownRef.current = false;
    setError(null);
    setLoading(true);
    setLoaderVisible(true);
    fade.setValue(1);
    setAttempt((n) => n + 1);
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
    body = credsLoaded ? (
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
          contentShownRef.current = false;
          setLoaderVisible(true);
          fade.setValue(1);
          setLoading(true);
        }}
        onLoadProgress={({ nativeEvent }) => {
          // Only hide after significant progress
          if (nativeEvent?.progress >= 0.85) {
            setTimeout(hideLoader, 150);
          }
        }}
        onLoadEnd={() => {
          // Always hide on load end (safety net)
          setTimeout(hideLoader, 200);

          if (credentialsKey) {
            webRef.current?.injectJavaScript(CAPTURE_SCRIPT);
            runAutoLogin();
          }
        }}
        onError={(e) => {
          setLoading(false);
          setLoaderVisible(false);
          setError(e?.nativeEvent?.description || 'Network error while opening the page.');
        }}
        onHttpError={(e) => {
          const code = e?.nativeEvent?.statusCode;
          if (code >= 400) {
            setLoading(false);
            setLoaderVisible(false);
            setError(`The page returned an error (${code}).`);
          }
        }}
        onNavigationStateChange={(nav) => setCanGoBack(!!nav.canGoBack)}
      />
    ) : null;
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

      {/* Body + Loader overlay (loader is a true overlay, never a sibling of WebView) */}
      <View style={styles.body}>
        {body}

        {showLoader && (
          <Animated.View
            style={[styles.loader, { opacity: fade }]}
            pointerEvents="none"
            accessibilityLabel="Loading school website"
          >
            <View style={styles.logoWrap}>
              <Image source={SCHOOL_LOGO} style={styles.logo} />
              <Animated.View
                style={[
                  styles.ring,
                  { borderTopColor: colors.gold, borderRightColor: colors.gold },
                  spinStyle,
                ]}
              />
            </View>
            <Text style={styles.loadingText}>Loading...</Text>
          </Animated.View>
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
      position: 'relative',
      overflow: 'hidden',
    },
    webview: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 20,
      elevation: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    logoWrap: {
      width: 110,
      height: 110,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      width: 88,
      height: 88,
      resizeMode: 'contain',
    },
    ring: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 110,
      height: 110,
      borderRadius: 55,
      borderWidth: 2.5,
      borderColor: 'transparent',
    },
    loadingText: {
      marginTop: 16,
      color: colors.textMuted,
      fontFamily: fontFamily.body,
      fontSize: 13,
      letterSpacing: 0.4,
    },
    message: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    messageTitle: {
      marginTop: 12,
      fontFamily: fontFamily.heading,
      fontSize: 18,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    messageText: {
      marginTop: 8,
      fontFamily: fontFamily.body,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    primaryBtn: {
      marginTop: 20,
      backgroundColor: colors.gold,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    primaryBtnText: {
      color: colors.ink,
      fontFamily: fontFamily.bodyBold,
      fontSize: 14,
    },
    linkBtn: {
      marginTop: 14,
      padding: 8,
    },
    linkText: {
      color: colors.textSecondary,
      fontFamily: fontFamily.bodySemibold,
      fontSize: 13,
      textDecorationLine: 'underline',
    },
  });
}
