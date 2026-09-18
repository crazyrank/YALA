import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MoreScreen from '../screens/MoreScreen';
import ManageStaffScreen from '../screens/ManageStaffScreen';
import MergeQueueScreen from '../screens/MergeQueueScreen';
import StaffDirectoryScreen from '../screens/StaffDirectoryScreen';
import AddDirectoryEntryScreen from '../screens/AddDirectoryEntryScreen';
import { useTheme } from '../theme/ThemeContext';
import { fontFamily } from '../theme/typography';

const Stack = createNativeStackNavigator();

export default function MoreStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.inkSoft },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: fontFamily.heading, fontSize: 17 },
      }}
    >
      <Stack.Screen
        name="MoreHome"
        component={MoreScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ManageStaff"
        component={ManageStaffScreen}
        options={{ title: 'Manage Staff' }}
      />
      <Stack.Screen
        name="MergeQueue"
        component={MergeQueueScreen}
        options={{ title: 'Duplicate Registrations' }}
      />
      <Stack.Screen
        name="StaffDirectory"
        component={StaffDirectoryScreen}
        options={{ title: 'Staff Directory' }}
      />
      <Stack.Screen
        name="AddDirectoryEntry"
        component={AddDirectoryEntryScreen}
        options={{ title: 'Directory Card' }}
      />
    </Stack.Navigator>
  );
}
