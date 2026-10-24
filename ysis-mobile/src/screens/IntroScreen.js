import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';

import { useAuth } from '../context/AuthContext';
import {
  CORE_VALUES,
  CREATOR,
  DECLARATION,
  SLOGAN,
  PROPRIETOR,
  SCHOOL,
} from '../content/introContent';

const YALA_LOGO = require('../../assets/yala-matrix-schools-logo.jpg');

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const ACCENT = '#E6E6E2';
const BG = '#0C0C0E';
const CARD = '#1A1A1D';
const TEXT = '#F4F6FA';
const TEXT_SOFT = '#D9E0EC';
const MUTED = '#9AA6BD';

const PAGE_COUNT = 4;
const PAD = 24;
const HERO_HEIGHT = Math.round(SCREEN_H * 0.5);
const CHAR_MS = 38;
const COUNT_STEP_MS = 30; // 100 steps at 30ms, about 3 seconds
const PARA_GAP = 14;
const HEADING_BLOCK = 56;

/* ---------- Declaration font fitting ---------- */

// Rough line count for uppercase bold text at a given size, using greedy word wrap.
function countLines(paragraphs, fontSize, width) {
  const charWidth = fontSize * 0.7;
  const perLine = Math.max(1, Math.floor(width / charWidth));
  let lines = 0;
  paragraphs.forEach((p) => {
    let cur = 0;
    let count = 1;
    p.split(' ').forEach((word) => {
      if (cur === 0) {
        cur = word.length;
      } else if (cur + 1 + word.length <= perLine) {
        cur += 1 + word.length;
      } else {
        count += 1;
        cur = word.length;
      }
    });
    lines += count;
  });
  return lines;
}

// Largest font size where every paragraph fits inside the given box.
function fitFontSize(paragraphs, width, height) {
  let best = 12;
  for (let fs = 12; fs <= 44; fs += 1) {
    const lineHeight = fs * 1.3;
    const total =
      countLines(paragraphs, fs, width) * lineHeight +
      (paragraphs.length - 1) * PARA_GAP;
    if (total <= height) best = fs;
    else break;
  }
  return best;
}

/* ---------- Entrance animation for each page ---------- */

function Enter({ children, style }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ---------- Loading splash ---------- */

const SPLASH_MS = 3200;

function SplashLoader({ onDone }) {
  const [count, setCount] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Warm up the speech engine now, so the first sentence starts on time.
    Speech.getAvailableVoicesAsync().catch(() => {});

    Animated.timing(reveal, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: SPLASH_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      setCount(n);
      if (n >= 100) {
        clearInterval(timer);
        setTimeout(onDone, 500);
      }
    }, SPLASH_MS / 100);

    return () => clearInterval(timer);
  }, []);

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.splash}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <Animated.View style={[styles.splashInner, { opacity: reveal }]}>
        <View style={styles.logoPlate}>
          <Image
            source={YALA_LOGO}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.splashBrand}>YSIS</Text>
        <Text style={styles.splashSub}>STUDENT INFORMATION SYSTEM</Text>

        <View style={styles.progressBlock}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: fillWidth }]} />
          </View>
          <Text style={styles.splashCount}>{count}</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

/* ---------- Main onboarding flow ---------- */

