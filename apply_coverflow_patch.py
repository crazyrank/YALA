import sys

path = "src/screens/StaffDirectoryScreen.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

edits = []

edits.append((
"""  ActivityIndicator,
  Dimensions,
} from 'react-native';""",
"""  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';"""
))

edits.append((
"""import { spacing, radius, shadow } from '../theme/spacing';

// Mirrors""",
"""import { spacing, radius, shadow } from '../theme/spacing';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// How much a card grows / lifts as it nears the center of the row, versus
// its resting state at the edges. Tuned to read as "raised", not "popping".
const COVERFLOW_SCALE = [0.88, 1.08];
const COVERFLOW_LIFT = 8; // px of translateY at rest vs peak
const COVERFLOW_ELEVATION = [2, 12]; // Android
const COVERFLOW_SHADOW_OPACITY = [0.15, 0.4]; // iOS

// Mirrors"""
))

edits.append((
"""  const scrollRef = useRef(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef(null);
  const itemStride = cardWidth + itemGap;
  const singleSetWidth = entries.length * itemStride;
  const canLoop = entries.length > 1;
  const loopEntries = canLoop ? [...entries, ...entries] : entries;""",
"""  const scrollRef = useRef(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const rafRef = useRef(null);
  // Tracks the same value as offsetRef, but as an Animated.Value so each
  // card's scale/lift/shadow can be interpolated straight off it -- during
  // both the auto-drift (set via rAF) and manual drags (set via onScroll).
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const itemStride = cardWidth + itemGap;
  const singleSetWidth = entries.length * itemStride;
  const canLoop = entries.length > 1;
  const loopEntries = canLoop ? [...entries, ...entries] : entries;
  const viewportWidth = Dimensions.get('window').width;"""
))

edits.append((
"""        scrollRef.current?.scrollTo({ x: offsetRef.current, animated: false });
      }""",
"""        scrollRef.current?.scrollTo({ x: offsetRef.current, animated: false });
        scrollAnim.setValue(offsetRef.current);
      }"""
))

edits.append((
"""      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: itemGap }}
      scrollEventThrottle={16}
      onTouchStart={() => {""",
"""      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: itemGap }}
      scrollEventThrottle={16}
      onScroll={(e) => {
        scrollAnim.setValue(e.nativeEvent.contentOffset.x);
      }}
      onTouchStart={() => {"""
))

edits.append((
"""      {loopEntries.map((item, idx) => renderCard(item, idx))}""",
"""      {loopEntries.map((item, idx) => {
        // The scroll offset at which THIS card sits exactly centered in
        // the viewport. Interpolating scrollAnim against that value is
        // what makes each card individually swell and lift as it drifts
        // through the middle, then settle back down toward the edges.
        const centerScrollValue = idx * itemStride + spacing.lg + cardWidth / 2 - viewportWidth / 2;
        const inputRange = [centerScrollValue - itemStride, centerScrollValue, centerScrollValue + itemStride];
        const cardAnimatedStyle = {
          transform: [
            {
              scale: scrollAnim.interpolate({
                inputRange,
                outputRange: [COVERFLOW_SCALE[0], COVERFLOW_SCALE[1], COVERFLOW_SCALE[0]],
                extrapolate: 'clamp',
              }),
            },
            {
              translateY: scrollAnim.interpolate({
                inputRange,
                outputRange: [COVERFLOW_LIFT, -COVERFLOW_LIFT, COVERFLOW_LIFT],
                extrapolate: 'clamp',
              }),
            },
          ],
          elevation: scrollAnim.interpolate({
            inputRange,
            outputRange: [COVERFLOW_ELEVATION[0], COVERFLOW_ELEVATION[1], COVERFLOW_ELEVATION[0]],
            extrapolate: 'clamp',
          }),
          shadowOpacity: scrollAnim.interpolate({
            inputRange,
            outputRange: [COVERFLOW_SHADOW_OPACITY[0], COVERFLOW_SHADOW_OPACITY[1], COVERFLOW_SHADOW_OPACITY[0]],
            extrapolate: 'clamp',
          }),
        };
        return renderCard(item, idx, cardAnimatedStyle);
      })}"""
))

edits.append((
"""                renderCard={(item, idx) => (
                  <Pressable
                    key={`${item.id}-${idx}`}
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                    onPress={() => handleCardPress(section.key, item)}
                  >
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={styles.cardPhoto} />
                    ) : (
                      <View style={styles.cardAvatar}>
                        <Text style={styles.cardAvatarText}>{getInitials(item.fullName)}</Text>
                      </View>
                    )}
                    <View style={styles.cardTextBlock}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {item.fullName}
                      </Text>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                  </Pressable>
                )}""",
"""                renderCard={(item, idx, animatedStyle) => (
                  <AnimatedPressable
                    key={`${item.id}-${idx}`}
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed, animatedStyle]}
                    onPress={() => handleCardPress(section.key, item)}
                  >
                    {item.photoUrl ? (
                      <Image source={{ uri: item.photoUrl }} style={styles.cardPhoto} />
                    ) : (
                      <View style={styles.cardAvatar}>
                        <Text style={styles.cardAvatarText}>{getInitials(item.fullName)}</Text>
                      </View>
                    )}
                    <View style={styles.cardTextBlock}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {item.fullName}
                      </Text>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                  </AnimatedPressable>
                )}"""
))

for i, (old, new) in enumerate(edits, 1):
    count = content.count(old)
    if count != 1:
        print(f"ABORT: edit {i} matched {count} times (expected 1). No changes written.")
        sys.exit(1)
    content = content.replace(old, new)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patched successfully: all 7 edits applied to", path)
