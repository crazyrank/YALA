import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { getCacheNotice, subscribeCacheNotice } from '../services/offlineCache';

// Shown only while a screen is displaying its saved copy instead of fresh data.
export default function OfflineCacheNote({ group }) {
  const { colors } = useTheme();
  const [notice, setNotice] = useState(() => getCacheNotice(group));

  useEffect(() => {
    setNotice(getCacheNotice(group));
    return subscribeCacheNotice(() => setNotice(getCacheNotice(group)));
  }, [group]);

  if (!notice) return null;
  const when = new Date(notice.fetchedAt);
  const stamp = Number.isNaN(when.getTime())
    ? ''
    : ` (${when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })})`;

  return (
    <View
      style={{
        backgroundColor: colors.warningBg,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        marginHorizontal: 16,
        marginTop: 10,
        marginBottom: 4,
      }}
    >
      <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '600' }}>
        Showing the last saved copy{stamp}. Connect to the internet to refresh. Changes need a connection.
      </Text>
    </View>
  );
}
