import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: 'welcome',
    eyebrow: 'YALAMATRIX SCHOOL INFORMATION SYSTEM',
    title: 'Welcome to YALA.',
    body: 'A thoughtful, offline-first system created to make school information easier to manage.',
  },
  {
    id: 'creator',
    eyebrow: 'THE STORY BEHIND YALA',
    title: 'Built by Samuel Sunday Rankin.',
    body: 'A B.Sc. Chemistry graduate of the University of Uyo, Uyo, Akwa Ibom State, created YALA as an NYSC Community Development Service project.',
  },
  {
    id: 'purpose',
    eyebrow: 'BUILT FOR YALAMATRIX SCHOOLS',
    title: 'School management, simplified.',
    body: 'YALA brings student information, academic records, attendance and administration together in one focused offline experience.',
  },
];

export default function OnboardingScreen() {
  const { finishOnboarding } = useAuth();

  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const finish = async () => {
    await finishOnboarding();
  };

  const next = async () => {
    if (index === SLIDES.length - 1) {
      await finish();
      return;
    }

    setIndex((current) => current + 1);
  };

  const skip = async () => {
    await finish();
  };

  const slide = SLIDES[index];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F6F7F9"
      />

      <View style={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>YALA</Text>
            <Text style={styles.logoSubtitle}>
              SCHOOL INFORMATION SYSTEM
            </Text>
          </View>

          {index < SLIDES.length - 1 && (
            <Pressable
              onPress={skip}
              hitSlop={12}
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
        </View>

        {/* MAIN */}
        <Animated.View
          style={styles.main}
        >

          {/* HERO IMAGE */}
          {index === 0 && (
            <View style={styles.heroArea}>
              <View style={styles.heroBackground} />

              <View style={styles.imageFrame}>
                <Image
                  source={require('../../assets/samuel-sunday-rankin.png')}
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              </View>

              <View style={styles.imageBadge}>
                <Text style={styles.imageBadgeSmall}>
                  BUILT WITH PURPOSE
                </Text>
                <Text style={styles.imageBadgeMain}>
                  YALA
                </Text>
              </View>
            </View>
          )}

          {/* CREATOR VISUAL */}
          {index === 1 && (
            <View style={styles.creatorVisual}>
              <View style={styles.creatorCircle}>
                <Text style={styles.creatorInitial}>SR</Text>
              </View>

              <View style={styles.creatorLine} />

              <Text style={styles.creatorLabel}>
                SAMUEL SUNDAY RANKIN
              </Text>

              <Text style={styles.creatorSubLabel}>
                B.Sc. CHEMISTRY • UNIVERSITY OF UYO
              </Text>
            </View>
          )}

          {/* PURPOSE VISUAL */}
          {index === 2 && (
            <View style={styles.purposeVisual}>
              <View style={styles.purposeCard}>
                <Text style={styles.purposeNumber}>01</Text>
                <Text style={styles.purposeTitle}>
                  STUDENTS
                </Text>
                <Text style={styles.purposeText}>
                  Organized student information
                </Text>
              </View>

              <View style={styles.purposeCard}>
                <Text style={styles.purposeNumber}>02</Text>
                <Text style={styles.purposeTitle}>
                  ACADEMICS
                </Text>
                <Text style={styles.purposeText}>
                  Records that stay accessible
                </Text>
              </View>

              <View style={styles.purposeCard}>
                <Text style={styles.purposeNumber}>03</Text>
                <Text style={styles.purposeTitle}>
                  OFFLINE
                </Text>
                <Text style={styles.purposeText}>
                  Work without depending on internet
                </Text>
              </View>
            </View>
          )}

          {/* TEXT */}
          <View style={styles.textArea}>
            <Text style={styles.eyebrow}>
              {slide.eyebrow}
            </Text>

            <Text style={styles.title}>
              {slide.title}
            </Text>

            <Text style={styles.body}>
              {slide.body}
            </Text>

            {index === 1 && (
              <View style={styles.cdsNote}>
                <Text style={styles.cdsTitle}>
                  NYSC COMMUNITY DEVELOPMENT SERVICE
                </Text>

                <Text style={styles.cdsText}>
                  Developed during service at Yalamatrix Schools,
                  Okitipupa, as a practical contribution toward
                  digital school administration.
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* FOOTER */}
        <View style={styles.footer}>

          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: `${((index + 1) / SLIDES.length) * 100}%`,
                  },
                ]}
              />
            </View>

            <Text style={styles.progressText}>
              0{index + 1} / 0{SLIDES.length}
            </Text>
          </View>

          <Pressable
            onPress={next}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>
              {index === SLIDES.length - 1
                ? 'Enter YALA'
                : 'Continue'}
            </Text>

            <Text style={styles.arrow}>
              →
            </Text>
          </Pressable>

          <Text style={styles.footerText}>
            Offline-first • Private • Yalamatrix Schools
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },

  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
    paddingHorizontal: 24,
  },

  header: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  logo: {
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#101828',
  },

  logoSubtitle: {
    marginTop: 3,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#98A2B3',
  },

  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },

  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667085',
  },

  pressed: {
    opacity: 0.5,
  },

  main: {
    flex: 1,
    justifyContent: 'center',
  },

  heroArea: {
    height: height * 0.43,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 24,
  },

  heroBackground: {
    position: 'absolute',
    width: width * 0.76,
    height: height * 0.36,
    borderRadius: 42,
    backgroundColor: '#E9EDF2',
    transform: [{ rotate: '-4deg' }],
  },

  imageFrame: {
    width: width * 0.68,
    height: height * 0.40,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: '#DDE2E8',
  },

  profileImage: {
    width: '100%',
    height: '100%',
  },

  imageBadge: {
    position: 'absolute',
    right: width * 0.05,
    bottom: 8,
    backgroundColor: '#101828',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },

  imageBadgeSmall: {
    color: '#98A2B3',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.3,
  },

  imageBadgeMain: {
    marginTop: 2,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },

  creatorVisual: {
    height: height * 0.34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },

  creatorCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#101828',
    alignItems: 'center',
    justifyContent: 'center',
  },

  creatorInitial: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 2,
  },

  creatorLine: {
    width: 1,
    height: 46,
    backgroundColor: '#D0D5DD',
    marginTop: 12,
  },

  creatorLabel: {
    marginTop: 12,
    color: '#101828',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },

  creatorSubLabel: {
    marginTop: 6,
    color: '#98A2B3',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  purposeVisual: {
    height: height * 0.34,
    justifyContent: 'center',
    marginBottom: 28,
  },

  purposeCard: {
    minHeight: 62,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
  },

  purposeNumber: {
    width: 36,
    fontSize: 11,
    fontWeight: '900',
    color: '#98A2B3',
  },

  purposeTitle: {
    width: 75,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#101828',
  },

  purposeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#667085',
  },

  textArea: {
    paddingHorizontal: 2,
  },

  eyebrow: {
    color: '#667085',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 10,
  },

  title: {
    color: '#101828',
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '850',
    letterSpacing: -0.8,
  },

  body: {
    marginTop: 12,
    color: '#667085',
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 370,
  },

  cdsNote: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E4E7EC',
  },

  cdsTitle: {
    color: '#101828',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  cdsText: {
    marginTop: 5,
    color: '#667085',
    fontSize: 10.5,
    lineHeight: 16,
  },

  footer: {
    paddingBottom: 18,
    paddingTop: 16,
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 13,
  },

  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4E7EC',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#101828',
    borderRadius: 2,
  },

  progressText: {
    marginLeft: 12,
    fontSize: 10,
    fontWeight: '800',
    color: '#98A2B3',
  },

  button: {
    height: 56,
    borderRadius: 17,
    backgroundColor: '#101828',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  arrow: {
    marginLeft: 12,
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '300',
  },

  footerText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 9,
    color: '#98A2B3',
    letterSpacing: 0.2,
  },
});
