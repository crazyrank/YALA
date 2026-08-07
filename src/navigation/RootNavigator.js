import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import ConflictBlocker from '../components/ConflictBlocker';

import LoginScreen from '../screens/LoginScreen';
import UnlockScreen from '../screens/UnlockScreen';
import StudentsListScreen from '../screens/StudentsListScreen';
import StudentDetailScreen from '../screens/StudentDetailScreen';
import RegisterStudentScreen from '../screens/RegisterStudentScreen';
import ConflictsScreen from '../screens/ConflictsScreen';
import MergeQueueScreen from '../screens/MergeQueueScreen';
import CameraCaptureScreen from '../screens/CameraCaptureScreen';

const Stack = createNativeStackNavigator();

/**
 * The blocking conflict check (Build Spec Section 17, locked decision:
 * "blocking. An open conflict stops the Principal from moving on to
 * other dashboard actions") only applies to Principal/Director — a Head
 * Teacher's dashboard is never blocked by conflicts they have no
 * authority to resolve anyway.
 */
function DashboardHome({ navigation }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'principal' || user?.role === 'director';

  if (isAdmin) {
    return (
      <ConflictBlocker navigation={navigation}>
        <StudentsListScreen navigation={navigation} />
      </ConflictBlocker>
    );
  }
  return <StudentsListScreen navigation={navigation} />;
}

export default function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') return null; // could render a splash screen here

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#16324f' }, headerTintColor: '#fff' }}>
        {status === 'needsFirstLogin' && (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
        {status === 'needsUnlock' && (
          <Stack.Screen name="Unlock" component={UnlockScreen} options={{ headerShown: false }} />
        )}
        {status === 'authenticated' && (
          <>
            <Stack.Screen name="Students" component={DashboardHome} options={{ title: 'Students' }} />
            <Stack.Screen name="StudentDetail" component={StudentDetailScreen} options={{ title: 'Student' }} />
            <Stack.Screen name="RegisterStudent" component={RegisterStudentScreen} options={{ title: 'Register Student' }} />
            <Stack.Screen name="Conflicts" component={ConflictsScreen} options={{ title: 'Conflicts' }} />
            <Stack.Screen name="MergeQueue" component={MergeQueueScreen} options={{ title: 'Duplicate Registrations' }} />
            <Stack.Screen name="CameraCapture" component={CameraCaptureScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
