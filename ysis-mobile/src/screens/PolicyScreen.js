import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

const BG = '#0E1A2B';
const CARD = '#17263B';
const TEXT = '#F4F1EA';
const TEXT_SOFT = '#D9E0EC';
const MUTED = '#9FB0C8';
const ACCENT = '#2FA37A';

const SECTIONS = [
  {
    title: 'What YSIS records',
    paragraphs: [
      'YSIS stores student records on this device so the app works without internet. A record includes the admission number, full name, division, class, arm, guardian name and phone number, and academic session.',
      'Date of birth and gender are optional when a student is added on the phone. A CSV import requires both, and the school uses them for WAEC and NECO exam registration.',
    ],
  },
  {
    title: 'Who can access it',
    paragraphs: [
      'Access is limited to staff accounts that the school sets up.',
      'YSIS does not sell student data, and it does not use student data for advertising.',
    ],
  },
  {
    title: 'Questions and requests',
    paragraphs: [
      "For questions about a student's record, or to ask for a correction, contact the school administration.",
    ],
  },
];

export default function PolicyScreen({ navigation, route }) {
  const onContinue = route?.params?.onContinue;
  const [agreed, setAgreed] = useState(false);

  const proceed = () => {
    if (!agreed) return;
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    }
    if (typeof onContinue === 'function') {
      onContinue();
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      <View style={styles.header}>
        <Text style={styles.eyebrow}>PRIVACY AND DATA POLICY</Text>
        <Text style={styles.title}>How YSIS handles student information</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.cardTitle}>{section.title}</Text>
            {section.paragraphs.map((text, i) => (
              <Text key={i} style={styles.body}>
                {text}
              </Text>
            ))}
          </View>
        ))}

        <Pressable
          onPress={() => setAgreed((v) => !v)}
          style={styles.checkRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
            {agreed && <Feather name="check" size={16} color={BG} />}
          </View>
          <Text style={styles.checkText}>I have read this policy.</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={proceed}
          disabled={!agreed}
          accessibilityRole="button"
          accessibilityState={{ disabled: !agreed }}
          style={({ pressed }) => [
            styles.button,
            !agreed && styles.buttonDisabled,
            pressed && agreed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.buttonText, !agreed && styles.buttonTextDisabled]}>Continue</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
  eyebrow: { color: ACCENT, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  title: { color: TEXT, fontSize: 24, fontWeight: '700', marginTop: 8 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  card: { padding: 18, borderRadius: 16, backgroundColor: CARD, marginBottom: 12 },
  cardTitle: { color: TEXT, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  body: { color: TEXT_SOFT, fontSize: 14, lineHeight: 21, marginTop: 6 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkText: { color: TEXT, fontSize: 15, flexShrink: 1 },
  footer: { paddingHorizontal: 20, paddingVertical: 16 },
  button: {
    height: 54,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { backgroundColor: CARD },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: BG, fontSize: 16, fontWeight: '700' },
  buttonTextDisabled: { color: MUTED },
});
