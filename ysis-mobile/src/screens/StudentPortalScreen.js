import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, BackHandler } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../theme/ThemeContext';
import { YALAPREP_STUDENT_LOGIN_URL, YALAPREP_QUIZ_URL } from '../config/links';
import { saveStudentLogin, getStudentSession, isSessionFresh } from '../lib/studentSession';

const ALLOWED = /^https:\/\/yalaprep\.netlify\.app(\/|$|\?|#)/i;
const QUIZ_PAGE = /^https:\/\/yalaprep\.netlify\.app\/student(\/|$|\?|#)/;

const LOCK_DOWN_JS = `
(function () {
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); }, true);
  true;
})();
`;

export default function StudentPortalScreen({ navigation }) {
  const { colors } = useTheme();
  const webRef = useRef(null);
  const canGoBackRef = useRef(false);
  const savedRef = useRef(false);
  const [startUrl, setStartUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    getStudentSession()
      .then((s) => {
        if (alive) setStartUrl(isSessionFresh(s) ? YALAPREP_QUIZ_URL : YALAPREP_STUDENT_LOGIN_URL);
      })
      .catch(() => {
        if (alive) setStartUrl(YALAPREP_STUDENT_LOGIN_URL);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const onNavChange = (nav) => {
    canGoBackRef.current = !!nav.canGoBack;
    if (!nav.loading && !savedRef.current && QUIZ_PAGE.test(nav.url || '')) {
      savedRef.current = true;
      saveStudentLogin().catch(() => {});
    }
  };

  const retry = () => {
    setError('');
    setLoading(true);
    setAttempt((n) => n + 1);
  };

  let body;
  if (!startUrl) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  } else if (error) {
    body = (
      <View style={styles.center}>
        <Text style={[styles.text, { color: colors.textPrimary }]}>{error}</Text>
        <Pressable onPress={retry} style={[styles.retry, { borderColor: colors.brand }]}>
          <Text style={{ color: colors.brand, fontWeight: '600' }}>Try again</Text>
        </Pressable>
      </View>
    );
  } else {
    body = (
      <View style={styles.flex}>
        <WebView
          key={attempt}
          ref={webRef}
          source={{ uri: startUrl }}
          originWhitelist={['https://*', 'about:blank']}
          onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || ALLOWED.test(r.url)}
          onNavigationStateChange={onNavChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => setError('Could not load the page. Check your connection and try again.')}
          setSupportMultipleWindows={false}
          allowsLinkPreview={false}
          allowFileAccess={false}
          injectedJavaScriptBeforeContentLoaded={LOCK_DOWN_JS}
          thirdPartyCookiesEnabled={true}
          domStorageEnabled={true}
          javaScriptEnabled={true}
          mixedContentMode="never"
        />
        {loading ? (
          <View style={[styles.overlay, { backgroundColor: colors.background }]} pointerEvents="none">
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.bar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={[styles.back, { color: colors.textPrimary }]}>{'\u2190'} Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>SS3 quiz portal</Text>
        <View style={styles.spacer} />
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { fontSize: 15, textAlign: 'center', marginBottom: 16 },
  retry: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  back: { fontSize: 15, fontWeight: '600', minWidth: 70 },
  title: { fontSize: 16, fontWeight: '700' },
  spacer: { minWidth: 70 },
});
