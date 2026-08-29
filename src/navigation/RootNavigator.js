import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import Skeleton, { SkeletonStudentRow, SkeletonStatCard } from '../components/Skeleton';

import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import UnlockScreen from '../screens/UnlockScreen';
import ClassStudentsScreen from '../screens/ClassStudentsScreen';
import StudentDetailScreen from '../screens/StudentDetailScreen';
import RegisterStudentScreen from '../screens/RegisterStudentScreen';
import MergeQueueScreen from '../screens/MergeQueueScreen';
import CameraCaptureScreen from '../screens/CameraCaptureScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import ManageStaffScreen from '../screens/ManageStaffScreen';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator();

/** Shown while AuthContext resolves SecureStore / biometric status. */
function AuthBootstrapSkeleton() {
  return (
    <View style={bootStyles.root}>
      <View style={bootStyles.hero}>
        <Skeleton width={120} height={12} borderRadius={6} style={{ marginBottom: 12 }} />
        <Skeleton width={180} height={28} borderRadius={8} style={{ marginBottom: 10 }} />
        <Skeleton width={220} height={14} borderRadius={6} />
      </View>
      <View style={bootStyles.body}>
        <View style={bootStyles.stats}>
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </View>
        <SkeletonStudentRow />
        <SkeletonStudentRow />
        <SkeletonStudentRow />
      </View>
    </View>
  );
}

const bootStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F8FC' },
  hero: {
    backgroundColor: '#0A1930',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});

export default function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') return <AuthBootstrapSkeleton />;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#16324f',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: '700',
          },
          headerTitleAlign: 'center',
          headerBackTitleVisible: false,
        }}
      >
        {status === 'onboarding' && (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
        )}

        {status === 'needsFirstLogin' && (
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        )}

        {status === 'needsUnlock' && (
          <Stack.Screen
            name="Unlock"
            component={UnlockScreen}
            options={{ headerShown: false }}
          />
        )}

        {status === 'authenticated' && (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="ClassStudents"
              component={ClassStudentsScreen}
              options={({ route }) => ({
                title: route?.params?.classLevel
                  ? route.params.classLevel + ' Students'
                  : 'Students',
              })}
            />

            <Stack.Screen
              name="StudentDetail"
              component={StudentDetailScreen}
              options={{ title: 'Student' }}
            />

            <Stack.Screen
              name="RegisterStudent"
              component={RegisterStudentScreen}
              options={{ title: 'Register Student' }}
            />

            <Stack.Screen
              name="MergeQueue"
              component={MergeQueueScreen}
              options={{ title: 'Duplicate Registrations' }}
            />

            <Stack.Screen
              name="CameraCapture"
              component={CameraCaptureScreen}
              options={{
                headerShown: false,
                presentation: 'fullScreenModal',
              }}
            />

            <Stack.Screen
              name="CreateAccount"
              component={CreateAccountScreen}
              options={{ title: 'Create Account' }}
            />

            <Stack.Screen
              name="ManageStaff"
              component={ManageStaffScreen}
              options={{ title: 'Manage Staff' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
