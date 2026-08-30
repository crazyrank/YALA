import sys

files = []

# ---------------------------------------------------------------------------
# 1. MoreScreen.js -- no safe-area handling at all, so content starts flush
#    under the status bar / notch ("cut at the top").
# ---------------------------------------------------------------------------
files.append(("src/screens/MoreScreen.js", [
(
"""import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';""",
"""import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';"""
),
(
"""  const { user, logout, updateProfilePhoto, removeProfilePhoto } = useAuth();
  const { colors, preference, setPreference } = useTheme();""",
"""  const { user, logout, updateProfilePhoto, removeProfilePhoto } = useAuth();
  const { colors, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();"""
),
(
"""      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >""",
"""      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 12) + 12 },
        ]}
      >"""
),
]))

# ---------------------------------------------------------------------------
# 2. OnboardingScreen -- the pager never fills the space between the header
#    and footer, so every slide's content bunches at the top instead of
#    sitting centred in the available area.
# ---------------------------------------------------------------------------
files.append(("src/screens/OnboardingStyles.js", [
(
"""    pager: {
      flexGrow: 0,
    },

    page: {
      width,
      paddingHorizontal: spacing.xxl,
    },""",
"""    pager: {
      flex: 1,
    },

    page: {
      width,
      paddingHorizontal: spacing.xxl,
      justifyContent: 'center',
    },"""
),
]))

# ---------------------------------------------------------------------------
# 3. ConflictsScreen.js / MergeQueueScreen.js -- empty-state message sits
#    pinned near the top (fixed paddingTop, no flex) instead of being
#    centred in the screen like the other list screens already do.
# ---------------------------------------------------------------------------
files.append(("src/screens/ConflictsScreen.js", [
(
"""      contentContainerStyle={[
        styles.listContent,
        { paddingTop: Math.max(insets.top, 12) + 8 },
      ]}""",
"""      contentContainerStyle={[
        conflicts.length === 0 ? styles.emptyListContent : styles.listContent,
        { paddingTop: Math.max(insets.top, 12) + 8 },
      ]}"""
),
(
"""    listContent: {
      padding: spacing.lg,
    },

    pageHeader: {""",
"""    listContent: {
      padding: spacing.lg,
    },

    emptyListContent: {
      flexGrow: 1,
      padding: spacing.lg,
    },

    pageHeader: {"""
),
(
"""    empty: {
      alignItems: 'center',
      paddingTop: spacing.xxl * 2,
      paddingHorizontal: spacing.xl,
    },""",
"""    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },"""
),
]))

files.append(("src/screens/MergeQueueScreen.js", [
(
"""      contentContainerStyle={styles.listContent}""",
"""      contentContainerStyle={items.length === 0 ? styles.emptyListContent : styles.listContent}"""
),
(
"""    listContent: {
      padding: spacing.lg,
    },

    card: {""",
"""    listContent: {
      padding: spacing.lg,
    },

    emptyListContent: {
      flexGrow: 1,
      padding: spacing.lg,
    },

    card: {"""
),
(
"""    empty: {
      alignItems: 'center',
      paddingTop: spacing.xxl * 2,
      paddingHorizontal: spacing.xl,
    },""",
"""    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },"""
),
]))

for path, edits in files:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    for i, (old, new) in enumerate(edits, 1):
        count = content.count(old)
        if count != 1:
            print(f"ABORT: {path} edit {i} matched {count} times (expected 1). No changes written.")
            sys.exit(1)
        content = content.replace(old, new)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    print("Patched successfully:", path)
