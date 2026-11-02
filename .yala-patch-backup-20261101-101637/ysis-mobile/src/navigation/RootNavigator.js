import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import Skeleton, { SkeletonStudentRow, SkeletonStatCard } from '../components/Skeleton';
import LoginScreen from '../screens/LoginScreen';
import IntroScreen from '../screens/IntroScreen';
import UnlockScreen from '../screens/UnlockScreen';
import ClassStudentsScreen from '../screens/ClassStudentsScreen';
import StudentDetailScreen from '../screens/StudentDetailScreen';
import RegisterStudentScreen from '../screens/RegisterStudentScreen';
import { useTheme } from '../theme/ThemeContext';
import { stackHeaderOptions } from '../theme/stackHeader';
import withScreenHeader from '../components/withScreenHeader';
import MergeQueueScreen from '../screens/MergeQueueScreen';
import CameraCaptureScreen from '../screens/CameraCaptureScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import ManageStaffScreen from '../screens/ManageStaffScreen';
import PromoteClassScreen from '../screens/PromoteClassScreen';
import ForcedPasswordChangeScreen from '../screens/ForcedPasswordChangeScreen';
import PolicyScreen from '../screens/PolicyScreen';
import MainTabs from './MainTabs';
import ParkedOperationsScreen from '../screens/ParkedOperationsScreen';

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
    backgroundColor: '#0E1A2B',
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

// ClassStudents uses the same hero as the Students dashboard (with back button
// when a class is selected). Do not wrap with withScreenHeader — that produced
// a second large title and truncated text.
const StudentDetailWrapped = withScreenHeader(StudentDetailScreen, 'Student');
const MergeQueueWrapped = withScreenHeader(MergeQueueScreen, 'Duplicate Registrations');
const CreateAccountWrapped = withScreenHeader(CreateAccountScreen, 'Create Account');
const ManageStaffWrapped = withScreenHeader(ManageStaffScreen, 'Manage Staff');
const PromoteClassWrapped = withScreenHeader(PromoteClassScreen, 'Promote a class');
const ParkedOperationsWrapped = withScreenHeader(ParkedOperationsScreen, 'Changes not saved');

export default function RootNavigator() {
  const { status } = useAuth();
  const { colors } = useTheme();
  if (status === 'loading') return <AuthBootstrapSkeleton />;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={stackHeaderOptions(colors)}
      >
        {status === 'onboarding' && (
          <Stack.Screen
            name="Onboarding"
            component={IntroScreen}
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

        {status === 'needsPasswordChange' && (
          <Stack.Screen
            name="ForcedPasswordChange"
            component={ForcedPasswordChangeScreen}
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
              name="Intro"
              component={IntroScreen}
              options={{ headerShown: false, presentation: 'fullScreenModal' }}
            />

            <Stack.Screen
              name="ClassStudents"
              component={ClassStudentsScreen}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="StudentDetail"
              component={StudentDetailWrapped}
              options={{ title: 'Student' }}
            />

            <Stack.Screen
              name="RegisterStudent"
              component={RegisterStudentScreen}
              options={{ title: 'Register Student' }}
            />

            <Stack.Screen
              name="MergeQueue"
              component={MergeQueueWrapped}
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
              component={CreateAccountWrapped}
              options={{ title: 'Create Account' }}
            />

            <Stack.Screen
              name="ManageStaff"
              component={ManageStaffWrapped}
              options={{ title: 'Manage Staff' }}
            />

            <Stack.Screen
              name="PromoteClass"
              component={PromoteClassWrapped}
              options={{ title: 'Promote a class' }}
            />
          </>
        )}

        {/* Registered for every status so onboarding can open it too. */}
        <Stack.Screen
          name="Policy"
          component={PolicyScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="ParkedOperations"
          component={ParkedOperationsWrapped}
          options={{ title: 'Changes not saved' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
