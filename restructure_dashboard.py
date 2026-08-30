path = "src/screens/StudentsListScreen.js"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Sanity-check the anchors we depend on before touching anything.
checks = [
    (275, "      <FlatList\n"),
    (284, "        ]}\n"),
    (285, "        ListHeaderComponent={\n"),
    (286, "          <View>\n"),
    (287, "            <LinearGradient\n"),
    (429, "            </Modal>\n"),
    (430, "\n"),
    (431, "            <View style={styles.bodyPad}>\n"),
    (501, "            </View>\n"),
    (502, "          </View>\n"),
    (503, "        }\n"),
]
for line_no, expected in checks:
    actual = lines[line_no - 1]
    if actual != expected:
        raise SystemExit(
            f"ABORT: line {line_no} did not match.\n  expected: {expected!r}\n  actual:   {actual!r}"
        )

prefix = lines[0:274]                 # lines 1-274, up to blank line before <FlatList>
hero_modal = lines[286:429]           # lines 287-429, <LinearGradient> .. </Modal>
flatlist_open = lines[274:284]        # lines 275-284, <FlatList ... contentContainerStyle closing
bodypad = lines[430:501]              # lines 431-501, <View style={styles.bodyPad}> .. its closing </View>
tail = lines[502:]                    # line 503 onward ("        }" through EOF)

# Dedent the extracted hero/modal block by 6 spaces so it sits at the same
# indent level as the sibling <FlatList> it now precedes.
def dedent(line, n=6):
    if line.strip() == "":
        return line
    if line.startswith(" " * n):
        return line[n:]
    return line

hero_modal = [dedent(l) for l in hero_modal]

# Give the FlatList an explicit flex so it fills the space left after the
# now-fixed hero bar above it (it previously relied on being the only child).
flatlist_open[0] = "      <FlatList\n        style={{ flex: 1 }}\n"

new_lines = (
    prefix
    + hero_modal
    + ["\n"]
    + flatlist_open
    + ["        ListHeaderComponent={\n"]
    + bodypad
    + tail
)

with open(path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("Restructured successfully:", path)
