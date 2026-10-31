import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { useConflictCount } from '../services/conflictBadge';

// Screens that must NOT show this footer: MainTabs already has its own bar,
// the rest are full-screen experiences.
const HIDE_ON = ['MainTabs', 'Intro', 'CameraCapture', 'Policy'];

// Hide the footer while the keyboard is open so it never covers a form.
function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!KeyboardEvents) return undefined;
    const show = KeyboardEvents.addListener('keyboardWillShow', () => setVisible(true));
    const hide = KeyboardEvents.addListener('keyboardWillHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}

function FooterItem({ icon, label, onPress, color, badge, colors }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View>
        <Ionicons name={icon} size={22} color={color} />
        {badge > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function GlobalFooter({ navigationRef, routeName }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const keyboardVisible = useKeyboardVisible();
  const conflictCount = useConflictCount();
  const isAdmin = user?.role === 'principal' || user?.role === 'director';

  if (!routeName || HIDE_ON.includes(routeName) || keyboardVisible) return null;

  // Go back to the main tabs and pick the tab. popTo removes the screens on
  // top, so the back button never has to be pressed repeatedly afterwards.
  const goTab = (params) => {
    Haptics.selectionAsync().catch(() => {});
    if (navigationRef?.isReady()) {
      navigationRef.dispatch(StackActions.popTo('MainTabs', params));
    }
  };

  const onRegister = () => {
    // Already on the registration form: do nothing, so typed data is never lost.
    if (routeName === 'RegisterStudent') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (navigationRef?.isReady()) {
      navigationRef.dispatch(StackActions.popTo('MainTabs', { screen: 'RegisterTab' }));
    }
  };

  const muted = colors.textMuted;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.bar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <FooterItem
          icon="people-outline"
          label="Students"
          color={muted}
          colors={colors}
          onPress={() => goTab({ screen: 'StudentsTab' })}
        />
        <FooterItem
          icon="school-outline"
          label="Classes"
          color={muted}
          colors={colors}
          onPress={() => goTab({ screen: 'ClassesTab' })}
        />
        {isAdmin && (
          <FooterItem
            icon="warning-outline"
            label="Conflicts"
            color={muted}
            colors={colors}
            badge={conflictCount}
            onPress={() => goTab({ screen: 'ConflictsTab' })}
          />
        )}

        <Pressable
          onPress={onRegister}
          style={styles.item}
          accessibilityRole="button"
          accessibilityLabel="Register student"
        >
          <View style={[styles.registerBtn, { backgroundColor: colors.brand }]}>
            <Ionicons name="person-add" size={18} color={colors.ink} />
          </View>
        </Pressable>

        <FooterItem
          icon="grid-outline"
          label="More"
          color={muted}
          colors={colors}
          onPress={() => goTab({ screen: 'MoreTab', params: { screen: 'MoreHome' } })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 6,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 28,
    marginHorizontal: 12,
    marginBottom: Platform.OS === 'ios' ? 24 : 12,
    height: Platform.OS === 'ios' ? 84 : 70,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
      android: { elevation: 10 },
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fontFamily.bodySemibold,
    fontSize: 11,
    marginTop: 3,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  registerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.22,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
});
