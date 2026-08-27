import React, { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import StudentsListScreen from '../screens/StudentsListScreen';
import ClassesScreen from '../screens/ClassesScreen';
import MoreScreen from '../screens/MoreScreen';
import RegisterStudentScreen from '../screens/RegisterStudentScreen';
import ConflictsScreen from '../screens/ConflictsScreen';
import ConflictBlocker from '../components/ConflictBlocker';
import AnimatedTabIcon from '../components/AnimatedTabIcon';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';
import { api } from '../api/client';

const Tab = createBottomTabNavigator();

function StudentsTab({ navigation, route }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'principal' || user?.role === 'director';

  if (isAdmin) {
    return (
      <ConflictBlocker navigation={navigation}>
        <StudentsListScreen navigation={navigation} route={route} />
      </ConflictBlocker>
    );
  }
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
        <Ionicons name="add" size={30} color="#0A1930" />
      </View>
    </Pressable>
  );
}

function useOpenConflictCount(enabled) {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      let cancelled = false;

      api
        .get('/conflicts?status=open')
        .then((res) => {
          if (!cancelled) setCount(res.conflicts?.length || 0);
        })
        .catch(() => {
          if (!cancelled) setCount(0);
        });

      return () => {
        cancelled = true;
      };
    }, [enabled])
  );

  return count;
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
        component={MoreScreen}
        options={{
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
    top: -14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#C9A24B',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#C9A24B',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
});
