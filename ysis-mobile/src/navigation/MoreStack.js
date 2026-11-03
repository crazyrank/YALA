import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MoreScreen from '../screens/MoreScreen';
import ManageStaffScreen from '../screens/ManageStaffScreen';
import MergeQueueScreen from '../screens/MergeQueueScreen';
import StaffDirectoryScreen from '../screens/StaffDirectoryScreen';
import AddDirectoryEntryScreen from '../screens/AddDirectoryEntryScreen';
import ImportStudentsScreen from '../screens/ImportStudentsScreen';
import DeviceReviewScreen from '../screens/DeviceReviewScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ResultPortalScreen from '../screens/ResultPortalScreen';
import SchoolWebsiteScreen from '../screens/SchoolWebsiteScreen';
import WebPageScreen from '../screens/WebPageScreen';
import CreateAccountScreen from '../screens/CreateAccountScreen';
import GuestAccountsScreen from '../screens/GuestAccountsScreen';
import PromoteClassScreen from '../screens/PromoteClassScreen';
import StudentDetailScreen from '../screens/StudentDetailScreen';
import { useTheme } from '../theme/ThemeContext';
import { stackHeaderOptions } from '../theme/stackHeader';
import withScreenHeader from '../components/withScreenHeader';

const Stack = createNativeStackNavigator();

const ManageStaffWrapped = withScreenHeader(ManageStaffScreen, 'Manage Staff');
const MergeQueueWrapped = withScreenHeader(MergeQueueScreen, 'Duplicate Registrations');
const StaffDirectoryWrapped = withScreenHeader(StaffDirectoryScreen, 'Staff Directory');
const AddDirectoryEntryWrapped = withScreenHeader(AddDirectoryEntryScreen, 'Directory Card');
const ImportStudentsWrapped = withScreenHeader(ImportStudentsScreen, 'Import Students');
const DeviceReviewWrapped = withScreenHeader(DeviceReviewScreen, 'Trusted Devices');
const NotificationsWrapped = withScreenHeader(NotificationsScreen, 'Notifications');
const CreateAccountWrapped = withScreenHeader(CreateAccountScreen, 'Create Account');
const GuestAccountsWrapped = withScreenHeader(GuestAccountsScreen, 'Guest Accounts');
const PromoteClassWrapped = withScreenHeader(PromoteClassScreen, 'Promote a class');
const StudentDetailWrapped = withScreenHeader(StudentDetailScreen, 'Student');

export default function MoreStack() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator screenOptions={stackHeaderOptions(colors)}>
      <Stack.Screen
        name="MoreHome"
        component={MoreScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ManageStaff"
        component={ManageStaffWrapped}
        options={{ title: 'Manage Staff' }}
      />
      <Stack.Screen
        name="GuestAccounts"
        component={GuestAccountsWrapped}
        options={{ title: 'Guest Accounts' }}
      />
      <Stack.Screen
        name="CreateAccount"
        component={CreateAccountWrapped}
        options={{ title: 'Create Account' }}
      />
      <Stack.Screen
        name="MergeQueue"
        component={MergeQueueWrapped}
        options={{ title: 'Duplicate Registrations' }}
      />
      <Stack.Screen
        name="StaffDirectory"
        component={StaffDirectoryWrapped}
        options={{ title: 'Staff Directory' }}
      />
      <Stack.Screen
        name="AddDirectoryEntry"
        component={AddDirectoryEntryWrapped}
        options={{ title: 'Directory Card' }}
      />
      <Stack.Screen
        name="ImportStudents"
        component={ImportStudentsWrapped}
        options={{ title: 'Import Students' }}
      />
      <Stack.Screen
        name="DeviceReview"
        component={DeviceReviewWrapped}
        options={{ title: 'Trusted Devices' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsWrapped}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="PromoteClass"
        component={PromoteClassWrapped}
        options={{ title: 'Promote a class' }}
      />
      <Stack.Screen
        name="StudentDetail"
        component={StudentDetailWrapped}
        options={{ title: 'Student' }}
      />
      <Stack.Screen
        name="ResultPortal"
        component={ResultPortalScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SchoolWebsite"
        component={SchoolWebsiteScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="WebPage"
        component={WebPageScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
