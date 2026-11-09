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
import LeaversScreen from '../screens/LeaversScreen';
import PasswordResetScreen from '../screens/PasswordResetScreen';
import PasswordResetScreen from '../screens/PasswordResetScreen';
import StudentsByStatusScreen from '../screens/StudentsByStatusScreen';
import BiodataApprovalScreen from '../screens/BiodataApprovalScreen';
import ClassTeachersScreen from '../screens/ClassTeachersScreen';
import CreateClassTeacherScreen from '../screens/CreateClassTeacherScreen';
import LogBookScreen from '../screens/LogBookScreen';
import PersonalLogScreen from '../screens/PersonalLogScreen';
import BlackBookScreen from '../screens/BlackBookScreen';
import AlumniScreen from '../screens/AlumniScreen';
import StaffReportsScreen from '../screens/StaffReportsScreen';
import StaffProfilesScreen from '../screens/StaffProfilesScreen';
import StaffProfileEditScreen from '../screens/StaffProfileEditScreen';
import PermissionDelegationScreen from '../screens/PermissionDelegationScreen';
import AuditLogScreen from '../screens/AuditLogScreen';
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
const LeaversWrapped = withScreenHeader(LeaversScreen, 'Leavers');
const PasswordResetWrapped = withScreenHeader(PasswordResetScreen, 'Password Reset');
const PasswordResetWrapped = withScreenHeader(PasswordResetScreen, 'Password Reset');
const StudentsByStatusWrapped = withScreenHeader(StudentsByStatusScreen, 'Students by Status');
const BiodataApprovalWrapped = withScreenHeader(BiodataApprovalScreen, 'Biodata Approval');
const ClassTeachersWrapped = withScreenHeader(ClassTeachersScreen, 'Class Teachers');
const CreateClassTeacherWrapped = withScreenHeader(CreateClassTeacherScreen, 'Add Class Teacher');
const LogBookWrapped = withScreenHeader(LogBookScreen, 'Log Book');
const PersonalLogWrapped = withScreenHeader(PersonalLogScreen, 'My Log');
const BlackBookWrapped = withScreenHeader(BlackBookScreen, 'Black Book');
const AlumniWrapped = withScreenHeader(AlumniScreen, 'Alumni');
const StaffReportsWrapped = withScreenHeader(StaffReportsScreen, 'Staff Reports');
const StaffProfilesWrapped = withScreenHeader(StaffProfilesScreen, 'Staff Profiles');
const StaffProfileEditWrapped = withScreenHeader(StaffProfileEditScreen, 'Edit Staff Profile');
const PermissionDelegationWrapped = withScreenHeader(PermissionDelegationScreen, 'Permissions');
const AuditLogWrapped = withScreenHeader(AuditLogScreen, 'Audit Log');

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
        name="ClassTeachers"
        component={ClassTeachersWrapped}
        options={{ title: 'Class Teachers' }}
      />
      <Stack.Screen
        name="CreateClassTeacher"
        component={CreateClassTeacherWrapped}
        options={{ title: 'Add Class Teacher' }}
      />
      <Stack.Screen
        name="BlackBook"
        component={BlackBookWrapped}
        options={{ title: 'Black Book' }}
      />
      <Stack.Screen
        name="Alumni"
        component={AlumniWrapped}
        options={{ title: 'Alumni' }}
      />
      <Stack.Screen
        name="LogBook"
        component={LogBookWrapped}
        options={{ title: 'Log Book' }}
      />
      <Stack.Screen
        name="PersonalLog"
        component={PersonalLogWrapped}
        options={{ title: 'My Log' }}
      />
      <Stack.Screen
        name="StaffReports"
        component={StaffReportsWrapped}
        options={{ title: 'Staff Reports' }}
      />
      <Stack.Screen
        name="StaffProfiles"
        component={StaffProfilesWrapped}
        options={{ title: 'Staff Profiles' }}
      />
      <Stack.Screen
        name="StaffProfileEdit"
        component={StaffProfileEditWrapped}
        options={{ title: 'Edit Staff Profile' }}
      />
      <Stack.Screen
        name="PermissionDelegation"
        component={PermissionDelegationWrapped}
        options={{ title: 'Permissions' }}
      />
      <Stack.Screen
        name="AuditLog"
        component={AuditLogWrapped}
        options={{ title: 'Audit Log' }}
      />
      <Stack.Screen
        name="StudentsByStatus"
        component={StudentsByStatusWrapped}
        options={{ title: 'Students by Status' }}
      />
      <Stack.Screen
        name="BiodataApproval"
        component={BiodataApprovalWrapped}
        options={{ title: 'Biodata Approval' }}
      />
      <Stack.Screen
        name="PasswordReset"
        component={PasswordResetWrapped}
        options={{ title: 'Password Reset' }}
      />
      <Stack.Screen
        name="PasswordReset"
        component={PasswordResetWrapped}
        options={{ title: 'Password Reset' }}
      />
      <Stack.Screen
        name="Leavers"
        component={LeaversWrapped}
        options={{ title: 'Leavers' }}
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
