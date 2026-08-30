import sys

path = "src/screens/StudentsListScreen.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

edits = []

edits.append((
"""function tap(style = Haptics.ImpactFeedbackStyle.Light) {
  Haptics.impactAsync(style).catch(() => {});
}""",
"""function tap(style = Haptics.ImpactFeedbackStyle.Light) {
  Haptics.impactAsync(style).catch(() => {});
}

// How many student records show on the dashboard before "See more" is
// needed. The rest aren't lost or hidden anywhere else -- tapping "See
// more" expands this same list in place; "See less" collapses it back.
const DASHBOARD_PREVIEW_COUNT = 3;"""
))

edits.append((
"""  const displayedResults = (query || showAll) ? results : results.slice(0, 5);""",
"""  const displayedResults = (query || showAll) ? results : results.slice(0, DASHBOARD_PREVIEW_COUNT);"""
))

edits.append((
"""          !initialLoading && !query && results.length > 5 ? (
            <View style={styles.listPad}>
              <Squish
                style={[styles.seeMoreBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setShowAll((prev) => !prev)}
              >
                <Text style={[styles.seeMoreText, { color: colors.textPrimary }]}>
                  {showAll ? 'See less' : `See more (${results.length - 5})`}
                </Text>""",
"""          !initialLoading && !query && results.length > DASHBOARD_PREVIEW_COUNT ? (
            <View style={styles.listPad}>
              <Squish
                style={[styles.seeMoreBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setShowAll((prev) => !prev)}
              >
                <Text style={[styles.seeMoreText, { color: colors.textPrimary }]}>
                  {showAll ? 'See less' : `See more (${results.length - DASHBOARD_PREVIEW_COUNT})`}
                </Text>"""
))

edits.append((
"""            <View style={styles.listPad}>
              <SkeletonStudentRow />
              <SkeletonStudentRow />
              <SkeletonStudentRow />
              <SkeletonStudentRow />
              <SkeletonStudentRow />
            </View>""",
"""            <View style={styles.listPad}>
              <SkeletonStudentRow />
              <SkeletonStudentRow />
              <SkeletonStudentRow />
            </View>"""
))

for i, (old, new) in enumerate(edits, 1):
    count = content.count(old)
    if count != 1:
        print(f"ABORT: edit {i} matched {count} times (expected 1). No changes written.")
        sys.exit(1)
    content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patched successfully:", path)
