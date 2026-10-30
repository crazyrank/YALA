import React, { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import StudentsListScreen from '../screens/StudentsListScreen';
import ClassesScreen from '../screens/ClassesScreen';
import MoreStack from './MoreStack';
import RegisterStudentScreen from '../screens/RegisterStudentScreen';
import ConflictsScreen from '../screens/ConflictsScreen';
import AnimatedTabIcon from '../components/AnimatedTabIcon';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { api } from '../api/client';
import { setConflictCount, useConflictCount } from '../services/conflictBadge';

const Tab = createBottomTabNavigator();

function StudentsTab({ navigation, route }) {
  // Conflicts are handled on the Conflicts tab only — never block the dashboard.
  return <StudentsListScreen navigation={navigation} route={route} />;
}

function RegisterTabButton({ onPress }) {
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
      <View style={styles.registerBtn}>
        <Ionicons name="person-add" size={20} color="#0E1A2B" />
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
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.inkSoft },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 17 },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
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
        component={StudentsTab}
        options={{
          headerShown: false,
          title: 'Yala Matrix Schools',
          tabBarLabel: 'Students',
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
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
        component={ClassesScreen}
        options={{
          headerShown: false,
          title: 'Classes',
          tabBarLabel: 'Classes',
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
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
            tabBarBadgeStyle: { backgroundColor: colors.error },
            tabBarIcon: ({ focused }) => (
              <AnimatedTabIcon
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
            <AnimatedTabIcon
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
  );
}

const styles = StyleSheet.create({
  registerWrap: {
    top: -10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2FA37A',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2FA37A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
});
