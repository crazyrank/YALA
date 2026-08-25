import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { gradients } from '../theme/colors';
import { createOnboardingStyles, SCREEN_WIDTH } from './OnboardingStyles';

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
    body: 'A Corps member who served at Yalamatrix Schools, holding a B.Sc. in Pure and Applied Chemistry from the University of Uyo, built YALA and presented it to the school as his NYSC Community Development Service project.',
  },
  {
    id: 'purpose',
    eyebrow: 'BUILT FOR YALAMATRIX SCHOOLS',
    title: 'School management, simplified.',
    body: 'YALA brings student information, academic records, attendance and administration together in one focused offline experience.',
  },
];

const PURPOSE_ITEMS = [
  { icon: 'users', title: 'STUDENTS', text: 'Organized student information' },
  { icon: 'book-open', title: 'ACADEMICS', text: 'Records that stay accessible' },
  { icon: 'wifi-off', title: 'OFFLINE', text: 'Work without depending on internet' },
];

export default function OnboardingScreen() {
  const { finishOnboarding } = useAuth();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createOnboardingStyles(colors), [colors]);

  const [index, setIndex] = useState(0);
  const scrollRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const goToIndex = (target) => {
    scrollRef.current?.scrollTo({ x: target * SCREEN_WIDTH, animated: true });
    setIndex(target);
  };

  const finish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await finishOnboarding();
  };

  const next = async () => {
    if (index === SLIDES.length - 1) {
      await finish();
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    goToIndex(index + 1);
  };

  const skip = async () => {
    await finish();
  };

  const onMomentumScrollEnd = (event) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / SCREEN_WIDTH
    );
    setIndex(nextIndex);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>YALA</Text>
            <Text style={styles.logoSubtitle}>SCHOOL INFORMATION SYSTEM</Text>
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

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          style={styles.pager}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
        >
          <View style={styles.page}>
            <View style={styles.heroWrap}>
              <LinearGradient
                colors={gradients.navy}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroGlow}
              />

              <View style={styles.heroFrame}>
                <Image
                  source={require('../../assets/samuel-sunday-rankin.png')}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              </View>

              <LinearGradient
                colors={gradients.gold}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroBadge}
              >
                <Text style={styles.heroBadgeSmall}>BUILT WITH PURPOSE</Text>
                <Text style={styles.heroBadgeMain}>YALA</Text>
              </LinearGradient>
            </View>

            <View style={styles.eyebrowChip}>
              <Text style={styles.eyebrowText}>{SLIDES[0].eyebrow}</Text>
            </View>

            <Text style={styles.title}>{SLIDES[0].title}</Text>
            <Text style={styles.body}>{SLIDES[0].body}</Text>
          </View>

          <View style={styles.page}>
            <View style={styles.creatorWrap}>
              <LinearGradient
                colors={gradients.gold}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                <View style={styles.avatarInner}>
                  <Image
                    source={require('../../assets/samuel-sunday-rankin.png')}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                </View>
              </LinearGradient>

              <Text style={styles.creatorName}>SAMUEL SUNDAY RANKIN</Text>
              <Text style={styles.creatorCreds}>
                B.SC. PURE & APPLIED CHEMISTRY • UNIVERSITY OF UYO
              </Text>
            </View>

            <View style={styles.eyebrowChip}>
              <Text style={styles.eyebrowText}>{SLIDES[1].eyebrow}</Text>
            </View>

            <Text style={styles.title}>{SLIDES[1].title}</Text>
            <Text style={styles.body}>{SLIDES[1].body}</Text>

            <View style={styles.cdsCard}>
              <View style={styles.cdsIcon}>
                <Feather name="award" size={16} color={colors.goldDark} />
              </View>

              <View style={styles.cdsTextWrap}>
                <Text style={styles.cdsTitle}>
                  NYSC COMMUNITY DEVELOPMENT SERVICE
                </Text>
                <Text style={styles.cdsText}>
                  Developed while serving as a Corps member at Yalamatrix
                  Schools, Okitipupa, and presented to the school as a
                  practical contribution toward digital school
                  administration.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.page}>
            <View style={styles.purposeWrap}>
              {PURPOSE_ITEMS.map((item) => (
                <View key={item.title} style={styles.purposeCard}>
                  <LinearGradient
                    colors={gradients.navy}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.purposeIcon}
                  >
                    <Feather name={item.icon} size={19} color={colors.textInverse} />
                  </LinearGradient>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.purposeTitle}>{item.title}</Text>
                    <Text style={styles.purposeText}>{item.text}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.eyebrowChip}>
              <Text style={styles.eyebrowText}>{SLIDES[2].eyebrow}</Text>
            </View>

            <Text style={styles.title}>{SLIDES[2].title}</Text>
            <Text style={styles.body}>{SLIDES[2].body}</Text>
          </View>
        </Animated.ScrollView>

        <View style={styles.footer}>
          <View style={styles.dotsRow}>
            {SLIDES.map((slide, i) => (
              <View
                key={slide.id}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>

          <Pressable
            onPress={next}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <LinearGradient
              colors={gradients.navy}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            />

            <Text style={styles.ctaText}>
              {index === SLIDES.length - 1 ? 'Enter YALA' : 'Continue'}
            </Text>

            <View style={styles.arrowCircle}>
              <Feather name="arrow-right" size={16} color={colors.textInverse} />
            </View>
          </Pressable>

          <Text style={styles.footerCaption}>
            Offline-first • Private • Yalamatrix Schools
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
