import React from 'react';
import { useAuth } from '../context/AuthContext';
import WebPageScreen from './WebPageScreen';

const RESULTS_PAGE = {
  title: 'Check Student Results',
  subtitle: 'Access student results through the external results system',
  url: 'https://yalav1.yalamatrixschools.com/dapp/view-student-results.php',
  allowedHosts: ['yalav1.yalamatrixschools.com'],
};

const ALLOWED_ROLES = new Set(['director', 'principal', 'head_teacher']);

export function canAccessResultPortal(role) {
  return ALLOWED_ROLES.has(role);
}

export default function ResultPortalScreen({ navigation }) {
  const { user } = useAuth();
  const allowed = canAccessResultPortal(user?.role);

  return (
    <WebPageScreen
      navigation={navigation}
      route={{
        params: {
          ...RESULTS_PAGE,
          accessDenied: !allowed,
          deniedMessage:
            'Only the Director, Principal, and Head Teachers can open the Check Student Results.',
        },
      }}
    />
  );
}
