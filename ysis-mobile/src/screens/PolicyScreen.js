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
const PENDING = '#E0B25A';

// Set to false once the school has confirmed every item marked as pending.
const SHOW_DRAFT_NOTICE = true;

const SECTIONS = [
  {
    title: 'What YSIS records',
    paragraphs: [
      'YSIS stores student records on this device so the app works without internet. A record includes the admission number, full name, division, class, arm, guardian name and phone number, and academic session.',
      'Date of birth and gender are optional. The school requires them for WAEC and NECO exam registration. Leave them blank if they are not known.',
    ],
  },
  {
    title: 'When data leaves the device',
    paragraphs: [
      'When the device is online, records sync to the school server. The server runs on Render, and its database is hosted on Neon.',
      'Student photos are stored with Cloudinary. These providers hold the data only to run the system.',
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
    title: 'How long records are kept',
    pending: true,
    paragraphs: ['The retention period is to be confirmed by Yalamatrix Schools.'],
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
    // Close this screen first. Onboarding then finishes and the app moves on.
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
        {SHOW_DRAFT_NOTICE && (
          <View style={styles.draftBox}>
            <Text style={styles.draftText}>
              Draft. Items marked "To be confirmed" are not final until Yalamatrix Schools confirms them.
            </Text>
          </View>
        )}

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{section.title}</Text>
              {section.pending && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingText}>TO BE CONFIRMED</Text>
                </View>
              )}
            </View>
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
  draftBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PENDING,
    backgroundColor: CARD,
    marginBottom: 14,
  },
  draftText: { color: PENDING, fontSize: 13, lineHeight: 19 },
  card: { padding: 18, borderRadius: 16, backgroundColor: CARD, marginBottom: 12 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: { color: TEXT, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: PENDING,
  },
  pendingText: { color: PENDING, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
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
