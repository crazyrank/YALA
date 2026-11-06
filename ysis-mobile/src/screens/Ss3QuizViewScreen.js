import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';

const ORIGIN = 'https://yalaprep.netlify.app';
const ALLOWED = /^https:\/\/yalaprep\.netlify\.app(\/|$|\?|#)/;
const ROLES = ['director', 'principal', 'head_teacher', 'class_teacher'];

const LOCK_DOWN_JS = `
(function () {
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); }, true);
  true;
})();
`;

export default function Ss3QuizViewScreen({ navigation }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ROLES.includes(user?.role)) {
      setError('This screen is not available for your role.');
      setLoading(false);
      return;
    }
    api
      .post('/ss3-quiz-view/token', {})
      .then((res) => setUrl(res.url))
      .catch((err) => setError(err?.message || 'Could not open the SS3 quiz view.'))
      .finally(() => setLoading(false));
  }, [user?.role]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (error || !url) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.text, { color: colors.textPrimary }]}>{error || 'Could not open the SS3 quiz view.'}</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: url }}
      originWhitelist={[ORIGIN]}
      onShouldStartLoadWithRequest={(request) => ALLOWED.test(request.url)}
      setSupportMultipleWindows={false}
      allowsLinkPreview={false}
      injectedJavaScriptBeforeContentLoaded={LOCK_DOWN_JS}
      sharedCookiesEnabled={true}
      thirdPartyCookiesEnabled={true}
      domStorageEnabled={true}
      javaScriptEnabled={true}
      mixedContentMode="never"
      startInLoadingState={true}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { fontSize: 15, textAlign: 'center' },
});
