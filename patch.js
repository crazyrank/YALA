const fs = require('fs');
const path = 'src/screens/StudentsListScreen.js';
let src = fs.readFileSync(path, 'utf8');

function apply(oldStr, newStr) {
  if (src.indexOf(oldStr) === -1) {
    console.error('Pattern not found — skipping one edit.');
    return;
  }
  src = src.replace(oldStr, newStr);
}

apply(
  `import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db';
import { api } from '../api/client';
import OfflineMarquee from '../components/OfflineMarquee';
import SyncIssueBanner from '../components/SyncIssueBanner';`,
  `import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDb } from '../db';
import { api } from '../api/client';
import { exportStudentsToCsv } from '../services/csvExport';
import OfflineMarquee from '../components/OfflineMarquee';
import SyncIssueBanner from '../components/SyncIssueBanner';`
);

apply(
  `  const [pullError, setPullError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);`,
  `  const [pullError, setPullError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);`
);

apply(
  `  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await refreshFromServer();
    } finally {
      setRefreshing(false);
    }
  };`,
  `  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await refreshFromServer();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const count = await exportStudentsToCsv();

      if (count === 0) {
        Alert.alert(
          'Nothing to export',
          'There are no student records stored on this device yet.'
        );
      }
    } catch (err) {
      Alert.alert(
        'Export failed',
        err.message || 'Could not export student records.'
      );
    } finally {
      setExporting(false);
    }
  };`
);

apply(
  `            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {query
                  ? 'Search results'
                  : 'Student records'}
              </Text>

              <Text style={styles.sectionHint}>
                {results.length} record
                {results.length === 1 ? '' : 's'}
              </Text>
            </View>`,
  `            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {query
                  ? 'Search results'
                  : 'Student records'}
              </Text>

              <View style={styles.sectionRight}>
                <Text style={styles.sectionHint}>
                  {results.length} record
                  {results.length === 1 ? '' : 's'}
                </Text>

                <Pressable
                  onPress={handleExport}
                  disabled={exporting}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.exportButton,
                    pressed && styles.exportButtonPressed,
                  ]}
                >
                  {exporting ? (
                    <ActivityIndicator size="small" color="#16324F" />
                  ) : (
                    <Text style={styles.exportButtonText}>
                      Export CSV
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>`
);

apply(
  `  sectionHint: {
    color: '#98A2B3',
    fontSize: 10,
  },`,
  `  sectionHint: {
    color: '#98A2B3',
    fontSize: 10,
  },

  sectionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  exportButton: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F4EAD0',
  },

  exportButtonPressed: {
    opacity: 0.78,
  },

  exportButtonText: {
    color: '#8A6A1F',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },`
);

fs.writeFileSync(path, src);
console.log('Done.');
