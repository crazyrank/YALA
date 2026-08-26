import React from 'react';
import { Pressable, Text, Alert, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import ConflictBlocker from '../components/ConflictBlocker';

import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import UnlockScreen from '../screens/UnlockScreen';
import StudentsListScreen from '../screens/StudentsListScreen';
import ClassStudentsScreen from '../screens/ClassStudentsScreen';
import StudentDetailScreen from '../screens/StudentDetailScreen';
import RegisterStudentScreen from '../screens/RegisterStudentScreen';
import ConflictsScreen from '../screens/ConflictsScreen';
import MergeQueueScreen from '../screens/MergeQueueScreen';
import CameraCaptureScreen from '../screens/CameraCaptureScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import ManageStaffScreen from '../screens/ManageStaffScreen';
import ClassesScreen from '../screens/ClassesScreen';

const Stack = createNativeStackNavigator();

function DashboardHome({ navigation, route }) {
  const { user } = useAuth();
  const isAdmin =
    user?.role === 'principal' || user?.role === 'director';

  if (isAdmin) {
    return (
      <ConflictBlocker navigation={navigation}>
        <StudentsListScreen navigation={navigation} route={route} />
      </ConflictBlocker>
    );
  }

  return <StudentsListScreen navigation={navigation} route={route} />;
}

function AddStaffButton({ navigation }) {
  const { user } = useAuth();

  const canCreate =
    user?.role === 'director' || user?.role === 'principal';

  if (!canCreate) return null;

  return (
    <Pressable
      onPress={() => navigation.navigate('ManageStaff')}
      hitSlop={12}
      style={styles.addStaffButton}
    >
      <Text style={styles.addStaffText}>Staff</Text>
    </Pressable>
  );
}

function HeaderActions({ navigation }) {
  return (
    <>
      <AddStaffButton navigation={navigation} />
      <LogoutButton />
    </>
  );
}

function LogoutButton() {
  const { logout } = useAuth();

  const confirmLogout = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  return (
    <Pressable
      onPress={confirmLogout}
      hitSlop={12}
      style={styles.logoutButton}
    >
      <Text style={styles.logoutText}>Sign out</Text>
    </Pressable>
  );
}

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
              name="Students"
              component={DashboardHome}
              options={({ navigation, route }) => ({
                title: route?.params?.classLevel
                  ? `${route.params.classLevel} Students`
                  : 'Students',
                headerRight: () => (
                  <HeaderActions navigation={navigation} />
                ),
              })}
            />

            <Stack.Screen
              name="ClassStudents"
              component={ClassStudentsScreen}
              options={({ route }) => ({
                title: route?.params?.classLevel
                  ? route.params.classLevel + " Students"
                  : "Students",
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
              name="Conflicts"
              component={ConflictsScreen}
              options={{ title: 'Conflicts' }}
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

            <Stack.Screen
              name="Classes"
              component={ClassesScreen}
              options={{ title: 'Classes' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    marginRight: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  logoutText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  addStaffButton: {
    flexDirection: 'row',
    marginRight: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  addStaffText: {
    color: '#c9a24b',
    fontSize: 13,
    fontWeight: '700',
  },
});
