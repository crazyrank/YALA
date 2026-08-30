import sys

path = "src/screens/MoreScreen.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

edits = []

edits.append((
"""  const { user, logout, updateProfilePhoto, removeProfilePhoto } = useAuth();
  const { colors } = useTheme();""",
"""  const { user, logout, updateProfilePhoto, removeProfilePhoto } = useAuth();
  const { colors, preference, setPreference } = useTheme();"""
))

edits.append((
"""function getInitials(name = '') {""",
"""function AppearanceToggle({ value, onChange }) {
  const { colors } = useTheme();
  const options = [
    { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
    { key: 'light', label: 'Light', icon: 'sunny-outline' },
    { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  ];
  return (
    <View
      style={[
        styles.appearanceRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.appearanceOption,
              active && { backgroundColor: colors.ink },
            ]}
          >
            <Ionicons
              name={opt.icon}
              size={16}
              color={active ? colors.gold : colors.textMuted}
            />
            <Text
              style={[
                styles.appearanceOptionText,
                { color: active ? colors.textInverse : colors.textMuted },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getInitials(name = '') {"""
))

edits.append((
"""        <Text style={[styles.section, { color: colors.textMuted }]}>PROFILE</Text>""",
"""        <Text style={[styles.section, { color: colors.textMuted }]}>APPEARANCE</Text>
        <AppearanceToggle value={preference} onChange={setPreference} />

        <Text style={[styles.section, { color: colors.textMuted, marginTop: 18 }]}>PROFILE</Text>"""
))

edits.append((
"""  rowSub: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    marginTop: 2,
  },""",
"""  rowSub: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    marginTop: 2,
  },
  appearanceRow: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 4,
    marginBottom: 10,
    ...shadow.raised,
  },
  appearanceOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  appearanceOptionText: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 13,
  },"""
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
