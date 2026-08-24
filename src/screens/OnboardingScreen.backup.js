import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

const MANAGEMENT = [
  { name: 'Daniel Williams', role: 'Director', initials: 'DW' },
  { name: 'Grace Johnson', role: 'Principal', initials: 'GJ' },
  { name: 'David Okoro', role: 'Vice Principal', initials: 'DO' },
  { name: 'Esther Brown', role: 'Head Teacher', initials: 'EB' },
  { name: 'Michael James', role: 'Administrative Officer', initials: 'MJ' },
  { name: 'Sarah Williams', role: 'Academic Coordinator', initials: 'SW' },
];

const SLIDES = [
  {
    key: 'welcome',
    eyebrow: 'WELCOME',
    title: 'Welcome to YALAMATRIX SIS',
    body: 'A secure, offline-first student information system built to support the daily work of Yalamatrix Schools.',
  },
  {
    key: 'fingerprint',
    eyebrow: 'SECURE ACCESS',
    title: 'Unlock with your fingerprint',
    body: 'After your first successful online password login, trusted devices can use fingerprint or device PIN authentication for quick daily access.',
  },
  {
    key: 'offline',
    eyebrow: 'WORK WITHOUT INTERRUPTION',
    title: 'Work offline. Sync automatically.',
    body: 'Student records are stored locally first, so essential work can continue without internet. Pending changes are synchronized when connectivity returns.',
  },
  {
    key: 'students',
    eyebrow: 'STUDENT MANAGEMENT',
    title: 'A smarter registration workflow',
    body: 'Principals pre-register students, while Head Teachers complete their records. Built-in conflict protection helps keep shared records consistent.',
  },
  {
    key: 'roles',
    eyebrow: 'SECURE ADMINISTRATION',
    title: 'The right access for every role',
    body: 'Director, Principal and Head Teacher accounts have clearly separated responsibilities, with controlled staff management and auditable actions.',
  },
  {
    key: 'management',
    eyebrow: 'YALAMATRIX SCHOOLS',
    title: 'Meet the Management Team',
    body: 'A quick introduction to the people responsible for guiding and administering the school.',
  },
];

function FingerprintMark() {
  return (
    <View style={styles.fingerprintMark}>
      <View style={styles.fingerprintArc} />
      <View style={[styles.fingerprintArc, styles.fingerprintArc2]} />
      <View style={[styles.fingerprintArc, styles.fingerprintArc3]} />
      <View style={styles.fingerprintDot} />
    </View>
  );
}

function RoleMark() {
  return (
    <View style={styles.roleMark}>
      <View style={styles.roleHead} />
      <View style={styles.roleBody} />
      <View style={styles.roleRow}>
        <View style={styles.roleSmall} />
        <View style={styles.roleSmall} />
        <View style={styles.roleSmall} />
      </View>
    </View>
  );
}

function FeatureVisual({ slideIndex }) {
  if (slideIndex === 1) return <FingerprintMark />;

  if (slideIndex === 4) return <RoleMark />;

  if (slideIndex === 2) {
    return (
      <View style={styles.syncVisual}>
        <View style={styles.syncCard}>
          <Text style={styles.syncCardTitle}>LOCAL</Text>
          <Text style={styles.syncCardText}>Student records</Text>
        </View>

        <Text style={styles.syncArrow}>↔</Text>

        <View style={styles.syncCard}>
          <Text style={styles.syncCardTitle}>SERVER</Text>
          <Text style={styles.syncCardText}>Cloud records</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.workflowVisual}>
      <View style={styles.workflowStep}>
        <Text style={styles.workflowNumber}>1</Text>
        <Text style={styles.workflowLabel}>Pre-register</Text>
      </View>

      <View style={styles.workflowLine} />

      <View style={styles.workflowStep}>
        <Text style={styles.workflowNumber}>2</Text>
        <Text style={styles.workflowLabel}>Complete</Text>
      </View>

      <View style={styles.workflowLine} />

      <View style={styles.workflowStep}>
        <Text style={styles.workflowNumber}>✓</Text>
        <Text style={styles.workflowLabel}>Protected</Text>
      </View>
    </View>
  );
}

function ManagementShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((current) => (current + 1) % MANAGEMENT.length);
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fade.setValue(0);

    Animated.timing(fade, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, fade]);

  const member = MANAGEMENT[activeIndex];

  return (
    <Animated.View style={[styles.managementCard, { opacity: fade }]}>
      <View style={styles.managementAvatar}>
        <Text style={styles.managementInitials}>{member.initials}</Text>
      </View>

      <Text style={styles.managementName}>{member.name}</Text>
      <Text style={styles.managementRole}>{member.role}</Text>

      <View style={styles.managementDots}>
        {MANAGEMENT.map((item, index) => (
          <View
            key={item.name}
            style={[
              styles.managementDot,
              index === activeIndex && styles.managementDotActive,
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const { finishOnboarding } = useAuth();
  const [slideIndex, setSlideIndex] = useState(0);
  const slide = SLIDES[slideIndex];

  const goNext = async () => {
    if (slideIndex === SLIDES.length - 1) {
      await finishOnboarding();
      return;
    }

    setSlideIndex((current) => current + 1);
  };

  const skip = async () => {
    await finishOnboarding();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>YSIS</Text>

          {slideIndex < SLIDES.length - 1 ? (
            <Pressable onPress={skip} hitSlop={10}>
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        <View style={styles.content}>
          {slideIndex === 0 && (
            <View style={styles.welcomeVisual}>
              <Image
                source={require('../../assets/yala-matrix-schools-logo.jpg')}
                style={styles.schoolLogo}
                resizeMode="contain"
              />

              <Image
                source={require('../../assets/samuel-sunday-rankin.png')}
                style={styles.developerPhoto}
                resizeMode="cover"
              />
            </View>
          )}

          {slideIndex > 0 && slideIndex < 5 && (
            <FeatureVisual slideIndex={slideIndex} />
          )}

          {slideIndex === 5 && <ManagementShowcase />}

          <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>

          {slideIndex === 0 && (
            <Text style={styles.credit}>
              Created as a CDS project by Samuel Sunday Rankin, a Corps member
              serving in Yalamatrix Schools, Okitipupa, who studied Pure and
              Applied Chemistry.
            </Text>
          )}
        </View>

        <View style={styles.bottom}>
          <View style={styles.dots}>
            {SLIDES.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.dot,
                  index === slideIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <Pressable style={styles.nextButton} onPress={goNext}>
            <Text style={styles.nextText}>
              {slideIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0d1f33',
  },

  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 18,
  },

  topBar: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  brand: {
    color: '#c9a24b',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },

  skip: {
    color: '#a9b8c8',
    fontSize: 13,
    fontWeight: '600',
  },

  skipPlaceholder: {
    width: 30,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },

  welcomeVisual: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 22,
  },

  schoolLogo: {
    width: Math.min(width - 64, 320),
    height: 150,
    borderRadius: 8,
    backgroundColor: '#fff',
  },

  developerPhoto: {
    width: 112,
    height: 112,
    borderRadius: 56,
    marginTop: -16,
    borderWidth: 4,
    borderColor: '#0d1f33',
  },

  eyebrow: {
    color: '#6fd3c7',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginTop: 4,
    marginBottom: 9,
    textAlign: 'center',
  },

  title: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
    maxWidth: 350,
  },

  body: {
    color: '#a9b8c8',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 350,
    marginTop: 12,
  },

  credit: {
    color: '#d2dbe5',
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    maxWidth: 350,
    marginTop: 14,
  },

  fingerprintMark: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#6fd3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },

  fingerprintArc: {
    position: 'absolute',
    width: 92,
    height: 116,
    borderWidth: 5,
    borderColor: '#c9a24b',
    borderRadius: 48,
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-18deg' }],
  },

  fingerprintArc2: {
    width: 70,
    height: 92,
    borderColor: '#6fd3c7',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '18deg' }],
  },

  fingerprintArc3: {
    width: 42,
    height: 68,
    borderColor: '#c9a24b',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-18deg' }],
  },

  fingerprintDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6fd3c7',
    marginTop: 42,
  },

  syncVisual: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 38,
  },

  syncCard: {
    width: 125,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#31516e',
    backgroundColor: '#122a43',
    alignItems: 'center',
  },

  syncCardTitle: {
    color: '#c9a24b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  syncCardText: {
    color: '#d2dbe5',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },

  syncArrow: {
    color: '#6fd3c7',
    fontSize: 28,
    marginHorizontal: 8,
  },

  workflowVisual: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 48,
  },

  workflowStep: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#122a43',
    borderWidth: 1,
    borderColor: '#31516e',
    alignItems: 'center',
    justifyContent: 'center',
  },

  workflowNumber: {
    color: '#c9a24b',
    fontSize: 22,
    fontWeight: '800',
  },

  workflowLabel: {
    color: '#d2dbe5',
    fontSize: 9.5,
    marginTop: 4,
  },

  workflowLine: {
    width: 24,
    height: 1,
    backgroundColor: '#6fd3c7',
  },

  roleMark: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#122a43',
    borderWidth: 1,
    borderColor: '#31516e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },

  roleHead: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#c9a24b',
    marginBottom: 8,
  },

  roleBody: {
    width: 72,
    height: 34,
    borderRadius: 34,
    backgroundColor: '#6fd3c7',
  },

  roleRow: {
    flexDirection: 'row',
    marginTop: 12,
  },

  roleSmall: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5f7489',
    marginHorizontal: 3,
  },

  managementCard: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 220,
    justifyContent: 'center',
  },

  managementAvatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#16324f',
    borderWidth: 2,
    borderColor: '#c9a24b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  managementInitials: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 1,
  },

  managementName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },

  managementRole: {
    color: '#6fd3c7',
    fontSize: 13,
    marginTop: 5,
    fontWeight: '600',
  },

  managementDots: {
    flexDirection: 'row',
    marginTop: 14,
  },

  managementDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#415a73',
    marginHorizontal: 3,
  },

  managementDotActive: {
    width: 18,
    backgroundColor: '#c9a24b',
  },

  bottom: {
    paddingTop: 12,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#415a73',
    marginHorizontal: 4,
  },

  dotActive: {
    width: 22,
    backgroundColor: '#c9a24b',
  },

  nextButton: {
    backgroundColor: '#c9a24b',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },

  nextText: {
    color: '#0d1f33',
    fontSize: 15,
    fontWeight: '800',
  },
});
