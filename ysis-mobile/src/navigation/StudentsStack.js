import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StudentsListScreen from '../screens/StudentsListScreen';
import StudentDetailScreen from '../screens/StudentDetailScreen';
import ClassStudentsScreen from '../screens/ClassStudentsScreen';
import RegisterStudentScreen from '../screens/RegisterStudentScreen';
import PromoteClassScreen from '../screens/PromoteClassScreen';
import ParkedOperationsScreen from '../screens/ParkedOperationsScreen';
import { useTheme } from '../theme/ThemeContext';
import { stackHeaderOptions } from '../theme/stackHeader';
import withScreenHeader from '../components/withScreenHeader';

const Stack = createNativeStackNavigator();

const StudentDetailWrapped = withScreenHeader(StudentDetailScreen, 'Student');
const PromoteClassWrapped = withScreenHeader(PromoteClassScreen, 'Promote a class');
const ParkedOperationsWrapped = withScreenHeader(ParkedOperationsScreen, 'Changes not saved');

/**
 * Students tab stack — keeps the bottom tab bar visible on detail screens
 * (Student, Promote, Register, Class list, Parked ops).
 */
export default function StudentsStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator screenOptions={stackHeaderOptions(colors)}>
      <Stack.Screen
        name="StudentsHome"
        component={StudentsListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="StudentDetail"
        component={StudentDetailWrapped}
        options={{ title: 'Student', headerShown: false }}
      />
      <Stack.Screen
        name="ClassStudents"
        component={ClassStudentsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RegisterStudent"
        component={RegisterStudentScreen}
        options={{ title: 'Register Student', headerShown: false }}
      />
      <Stack.Screen
        name="PromoteClass"
        component={PromoteClassWrapped}
        options={{ title: 'Promote a class', headerShown: false }}
      />
      <Stack.Screen
        name="ParkedOperations"
        component={ParkedOperationsWrapped}
        options={{ title: 'Changes not saved', headerShown: false }}
      />
    </Stack.Navigator>
  );
}