export default function IntroScreen({ navigation, route }) {
  const { finishOnboarding } = useAuth();
  const isReplay = Boolean(route?.params?.replay);
  const [booted, setBooted] = useState(isReplay);
  const [page, setPage] = useState(0);

  if (!booted) {
    return <SplashLoader onDone={() => setBooted(true)} />;
  }

  const finish = () => {
    if (isReplay) {
      navigation.goBack();
    } else {
      finishOnboarding();
    }
  };

  const next = () => {
    if (page >= PAGE_COUNT - 1) {
      finish();
    } else {
      setPage((p) => p + 1);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {page !== 0 && (
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>YSIS</Text>
          <Text style={styles.brandSub}>STUDENT INFORMATION SYSTEM</Text>
        </View>
        {page !== 1 && (
        <Pressable
          onPress={finish}
          style={styles.skip}
          accessibilityRole="button"
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
        )}
      </View>
      )}

      <View style={styles.body}>
        <Enter key={page} style={styles.fill}>
          {page === 0 && <WelcomePage />}
          {page === 1 && <TranslationPage onFinished={next} />}
          {page === 2 && <MantraPage onFinished={next} />}
          {page === 3 && <CreatorPage />}
        </Enter>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {Array.from({ length: PAGE_COUNT }).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>
        {page !== 1 && (
        <Pressable
          onPress={next}
          style={styles.nextButton}
          accessibilityRole="button"
        >
          <Text style={styles.nextText}>
            {page === PAGE_COUNT - 1 ? 'Continue to login' : 'Continue'}
          </Text>
        </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

/* Page 1: full-width photo that fades into the background, then the welcome text. */
const TYPE_MS = 55;
const FADE_STEPS = Array.from({ length: 14 }, (_, i) => Math.pow(i / 13, 1.5));

function Fade({ style }) {
  return (
    <View style={[styles.fade, style]} pointerEvents="none">
      {FADE_STEPS.map((a, i) => (
        <View
          key={i}
          style={[styles.fadeBand, { backgroundColor: `rgba(12, 12, 14, ${a})` }]}
        />
      ))}
    </View>
  );
}

// Types the text out one character at a time, centred, without shifting.
function TypeLine({ text, style }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= text.length) return undefined;
    const t = setTimeout(() => setCount((c) => c + 1), TYPE_MS);
    return () => clearTimeout(t);
  }, [count, text]);

  return (
    <Text style={style}>
      {text.slice(0, count)}
      <Text style={styles.ghost}>{text.slice(count)}</Text>
    </Text>
  );
}

function WelcomePage() {
  const src = Image.resolveAssetSource(PROPRIETOR.image);
  const photoW = SCREEN_W * 1.3;
  const photoH =
    src && src.width ? photoW * (src.height / src.width) : photoW * 1.5;

  return (
    <View style={styles.fill}>
      <View style={styles.heroBox}>
        <Image
          source={PROPRIETOR.image}
          resizeMode="contain"
          style={{
            position: 'absolute',
            top: 24,
            left: (SCREEN_W - photoW) / 2,
            width: photoW,
            height: photoH,
          }}
        />
        <Fade style={styles.fadeBottom} />
      </View>

      <View style={styles.welcomeText}>
        <Text style={styles.name}>{PROPRIETOR.name}</Text>
        <Text style={styles.muted}>{PROPRIETOR.title}</Text>
        <Text style={styles.schoolName}>{SCHOOL.name}</Text>
        <TypeLine text={SCHOOL.motto} style={styles.motto} />
      </View>
    </View>
  );
}

/* Page 2: English types out and is narrated. The screen moves on by itself. */
const PAUSE_AFTER_MS = 3000;
const START_FALLBACK_MS = 2000;

function TranslationPage({ onFinished }) {
  const total = DECLARATION.english.length;
  const [index, setIndex] = useState(0);

  const handleSentenceDone = () => {
    if (index >= total - 1) {
      onFinished();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <View style={styles.translationWrap}>
      <Text style={styles.translationTitle}>PROPHETIC DECLARATION</Text>
      <View style={styles.stageWrap}>
        <SentenceStage
          key={index}
          index={index}
          total={total}
          onDone={handleSentenceDone}
        />
      </View>
    </View>
  );
}

function SentenceStage({ index, total, onDone }) {
  const en = DECLARATION.english[index];
  const yo = DECLARATION.yoruba[index] || '';
  const fr = DECLARATION.french[index] || '';

  const [started, setStarted] = useState(false);
  const [count, setCount] = useState(0);
  const [spoken, setSpoken] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Speak the English. Typing starts when the voice actually starts.
  useEffect(() => {
    const fallback = setTimeout(() => setStarted(true), START_FALLBACK_MS);
    const giveUp = setTimeout(() => setSpoken(true), 20000);
    Speech.speak(en, {
      language: 'en-US',
      rate: 0.9,
      onStart: () => {
        clearTimeout(fallback);
        setStarted(true);
      },
      onDone: () => setSpoken(true),
      onStopped: () => setSpoken(true),
      onError: () => {
        setStarted(true);
        setSpoken(true);
      },
    });
    return () => {
      clearTimeout(fallback);
      clearTimeout(giveUp);
      Speech.stop();
    };
  }, []);

  // Type one character at a time, once the voice has started.
  useEffect(() => {
    if (!started || count >= en.length) return undefined;
    const t = setTimeout(() => setCount((c) => c + 1), CHAR_MS);
    return () => clearTimeout(t);
  }, [started, count]);

  // When speech and typing are both finished, wait, then move on.
  const finished = spoken && count >= en.length;
  useEffect(() => {
    if (!finished) return undefined;
    const t = setTimeout(() => onDoneRef.current(), PAUSE_AFTER_MS);
    return () => clearTimeout(t);
  }, [finished]);

  const ratio = Math.min(1, count / en.length);
  const shown = (text) => text.slice(0, Math.ceil(text.length * ratio));

  return (
    <View style={styles.stage}>
      <Text style={styles.english}>{shown(en)}</Text>

      {DECLARATION.verified && yo !== '' && (
        <>
          <Text style={styles.langLabel}>YORUBA</Text>
          <Text style={styles.yoruba}>{shown(yo)}</Text>
        </>
      )}

      {DECLARATION.verified && fr !== '' && (
        <>
          <Text style={styles.langLabel}>FRENCH</Text>
          <Text style={styles.french}>{shown(fr)}</Text>
        </>
      )}
    </View>
  );
}

/* Page 3: mantra typed once, then the five principles, one at a time. */
const WAIT_TITLE_MS = 1200;
const WAIT_DESC_MS = 3500;
const ERASE_MS = 18;

// Types a line one character at a time, then calls onDone once.
function TypeText({ text, style, speed, onDone }) {
  const [count, setCount] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (count >= text.length) {
      if (doneRef.current) doneRef.current();
      return undefined;
    }
    const t = setTimeout(() => setCount((c) => c + 1), speed);
    return () => clearTimeout(t);
  }, [count, text, speed]);

  return <Text style={style}>{text.slice(0, count)}</Text>;
}

// One principle: title types, pause, explanation types, pause, both erase.
function PrincipleBlock({ principle, number, onDone }) {
  const title = principle.title + ' :';
  const desc = principle.text;
  const [phase, setPhase] = useState('title');
  const [tc, setTc] = useState(0);
  const [dc, setDc] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    let t;
    if (phase === 'title') {
      if (tc < title.length) t = setTimeout(() => setTc((c) => c + 1), TYPE_MS);
      else setPhase('waitTitle');
    } else if (phase === 'waitTitle') {
      t = setTimeout(() => setPhase('desc'), WAIT_TITLE_MS);
    } else if (phase === 'desc') {
      if (dc < desc.length) t = setTimeout(() => setDc((c) => c + 1), TYPE_MS);
      else setPhase('waitDesc');
    } else if (phase === 'waitDesc') {
      t = setTimeout(() => setPhase('erase'), WAIT_DESC_MS);
    } else if (phase === 'erase') {
      if (dc > 0) t = setTimeout(() => setDc((c) => c - 1), ERASE_MS);
      else if (tc > 0) t = setTimeout(() => setTc((c) => c - 1), ERASE_MS);
      else setPhase('done');
    } else if (phase === 'done') {
      onDoneRef.current();
    }
    return () => clearTimeout(t);
  }, [phase, tc, dc]);

  return (
    <View>
      <Text style={styles.principleLabel}>PRINCIPLE {number}</Text>
      <Text style={styles.principleTitle}>{title.slice(0, tc)}</Text>
      <Text style={styles.principleText}>{desc.slice(0, dc)}</Text>
    </View>
  );
}

