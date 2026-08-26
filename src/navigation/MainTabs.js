import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import StudentsListScreen from '../screens/StudentsListScreen';
import ClassesScreen from '../screens/ClassesScreen';
import MoreScreen from '../screens/MoreScreen';
import ConflictBlocker from '../components/ConflictBlocker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';

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

export default function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.inkSoft,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontFamily: fontFamily.heading,
          fontSize: 17,
        },
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={24}
              color={color}
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'school' : 'school-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="RegisterTab"
        component={View}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('RegisterStudent');
          },
        })}
        options={{
          title: 'Register',
          tabBarLabel: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <RegisterTabButton
              onPress={() => props.onPress?.()}
            />
          ),
        }}
      />

      <Tab.Screen
        name="MoreTab"
        component={MoreScreen}
        options={{
          title: 'More',
          tabBarLabel: 'More',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={22}
              color={color}
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
