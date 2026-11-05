#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path.cwd()
MOBILE = ROOT / "ysis-mobile" / "src"
if not MOBILE.exists():
    print("ERROR: ysis-mobile/src not found. Run from YALA_SIS (parent of ysis-mobile).")
    sys.exit(1)

def read(p):
    return p.read_text(encoding="utf-8")

def write(p, text):
    p.write_text(text, encoding="utf-8")
    print(f"updated {p}")

# --- StudentsListScreen.js ---
ssl = MOBILE / "screens" / "StudentsListScreen.js"
text = read(ssl)

old_hero = '''      <LinearGradient
        colors={gradients.navy}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top }]}
      >
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.heroEyebrow}>
              {classLevel ? classLevel.toUpperCase() : 'YALAMATRIX SIS'}
            </Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {classLevel ? `${classLevel} Students` : 'Students'}
            </Text>
          </View>
'''

new_hero = '''      <LinearGradient
        colors={gradients.navy}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top }]}
      >
        <View style={styles.heroTopRow}>
          {classLevel ? (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={styles.heroBackBtn}
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>
          ) : null}

          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.heroEyebrow}>
              {classLevel ? 'CLASS' : 'YALAMATRIX SIS'}
            </Text>
            <Text
              style={[styles.heroTitle, classLevel && styles.heroTitleClass]}
              numberOfLines={1}
            >
              {classLevel ? `${classLevel} Students` : 'Students'}
            </Text>
          </View>
'''

if "heroBackBtn" in text:
    print("StudentsListScreen.js: hero already patched, skip")
elif old_hero in text:
    text = text.replace(old_hero, new_hero, 1)
else:
    print("ERROR: StudentsListScreen.js hero block not found")
    sys.exit(1)

old_styles = '''  heroEyebrow: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: '#2FA37A',
    marginBottom: 1,
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
'''

new_styles = '''  heroBackBtn: {
    marginRight: 4,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: '#2FA37A',
    marginBottom: 1,
  },
  heroTitle: {
    fontFamily: fontFamily.display,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: '#FFFFFF',
  },
  heroTitleClass: {
    fontSize: 22,
    lineHeight: 28,
  },
'''

if "heroTitleClass" not in text:
    if old_styles in text:
        text = text.replace(old_styles, new_styles, 1)
    else:
        print("ERROR: StudentsListScreen.js styles block not found")
        sys.exit(1)

write(ssl, text)

# --- MoreScreen.js ---
ms = MOBILE / "screens" / "MoreScreen.js"
text = read(ms)

old_badge = '''            <View style={[styles.cameraBadge, { backgroundColor: colors.gold }]}>
              {uploading ? (
                <ActivityIndicator size="small" color="#0E1A2B" />
              ) : (
                <Ionicons name="camera" size={14} color="#0E1A2B" />
              )}
            </View>
'''

new_badge = '''            <View
              style={[
                styles.cameraBadge,
                {
                  backgroundColor: colors.gold,
                  borderColor: colors.surface,
                },
              ]}
            >
              {uploading ? (
                <ActivityIndicator size="small" color="#0E1A2B" />
              ) : (
                <Ionicons name="camera" size={14} color="#0E1A2B" />
              )}
            </View>
'''

if "borderColor: colors.surface" in text:
    print("MoreScreen.js: camera badge already patched, skip")
elif old_badge in text:
    text = text.replace(old_badge, new_badge, 1)
else:
    print("WARN: MoreScreen.js camera badge block not found exactly")

text = text.replace(
    """  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
""",
    """  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
""",
)

write(ms, text)
print("Done.")