function MantraPage({ onFinished }) {
  const [mantraDone, setMantraDone] = useState(false);
  const [index, setIndex] = useState(0);

  const advance = () => {
    if (index >= CORE_VALUES.length - 1) {
      onFinished();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <View style={styles.mantraWrap}>
      <View style={styles.mantraBlock}>
        <TypeText
          text={SLOGAN}
          style={styles.english}
          speed={TYPE_MS}
          onDone={() => setMantraDone(true)}
        />
      </View>

      {mantraDone && (
        <View style={styles.principlesHeading}>
          <Text style={styles.english}>
            Five Principles of Yalamatrix Schools
          </Text>
        </View>
      )}

      <View style={styles.principlesBlock}>
        {mantraDone && (
          <PrincipleBlock
            key={index}
            principle={CORE_VALUES[index]}
            number={index + 1}
            onDone={advance}
          />
        )}
      </View>
    </View>
  );
}

/* Page 4: the creator's photo and profile. */
function CreatorPage() {
  return (
    <ScrollView
      contentContainerStyle={styles.creatorWrap}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.photoFrame}>
        <Image
          source={CREATOR.image}
          style={styles.creatorPhoto}
          resizeMode="cover"
        />
      </View>

      <Text style={styles.creatorName}>{CREATOR.name}</Text>

      <View style={styles.infoCard}>
        {CREATOR.lines.map((line, i) => (
          <Text key={i} style={styles.infoLine}>
            {line}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  fill: { flex: 1 },

  /* Top bar */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD,
    paddingTop: 12,
    paddingBottom: 8,
  },
  brand: { fontFamily: 'serif', color: TEXT, fontSize: 22, fontWeight: '800', letterSpacing: 4 },
  brandSub: { color: MUTED, fontSize: 10, letterSpacing: 2, marginTop: 2 },
  skip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CARD,
  },
  skipText: { color: TEXT, fontWeight: '600' },
  body: { flex: 1 },

  /* Footer */
  footer: { paddingHorizontal: PAD, paddingTop: 12, paddingBottom: 20 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34343A' },
  dotActive: { width: 24, backgroundColor: ACCENT },
  nextButton: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  nextText: { color: BG, fontWeight: '800', fontSize: 16 },

  /* Splash */
  splash: { flex: 1, backgroundColor: BG },
  splashInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PAD,
  },
  logoPlate: {
    width: 128,
    height: 128,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  logoImage: { width: '100%', height: '100%' },
  splashBrand: {
    fontFamily: 'serif',
    color: TEXT,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 8,
  },
  splashSub: { color: MUTED, fontSize: 10, letterSpacing: 3, marginTop: 8 },
  progressBlock: {
    position: 'absolute',
    bottom: 80,
    width: '60%',
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 2,
    borderRadius: 1,
    backgroundColor: '#2A2A2E',
    overflow: 'hidden',
  },
  progressFill: { height: 2, backgroundColor: ACCENT },
  splashCount: {
    color: MUTED,
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 14,
    fontVariant: ['tabular-nums'],
  },

  /* Page 1 */
  heroBox: {
    width: SCREEN_W,
    height: HERO_HEIGHT,
    backgroundColor: BG,
    overflow: 'hidden',
  },
  heroImage: { width: SCREEN_W, height: HERO_HEIGHT },
  fade: { position: 'absolute', left: 0, right: 0 },
  fadeTop: { top: 0, height: 40 },
  fadeBottom: { bottom: 0, height: 130 },
  fadeBand: { flex: 1 },
  translationTitle: {
    color: TEXT,
    fontSize: 19,
    letterSpacing: 3,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  ghost: { color: 'transparent' },
  mantraWrap: {
    flex: 1,
    paddingHorizontal: PAD,
    paddingTop: 12,
  },
  mantraBlock: { marginBottom: 16 },
  principlesHeading: { marginBottom: 12 },
  principleLabel: {
    color: TEXT_SOFT,
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: 6,
  },
  principlesBlock: {},
  principleTitle: {
    color: TEXT,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  principleText: {
    color: TEXT_SOFT,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 26,
  },
  welcomeText: {
    flex: 1,
    paddingHorizontal: PAD,
    paddingTop: 22,
    alignItems: 'center',
  },
  eyebrow: {
    color: ACCENT,
    fontSize: 11,
    letterSpacing: 2.5,
    fontWeight: '700',
    marginBottom: 14,
  },
  name: {
    fontFamily: 'serif',
    color: TEXT,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  muted: {
    color: MUTED,
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 22,
  },
  schoolName: {
    color: ACCENT,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  motto: {
    color: TEXT_SOFT,
    fontSize: 15,
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },

  /* Page 2 */
  translationWrap: {
    flex: 1,
    paddingHorizontal: PAD,
    paddingTop: 8,
    paddingBottom: 12,
    justifyContent: 'space-between',
  },
  stageWrap: { flex: 1, justifyContent: 'center' },
  stage: { paddingVertical: 0 },
  stepLabel: {
    color: MUTED,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 22,
  },
  english: {
    color: TEXT,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 36,
  },
  langLabel: {
    color: MUTED,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  yoruba: {
    color: TEXT_SOFT,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 28,
  },
  french: {
    color: TEXT_SOFT,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 28,
  },
  completeText: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 30,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 12,
  },
  smallButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: CARD,
  },
  smallButtonText: { color: TEXT, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.4 },

  /* Page 3 */
  declWrap: { flex: 1, padding: PAD },
  declHeading: {
    color: ACCENT,
    fontSize: 12,
    letterSpacing: 2.5,
    fontWeight: '800',
    marginBottom: 16,
  },
  declBody: { flex: 1, justifyContent: 'center' },
  declText: {
    color: TEXT,
    fontWeight: '800',
    textAlign: 'left',
  },

  /* Page 4 */
  creatorWrap: {
    alignItems: 'center',
    paddingHorizontal: PAD,
    paddingTop: 12,
    paddingBottom: 28,
  },
  photoFrame: {
    borderWidth: 2,
    borderColor: ACCENT,
    borderRadius: 18,
    padding: 4,
  },
  creatorPhoto: { width: 200, height: 250, borderRadius: 14 },
  creatorName: {
    fontFamily: 'serif',
    color: TEXT,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 22,
    textAlign: 'center',
  },
  infoCard: {
    width: '100%',
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    backgroundColor: CARD,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  infoLine: {
    color: TEXT_SOFT,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 14,
  },
});
