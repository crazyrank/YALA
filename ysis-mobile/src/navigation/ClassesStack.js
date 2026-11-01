import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ClassesScreen from '../screens/ClassesScreen';
import ClassStudentsScreen from '../screens/ClassStudentsScreen';
import StudentDetailScreen from '../screens/StudentDetailScreen';
import { useTheme } from '../theme/ThemeContext';
import { stackHeaderOptions } from '../theme/stackHeader';
import withScreenHeader from '../components/withScreenHeader';

const Stack = createNativeStackNavigator();

const StudentDetailWrapped = withScreenHeader(StudentDetailScreen, 'Student');

/**
 * Classes tab stack — Class list → class cohort → student detail
 * all keep the bottom tab bar visible.
 */
export default function ClassesStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator screenOptions={stackHeaderOptions(colors)}>
      <Stack.Screen
        name="ClassesHome"
        component={ClassesScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ClassStudents"
        component={ClassStudentsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="StudentDetail"
        component={StudentDetailWrapped}
        options={{ title: 'Student', headerShown: false }}
      />
    </Stack.Navigator>
  );
}
