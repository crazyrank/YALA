import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';

import { useAuth } from '../context/AuthContext';
import { CORE_VALUES, CREATOR, DECLARATION, PROPRIETOR, SCHOOL } from '../content/introContent';

const GOLD = '#D4A84B';
const BG = '#0B1220';
const CARD = '#152034';
const TEXT = '#F4F6FA';
const MUTED = '#9AA6BD';
const CHAR_MS = 38;

const PAGES = ['welcome', 'declaration', 'values', 'creator'];

export default function IntroScreen({ navigation, route }) {
  const { finishOnboarding } = useAuth();
  const isReplay = Boolean(route?.params?.replay);
  const [page, setPage] = useState(0);

  const finish = () => {
    if (isReplay) {
      navigation.goBack();
    } else {
      finishOnboarding();
    }
  };

  const next = () => {
    if (page >= PAGES.length - 1) {
      finish();
    } else {
      setPage((p) => p + 1);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>YALA</Text>
          <Text style={styles.brandSub}>SCHOOL INFORMATION SYSTEM</Text>
        </View>
        <Pressable onPress={finish} style={styles.skip} accessibilityRole="button">
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {page === 0 && <WelcomePage />}
        {page === 1 && <DeclarationPage />}
        {page === 2 && <ValuesPage />}
        {page === 3 && <CreatorPage />}
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Pressable onPress={next} style={styles.nextButton} accessibilityRole="button">
          <Text style={styles.nextText}>{page === PAGES.length - 1 ? 'Continue to login' : 'Continue'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function WelcomePage() {
  return (
    <View style={styles.center}>
      <Image source={PROPRIETOR.image} style={styles.proprietor} resizeMode="contain" />
      <Text style={styles.name}>{PROPRIETOR.name}</Text>
      <Text style={styles.muted}>{PROPRIETOR.title}</Text>
      <Text style={styles.schoolName}>{SCHOOL.name}</Text>
      <Text style={styles.motto}>{SCHOOL.motto}</Text>
    </View>
  );
}

function DeclarationPage() {
  const sentences = DECLARATION.english;
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const mounted = useRef(true);

  // Narrate the current sentence and type it out. Advance when speech ends.
  useEffect(() => {
    if (paused || finished) return undefined;
    const sentence = sentences[index];
    setTyped('');
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      if (mounted.current) setTyped(sentence.slice(0, i));
      if (i >= sentence.length) clearInterval(timer);
    }, CHAR_MS);

    Speech.speak(sentence, {
      language: 'en-US',
      rate: 0.95,
      onDone: () => {
        if (!mounted.current) return;
        if (index >= sentences.length - 1) {
          setFinished(true);
        } else {
          setIndex((n) => n + 1);
        }
      },
      onStopped: () => {},
      onError: () => {},
    });

    return () => {
      clearInterval(timer);
      Speech.stop();
    };
  }, [index, paused, finished, sentences]);

  // Stop narration when leaving the page.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      Speech.stop();
    };
  }, []);

  const replay = () => {
    Speech.stop();
    setFinished(false);
    setPaused(false);
    setIndex(0);
  };

  const togglePause = () => {
    if (paused) {
      setPaused(false);
    } else {
      Speech.stop();
      setPaused(true);
    }
  };

  const showFull = finished;
  const current = showFull ? sentences.join(' ') : typed;

  return (
    <ScrollView contentContainerStyle={styles.declarationWrap}>
      <Text style={styles.eyebrow}>PROPHETIC DECLARATION</Text>
      <Text style={styles.declarationText}>{current}</Text>

      {DECLARATION.verified && DECLARATION.yoruba.length > 0 && (
        <View style={styles.translation}>
          <Text style={styles.langLabel}>YORUBA</Text>
          <Text style={styles.translationText}>{DECLARATION.yoruba[index]}</Text>
        </View>
      )}
      {DECLARATION.verified && DECLARATION.french.length > 0 && (
        <View style={styles.translation}>
          <Text style={styles.langLabel}>FRENCH</Text>
          <Text style={styles.translationText}>{DECLARATION.french[index]}</Text>
        </View>
      )}

      <Text style={styles.progress}>
        {showFull ? 'Complete' : `${index + 1} of ${sentences.length}`}
      </Text>

      <View style={styles.controls}>
        <Pressable onPress={togglePause} disabled={showFull} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>{paused ? 'Resume' : 'Pause'}</Text>
        </Pressable>
        <Pressable onPress={replay} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Replay</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ValuesPage() {
  return (
    <ScrollView contentContainerStyle={styles.valuesWrap}>
      <Text style={styles.eyebrow}>CORE VALUES</Text>
      {CORE_VALUES.map((v) => (
        <View key={v.title} style={styles.card}>
          <Text style={styles.cardTitle}>{v.title.toUpperCase()}</Text>
          <Text style={styles.cardText}>{v.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function CreatorPage() {
  return (
    <View style={styles.center}>
      <Image source={CREATOR.image} style={styles.creatorImage} />
      <Text style={styles.eyebrow}>{CREATOR.eyebrow}</Text>
      <Text style={styles.name}>{CREATOR.name}</Text>
      <Text style={styles.creatorBody}>{CREATOR.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  brand: { color: TEXT, fontSize: 22, fontWeight: '800', letterSpacing: 4 },
  brandSub: { color: MUTED, fontSize: 10, letterSpacing: 2, marginTop: 2 },
  skip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CARD,
  },
  skipText: { color: TEXT, fontWeight: '600' },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  proprietor: { width: 260, height: 340 },
  name: { color: TEXT, fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  muted: { color: MUTED, fontSize: 14, marginTop: 4, textAlign: 'center' },
  schoolName: { color: GOLD, fontSize: 16, fontWeight: '700', marginTop: 16 },
  motto: { color: TEXT, fontSize: 14, fontStyle: 'italic', marginTop: 4, textAlign: 'center' },
  eyebrow: { color: GOLD, fontSize: 11, letterSpacing: 2, fontWeight: '700', marginBottom: 12 },
  declarationWrap: { padding: 24, paddingBottom: 40 },
  declarationText: { color: TEXT, fontSize: 22, lineHeight: 32, fontWeight: '600' },
  translation: { marginTop: 18 },
  langLabel: { color: MUTED, fontSize: 10, letterSpacing: 2, marginBottom: 4 },
  translationText: { color: TEXT, fontSize: 16, lineHeight: 24 },
  progress: { color: MUTED, marginTop: 24, fontSize: 12 },
  controls: { flexDirection: 'row', gap: 12, marginTop: 16 },
  smallButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: CARD,
  },
  smallButtonText: { color: TEXT, fontWeight: '600' },
  valuesWrap: { padding: 24, paddingBottom: 40 },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: GOLD, fontSize: 12, letterSpacing: 1.5, fontWeight: '700' },
  cardText: { color: TEXT, fontSize: 16, marginTop: 6, lineHeight: 22 },
  creatorImage: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: GOLD,
    marginBottom: 16,
  },
  creatorBody: { color: MUTED, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 12 },
  footer: { padding: 20, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2A3650' },
  dotActive: { width: 24, backgroundColor: GOLD },
  nextButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: GOLD,
    alignItems: 'center',
  },
  nextText: { color: BG, fontWeight: '800', fontSize: 16 },
});
