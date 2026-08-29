import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

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

export default function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') return null;

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
