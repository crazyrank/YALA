import React, { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import MoreStack from './MoreStack';
import StudentsStack from './StudentsStack';
import ClassesStack from './ClassesStack';
import RegisterStudentScreen from '../screens/RegisterStudentScreen';
import ConflictsScreen from '../screens/ConflictsScreen';
import AnimatedTabIcon from '../components/AnimatedTabIcon';
import FooterBorder from '../components/FooterBorder';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { api } from '../api/client';
import { setConflictCount, useConflictCount } from '../services/conflictBadge';

const Tab = createBottomTabNavigator();

function withAlpha(hex, alpha, fallback) {
  if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex)) {
    return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }
  return fallback;
}

// Soft pill behind the active tab icon (WhatsApp / Telegram style).
function PillIcon(props) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 56,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: props.focused
          ? withAlpha(colors.gold, 0.18, colors.border)
          : 'transparent',
      }}
    >
      <AnimatedTabIcon {...props} />
    </View>
  );
}

function RegisterTabButton({ onPress }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress?.();
      }}
      style={styles.registerWrap}
      accessibilityRole="button"
      accessibilityLabel="Register student"
    >
      <View
        style={[
          styles.registerBtn,
          { backgroundColor: colors.brand },
        ]}
      >
        <Ionicons name="person-add" size={18} color={colors.ink} />
      </View>
    </Pressable>
  );
}

function useOpenConflictCount(enabled) {
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      let cancelled = false;

      api
        .get('/conflicts?status=open')
        .then((res) => {
          if (!cancelled) setConflictCount(res.conflicts?.length || 0);
        })
        .catch(() => {
          if (!cancelled) setConflictCount(0);
        });

      return () => {
        cancelled = true;
      };
    }, [enabled])
  );

  return useConflictCount();
}

export default function MainTabs() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const isAdmin = user?.role === 'principal' || user?.role === 'director';
  const openConflictCount = useOpenConflictCount(isAdmin);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background ?? colors.inkSoft }} testID="footerBgWrap">
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.inkSoft },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 17 },
        tabBarBackground: () => <FooterBorder />,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
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
        tabBarLabelStyle: {
          fontFamily: fontFamily.bodySemibold,
          fontSize: 11,
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="StudentsTab"
        component={StudentsStack}
        options={{
          headerShown: false,
          title: 'Yala Matrix Schools',
          tabBarLabel: 'Students',
          tabBarIcon: ({ focused }) => (
            <PillIcon
              focused={focused}
              activeName="people"
              inactiveName="people-outline"
              activeColor={colors.gold}
              inactiveColor={colors.textMuted}
              size={24}
            />
          ),
        }}
      />

      <Tab.Screen
        name="ClassesTab"
        component={ClassesStack}
        options={{
          headerShown: false,
          title: 'Classes',
          tabBarLabel: 'Classes',
          tabBarIcon: ({ focused }) => (
            <PillIcon
              focused={focused}
              activeName="school"
              inactiveName="school-outline"
              activeColor={colors.gold}
              inactiveColor={colors.textMuted}
              size={24}
            />
          ),
        }}
      />

      {isAdmin && (
        <Tab.Screen
          name="ConflictsTab"
          component={ConflictsScreen}
          options={{
            headerShown: false,
            title: 'Conflicts',
            tabBarLabel: 'Conflicts',
            tabBarBadge: openConflictCount > 0 ? openConflictCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: colors.error,
              color: '#FFFFFF',
              fontSize: 11,
              fontWeight: '700',
              minWidth: 18,
              height: 18,
              lineHeight: 16,
            },
            tabBarIcon: ({ focused }) => (
              <PillIcon
                focused={focused}
                activeName="warning"
                inactiveName="warning-outline"
                activeColor={colors.warning}
                inactiveColor={colors.textMuted}
                size={22}
              />
            ),
          }}
        />
      )}

      {isAdmin && (
      <Tab.Screen
        name="RegisterTab"
        component={RegisterStudentScreen}
        options={{
          headerShown: false,
          title: 'Register Student',
          tabBarLabel: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <RegisterTabButton onPress={props.onPress} />
          ),
        }}
      />
      )}

      <Tab.Screen
        name="MoreTab"
        component={MoreStack}
        listeners={({ navigation }) => ({
          tabPress: () => {
            // Always land on the More menu. If a sub-screen (School Website,
            // Result Portal, Import...) was opened from elsewhere, clear it.
            const moreRoute = navigation.getState().routes.find((r) => r.name === 'MoreTab');
            const nested = moreRoute && moreRoute.state;
            if (nested && nested.key) {
              const onMenuOnly = nested.routes.length === 1 && nested.routes[0].name === 'MoreHome';
              if (!onMenuOnly) {
                navigation.dispatch({
                  ...CommonActions.reset({ index: 0, routes: [{ name: 'MoreHome' }] }),
                  target: nested.key,
                });
              }
            }
          },
        })}
        options={{
          headerShown: false,
          title: 'More',
          tabBarLabel: 'More',
          tabBarIcon: ({ focused }) => (
            <PillIcon
              focused={focused}
              activeName="grid"
              inactiveName="grid-outline"
              activeColor={colors.gold}
              inactiveColor={colors.textMuted}
              size={22}
            />
          ),
        }}
      />
    </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  registerWrap: {
    // Small lift only — keeps the circle inside the tab bar so the top
    // stroke stays fully visible in light mode.
    top: -4,
    justifyContent: 'center',
    alignItems: 'center',
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
